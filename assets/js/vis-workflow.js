/**
 * Provides the mechanism to visualize yandage workflows
 * using an interactive graph layout.
 * @author Eamonn Maguire <eamonnmag@gmail.com>
 */
var analysis_workflow_vis = (function () {

    var graphs = [];
    var dependency_map = {};
    var groups = {};
    var graph = {'nodes': [], 'links': [], 'groups': []};
    var node_count = 0, stage_count = 0;
    var last_nodes = {
        'output': {'dependencies': null, 'node': null},
        'process': {'dependencies': null, 'node': null}
    };


    /**
     *
     * @param id
     * @param stage
     * @param type
     * @param name
     * @param value
     */
    function add_node(id, stage, type, name, value) {
        var _node = {
            'id': id,
            'type': type,
            'name': name,
            'value': value
        };

        graph.nodes.push(_node);

        if (!(stage in dependency_map[stage_count])) {
            dependency_map[stage_count][stage] = {'id': id, 'outputs': {}};
        }

        if (type in last_nodes) {
            last_nodes[type]['node'] = _node;
            last_nodes[type]['dependencies'] = dependency_map[stage_count][stage];
        }

        groups[stage_count].leaves.push(id);

        if (dependency_map[stage_count][stage]) {
            graph.links.push({'source': dependency_map[stage_count][stage].id, 'target': node_count});
            dependency_map[stage_count][stage].outputs[name] = {
                'id': id,
                'name': value
            };
        }
    }

    /**
     *
     * @param stages
     * @param init_node
     */
    function process_stages(stages, init_node) {
        dependency_map[stage_count] = {};

        if (!(stage_count in groups)) {
            groups[stage_count] = {'leaves': []};
        }


        if (init_node) {
            dependency_map[stage_count]['init'] = init_node.dependencies;
            init_node.node.name = 'init';
            init_node.node.type = 'init';
            groups[stage_count].leaves.push(init_node.node.id);
        } else {
            add_node(node_count, 'init', 'init', 'init', {});
            node_count += 1;
        }


        stages.forEach(function (stage) {

            add_node(node_count, stage.name, 'process', stage.name, stage);
            node_count += 1;

            var scheduler = stage.scheduler;

            if ('step' in scheduler) {
                var step = scheduler.step;

                // push outputs and link them to the process.
                if ('publisher' in step) {
                    for (var output_key in step.publisher.outputmap) {
                        add_node(node_count, stage.name, 'output', output_key);
                        node_count += 1;
                    }
                }
            }

            if ('parameters' in stage.scheduler) {
                stage.scheduler.parameters.forEach(function (parameter) {
                    var _parameter_value = parameter.value;
                    var _stage = _parameter_value.stages;

                    if (_stage === 'init') {
                        if (!(_parameter_value.output in dependency_map[stage_count]['init'].outputs)) {
                            add_node(node_count, 'init', 'output',
                                _parameter_value.output, _parameter_value.output);

                            graph.links.push({
                                'source': node_count,
                                'target': dependency_map[stage_count][stage.name].id
                            });

                            node_count += 1;
                        }
                    }

                    else if (_stage in dependency_map[stage_count]) {
                        var output_node = dependency_map[stage_count][_stage]
                            .outputs[_parameter_value.output];

                        if (output_node) {
                            graph.links.push({
                                'source': output_node.id,
                                'target': dependency_map[stage_count][stage.name].id
                            })
                        }
                    } else {
                        // we have a sub chain
                        if (_stage && _stage.indexOf("[*]") !== -1) {

                            var last_dependency = dependency_map[stage_count + 1];

                            for (var dependency in last_dependency) {
                                if (last_dependency[dependency].outputs
                                    && _parameter_value.output in last_dependency[dependency].outputs) {
                                    var _last_output_id = last_dependency[dependency]
                                        .outputs[_parameter_value.output].id;
                                }
                            }

                            if (_last_output_id !== undefined)
                                graph.links.push({
                                    'source': _last_output_id,
                                    'target': dependency_map[stage_count][stage.name].id
                                })
                        }
                    }
                });
            }

            if ('workflow' in scheduler) {
                stage_count += 1;
                process_stages(scheduler.workflow.stages, last_nodes['process']);
                stage_count -= 1;
            }


        });

        graph.groups = [];
        var _group_count = Object.keys(groups).length;
        for (var group_idx in groups) {
            var _filtered_leaves = groups[group_idx].leaves.filter(function (d) {
                return d != undefined;
            });
            var _group_def = {'leaves': _filtered_leaves, 'groups': [], 'color': 'white'};

            if (_group_count > 1)
                _group_def['groups'] = d3.range(group_idx+1,_group_count);

            if (group_idx > 0)
                _group_def['color'] = '#f6f7f6';

            graph.groups.push(_group_def);
        }

        graphs.push(graph);
    }

    /**
     *
     * @param data
     * @returns {Array}
     */
    function process_data(data) {
        process_stages(data.stages);
        return graphs;
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

    return {
        /**
         * Renders a workflow visualization given a data object
         * conforming to the yandage schema
         * @param placement - id (#my-div) or class (.my-div) for where
         * to position the visualization
         * @param data JSON conforming to the yandage schema
         * @param options - dictionary with width and height as keys.
         */
        render: function (placement, data, options) {

            var tip = d3.tip().attr('class', 'd3-tip')
                .html(function (d) {
                    if (d.type === 'output') {
                        return d.name
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

            var zoom = d3.behavior.zoom().scaleExtent([.3, 5]);

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
                }))
            ;

            var vis = svg.append('g');

            var graphs = process_data(data);
            var graph = graphs[0];

            graph.nodes.forEach(function (v) {
                v.width = (v.type === 'output' ? 90 : v.type === 'init' ? 70 : 150);
                v.height = (v.type === 'output' ? 70 : v.type === 'init' ? 70 : 80);
            });


            graph.groups.forEach(function (g) {
                g.padding = 0.001;
            });

            var cola_d3 = cola.d3adaptor()
                .linkDistance(100)
                .size([options.width, options.height])
                .nodes(graph.nodes)
                .links(graph.links)
                .groups(graph.groups)
                .flowLayout("y", 100)
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
                    return d.color;
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
                    return d.type;
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
    }
})
();