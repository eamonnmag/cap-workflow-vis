/**
 * Created by eamonnmaguire on 05/04/2016.
 */

var analysis_workflow_vis = (function () {

    var svg;

    function process_data(data) {

        var graphs = [];

        data.workflows.forEach(function (workflow) {
            var dependency_map = {};
            var graph = {'nodes': [], 'links': [], 'groups': []};

            var node_count = 0;
            workflow.stages.forEach(function (stage) {

                // push main process
                graph.nodes.push({'id': node_count, 'type': 'process', 'name': stage.name, 'info': stage});
                dependency_map[stage.name] = {'id': node_count, 'outputs': {}};

                node_count += 1;

                for (var step_key in stage.scheduler.steps) {
                    var step = stage.scheduler.steps[step_key];

                    // push outputs and link them to the process.
                    for (var output_key in step.publisher.outputmap) {

                        graph.nodes.push({
                            'id': node_count,
                            'type': 'output',
                            'name': step.publisher.outputmap[output_key],
                            'value': output_key
                        });

                        graph.links.push({'source': dependency_map[stage.name].id, 'target': node_count});
                        dependency_map[stage.name].outputs[output_key] = {
                            'id': node_count,
                            'name': step.publisher.outputmap[output_key]
                        };

                        node_count += 1;
                    }
                }

                if ('take_outputs' in stage.scheduler) {
                    stage.dependencies.forEach(function (dependency) {
                        var output_node = dependency_map[dependency].outputs[stage.scheduler.take_outputs];
                        graph.links.push({'source': output_node.id, 'target': dependency_map[stage.name].id})
                    });
                }
            });

            graphs.push(graph);
        });
        return graphs;
    }

    function getTextWidth(text, fontSize, fontFace) {
        var a = document.createElement('canvas');
        var b = a.getContext('2d');
        b.font = fontSize + 'px ' + fontFace;
        return b.measureText(text).width;
    }

    return {
        render: function (placement, data, options) {

            var tip = d3.tip().attr('class', 'd3-tip')
                .html(function (d) {
                    if(d.type === 'output') return d.name;
                    var html = '<span>' + d.name + '</span>';
                    return html;
                });

            var zoom = d3.behavior.zoom().scaleExtent([.3, 5]);

            svg = d3.select(placement)
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

            // initialize constraints object
            var constraints = [];

            var cola_d3 = cola.d3adaptor()
                .linkDistance(50)
                .avoidOverlaps(true)
                .size([options.width, options.height]);

            var graphs = process_data(data);
            var graph = graphs[0];


            graph.nodes.forEach(function (v) {
                v.width = (v.type === 'output' ? 90 : 150);
                v.height = (v.type === 'output' ? 70 : 80);
            });

            graph.groups.forEach(function (g) {
                g.padding = 0.01;
            });

            cola_d3
                .nodes(graph.nodes)
                .links(graph.links)
                .flowLayout("y", 30)
                .constraints(constraints)
                .start(5, 10, 20);


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

            node.on('mouseover', tip.show)
                .on('mouseout', tip.hide);


            node.append("rect")
                .attr("class", function (d) {
                    return d.type;
                })
                .attr('rx', function (d) {
                    return d.type == 'process' ? 15 : 2;
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
                .attr("class", function(d) {
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
                    return (d.height) / 2 - (d.type == 'process' ? 7 : 0);
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
                node
                    .attr('transform', function (d) {
                        return 'translate(' + (d.x - d.width / 2 + pad) + ',' + (d.y - d.height / 2 + pad) + ')'
                    });


            });
        }
    }
})();