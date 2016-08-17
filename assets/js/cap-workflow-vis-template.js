/**
 * Provides the mechanism to generate the graph layout for yandage workflow templates
 * @author Eamonn Maguire <eamonnmag@gmail.com>
 */
var cap_workflow_vis_template = (function () {

    var dependency_map = {};
    var groups = {};
    var graph = {'nodes': [], 'links': [], 'groups': []};
    var node_count = 0, current_depth = 0, workflow_count = 0;
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
    function addNode(id, stage, type, name, value) {
        var _node = {
            'id': id,
            'type': type,
            'name': name,
            'value': value
        };

        graph.nodes.push(_node);

        if (!(stage in dependency_map[current_depth][workflow_count])) {
            dependency_map[current_depth][workflow_count][stage] = {'id': id, 'outputs': {}};
        }

        if (type in last_nodes) {
            last_nodes[type]['node'] = _node;
            last_nodes[type]['dependencies'] = dependency_map[current_depth][workflow_count][stage];
        }

        groups[current_depth][workflow_count].leaves.push(id);

        if (dependency_map[current_depth][workflow_count][stage]) {
            graph.links.push({'source': dependency_map[current_depth][workflow_count][stage].id, 'target': node_count});
            dependency_map[current_depth][workflow_count][stage].outputs[name] = {
                'id': id,
                'name': value
            };
        }
    }

    /**
     *
     * @param parameter
     * @param stage
     */
    function processParameters(parameter, stage) {
        var _parameter_value = parameter.value;
        var _stage = _parameter_value.stages;

        if (_stage === 'init') {
            if (!(_parameter_value.output in dependency_map[current_depth][workflow_count]['init'].outputs)) {
                addNode(node_count, 'init', 'output',
                    _parameter_value.output, _parameter_value.output);

                graph.links.push({
                    'source': node_count,
                    'target': dependency_map[current_depth][workflow_count][stage.name].id
                });

                node_count += 1;
            }
        } else if (_stage in dependency_map[current_depth][workflow_count]) {
            var output_node = dependency_map[current_depth][workflow_count][_stage]
                .outputs[_parameter_value.output];

            if (output_node) {
                graph.links.push({
                    'source': output_node.id,
                    'target': dependency_map[current_depth][workflow_count][stage.name].id
                })
            }
        } else {
            // we have a sub chain
            if (_stage && _stage.indexOf("[*]") !== -1) {

                var last_dependency = dependency_map[current_depth + 1][workflow_count + 1];

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
                        'target': dependency_map[current_depth][workflow_count][stage.name].id
                    })
            }
        }
    }


    /**
     *
     * @param stages
     * @param init_node
     */
    function processStages(stages, init_node) {

        console.log(current_depth);

        if (!(current_depth in dependency_map)) {
            dependency_map[current_depth] = {};
            groups[current_depth] = {};
        }

        if (!(workflow_count in dependency_map[current_depth])) {
            groups[current_depth][workflow_count] = {'leaves': []};
            dependency_map[current_depth][workflow_count] = {};
        }

        if (init_node) {
            dependency_map[current_depth][workflow_count]['init'] = init_node.dependencies;
            init_node.node.name = 'init';
            init_node.node.type = 'init';
            groups[current_depth][workflow_count].leaves.push(init_node.node.id);
        } else {
            addNode(node_count, 'init', 'init', 'init', {});
            node_count += 1;
        }


        stages.forEach(function (stage) {

            addNode(node_count, stage.name, 'process', stage.name, stage);
            node_count += 1;

            var scheduler = 'scheduler' in stage ? stage.scheduler : stage.rule;

            if ('step' in scheduler) {
                var step = scheduler.step;
                // push outputs and link them to the process.
                if ('publisher' in step) {
                    for (var output_key in step.publisher.outputmap) {
                        addNode(node_count, stage.name, 'output', output_key);
                        node_count += 1;
                    }
                }
            }

            if ('parameters' in scheduler) {
                scheduler.parameters.forEach(function (parameter) {
                    processParameters(parameter, stage);
                });
            }

            if ('workflow' in scheduler) {
                current_depth += 1;
                workflow_count += 1;
                console.log("Processing workflow, number " + workflow_count);
                processStages(scheduler.workflow.stages, last_nodes['process']);
                current_depth -= 1;
                workflow_count -= 1;
            }
        });

        graph.groups = [];
        var _level_count = Object.keys(groups).length;
        for (var level_idx in groups) {

            for (var workflow_idx in groups[level_idx]) {
                var _filtered_leaves = groups[level_idx][workflow_idx].leaves.filter(function (d) {
                    return d != undefined;
                });

                var _group_def = {'leaves': _filtered_leaves, 'groups': [], 'color': 'white'};

                if (level_idx == 0 && _level_count > 1)
                    _group_def['groups'] = [1];
                console.log(_group_def['groups']);

                if (level_idx > 0)
                    _group_def['color'] = '#f6f7f6';

                graph.groups.push(_group_def);
            }
        }

        return graph;
    }

    /**
     *
     * @param data
     * @returns {Array}
     */
    function generateGraph(data) {
        return processStages(data);
    }

    return {
        generateGraph: generateGraph
    }
})
();