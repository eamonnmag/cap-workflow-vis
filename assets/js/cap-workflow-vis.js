/**
 * Provides the mechanism to visualize yandage workflows
 * using an interactive graph layout.
 * @author Eamonn Maguire <eamonnmag@gmail.com>
 */
var cap_workflow_vis = (function () {

    /**
     * Flattens out the subgroups
     * @param processed_group
     * @param extracted_groups
     */
    function extractGroups(processed_group, extracted_groups) {
        for (var subgroup_idx in processed_group.subgroups) {
            var _subgroup_obj = processed_group.subgroups[subgroup_idx];
            extracted_groups.push({
                'id': _subgroup_obj.id,
                'groups': _subgroup_obj.groups,
                'leaves': _subgroup_obj.leaves,
                'name': _subgroup_obj.name
            });

            if ('subgroups' in _subgroup_obj) extractGroups(_subgroup_obj, extracted_groups);
        }
    }

    /**
     *
     * @param data
     * @returns {Array}
     */
    function generateGraph(data) {

        if ('dag' in data) {
            return cap_workflow_vis_instance.generateGraph(data)
        } else {
            return cap_workflow_vis_template.generateGraph(data.stages);
        }
    }

    /**
     *
     * @param text
     * @param fontSize
     * @param fontFace
     * @returns {Number}
     */
    function getTextWidth(text, fontSize, fontFace) {
        var a = document.createElement('canvas');
        var b = a.getContext('2d');
        b.font = fontSize + 'px ' + fontFace;
        return b.measureText(text).width;
    }

    function generateTooltip() {
        return d3.tip().attr('class', 'd3-tip')
            .html(function (d) {
                if (d.type === 'output') {
                    return d.id + ' - ' + d.name
                }
                var html;
                if (d.info && d.info.scheduler.step) {
                    var cmd = d.info.scheduler.step.process.cmd;
                    for (var parameter_type in d.info.parameters) {
                        cmd = cmd.replace('{' + parameter_type + '}',
                            d.info.parameters[parameter_type]);
                    }
                }

                html = '<span>' + d.name + '</span><br/>';

                return html;
            });
    }

    function render(placement, data, options) {
        var tip = generateTooltip();

        var zoom = d3.behavior.zoom().scale(0.3).scaleExtent([0.1, 4]);

        var svg = d3.select(placement)
            .append('svg')
            .attr({
                'width': options.width,
                'height': options.height
            });

        svg.call(tip);

        svg.append('rect')
            .attr('id', 'zoom-region')
            .attr('width', options.width)
            .attr('height', options.height)
            .attr('fill', 'white')
            .call(zoom.on("zoom", function () {
                vis.attr("transform", "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")")
            }));


        var vis = svg.append('g').attr("transform", "scale(0.3)");

        var graph = generateGraph(data);

        graph.nodes.forEach(function (v) {
            v.width = (v.type === 'output' ? 90 : v.type === 'init' ? 70 : 150);
            v.height = (v.type === 'output' ? 70 : v.type === 'init' ? 70 : 80);
        });


        graph.groups.forEach(function (g) {
            g.padding = 1;
        });

        var cola_d3 = cola.d3adaptor()
            .linkDistance(110)
            .size([options.width, options.height])
            .nodes(graph.nodes)
            .links(graph.links)
            .groups(graph.groups)
            .flowLayout("y", 110)
            .avoidOverlaps(true)
            .start(25, 10, 100);

        var group = vis.selectAll(".group")
            .data(graph.groups)
            .enter().append("rect")
            .attr("rx", 8).attr("ry", 8)
            .attr("class", 'group')
            .style("stroke", '#2c3e50')
            .style("stroke-dasharray", 2)
            .style("fill", function (d) {
                return d.id > 0 ? '#f6f7f6' : 'white';
            })
            .call(cola_d3.drag);


        var link = vis.selectAll(".link")
            .data(graph.links)
            .enter().append("line")
            .attr("class", "link")
            .attr("marker-end", function (d) {
                return "url(#" + d.rel + ")";
            });


        var pad = 10;
        var node = vis.selectAll(".node")
            .data(graph.nodes)
            .enter().append("g").attr('class', function (d) {
                return 'node ' + d.type;
            })
            .attr('transform', 'translate(0,0)');

        node.call(cola_d3.drag);

        node.on('mouseover', tip.show)
            .on('mouseout', tip.hide);


        node.append("rect")
            .attr("class", function (d) {
                return d.type + " " + (d.state ? d.state.toLowerCase() : "");
            })
            .attr('rx', function (d) {
                return d.type == 'process' ? 15 : d.type == 'init' ? 30 : 2;
            })
            .attr("width", function (d) {

                return d.width - (2 * pad);
            })
            .attr("height", function (d) {
                return d.height - (2 * pad);
            });

        node.append("line").attr('class', 'output_header').attr({
            'x1': 0,
            'y1': 15,
            'y2': 15
        }).attr('x2', function (d) {
            return d.width - (2 * pad);
        });

        node.append('text').attr('class', 'node-type').text(function (d) {
            return d.type == 'output' ? "Output" : "";
        }).attr('text-anchor', 'middle')
            .attr('x', function (d) {
                return (d.width - (2 * pad)) / 2;
            }).attr('y', 10);


        node.append("text")
            .attr("class", function (d) {
                return "label " + d.type;
            })
            .attr('x', function (d) {
                return (d.width - (2 * pad)) / 2;
            })
            // and shrink it.
            .attr('textLength', function (d) {
                var text_width = getTextWidth(d.name, 12, 'Montserrat');
                return text_width > d.width - (2 * pad) ? (d.width - (2 * pad) - 10) : text_width;
            })
            .attr('lengthAdjust', function (d) {
                return null;
            })
            .attr('y', function (d) {
                return (d.height) / 2 - (d.type != 'output' ? 7 : 0);
            })
            .attr('text-anchor', 'middle')
            .text(function (d) {
                return d.name;
            });

        node.append("title")
            .text(function (d) {
                return d.name;
            });

        cola_d3.on("tick", function () {
            link.attr("x1", function (d) {
                    return d.source.x;
                })
                .attr("y1", function (d) {
                    return d.source.y;
                })
                .attr("x2", function (d) {
                    return d.target.x;
                })
                .attr("y2", function (d) {
                    return d.target.y;
                });

            group.attr("x", function (d) {
                    return d.bounds.x;
                })
                .attr("y", function (d) {
                    return d.bounds.y;
                })
                .attr("width", function (d) {
                    return d.bounds.width();
                })
                .attr("height", function (d) {
                    return d.bounds.height();
                });

            node
                .attr('transform', function (d) {
                    return 'translate(' + (d.x - d.width / 2 + pad) + ',' + (d.y - d.height / 2 + pad) + ')'
                });
        });
    }

    return {
        /**
         * Renders a workflow visualization given a data object
         * conforming to the yandage schema
         * @param placement - id (#my-div) or class (.my-div) for where
         * to position the visualization
         * @param data JSON conforming to the yandage schema
         * @param options - dictionary with width and height as keys.
         */
        render: render,
        extractGroups: extractGroups

    }
})
();