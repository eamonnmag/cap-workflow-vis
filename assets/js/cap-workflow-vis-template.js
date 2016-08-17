/**
 * Provides the mechanism to generate the graph layout for yandage workflow templates
 * @author Eamonn Maguire <eamonnmag@gmail.com>
 */
var cap_workflow_vis_template = (function () {

    var dependency_map = {};
    var graph = {'nodes': [], 'links': [], 'groups': []};
    var node_count = 0, group_count = 0, stage_to_group = {}, output_nodes = {};
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
    function addNode(id, stage, type, name, value, parent_group) {
        var _node = {
            'id': id,
            'type': type,
            'name': name,
            'value': value
        };

        graph.nodes.push(_node);

        var _group_dependency_map = dependency_map[parent_group.id];

        if (!(stage in _group_dependency_map)) {
            _group_dependency_map[stage] = {'id': id, 'outputs': {}};
        }

        if (type in last_nodes) {
            last_nodes[type]['node'] = _node;
            last_nodes[type]['dependencies'] = _group_dependency_map[stage];

        }

        parent_group.leaves.push(id);

        if (_group_dependency_map[stage]) {
            graph.links.push({'source': _group_dependency_map[stage].id, 'target': node_count});
            _group_dependency_map[stage].outputs[value.key ? value.key : name] = {
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
    function processParameters(parameter, stage, parent_group) {
        var _parameter_value = parameter.value;
        var _parameter_stage = _parameter_value.stages;

        var _group_dependency_map = dependency_map[parent_group.id];

        if (_parameter_stage === 'init') {

            if (!(_parameter_value.key in _group_dependency_map['init'].outputs)) {

                addNode(node_count, 'init', 'output',
                    _parameter_value.output, parameter, parent_group);

                output_nodes[parameter.key] = node_count;

                graph.links.push({
                    'source': node_count,
                    'target': _group_dependency_map[stage.name].id
                });

                node_count += 1;
            } else {

            }
        } else if (_parameter_stage in _group_dependency_map) {
            var output_node = _group_dependency_map[_parameter_stage]
                .outputs[_parameter_value.output];

            if (output_node) {
                graph.links.push({
                    'source': output_node.id,
                    'target': _group_dependency_map[stage.name].id
                })
            }
        } else {

            if (_parameter_stage && _parameter_stage.indexOf("[*]") !== -1) {
                var _path_parts = _parameter_stage.split(".");
                var group_indx = stage_to_group[_path_parts[2]];

                var last_dependency = dependency_map[group_indx][_path_parts[2]];

                if (last_dependency.outputs
                    && _parameter_value.output in last_dependency.outputs) {
                    var _last_output_id = last_dependency.outputs[_parameter_value.output].id;
                }


                if (_last_output_id !== undefined)
                    graph.links.push({
                        'source': _last_output_id,
                        'target': _group_dependency_map[stage.name].id
                    })
            }
        }
    }


    function add_group_for_stage(stage, group) {
        if (!(stage in stage_to_group))
            stage_to_group[stage] = [];

        stage_to_group[stage].push(group);
    }

    /**
     *
     * @param stages
     * @param init_node
     */
    function processStages(stages, init_node, parent) {

        if (!(group_count in dependency_map)) {
            dependency_map[group_count] = {};
        }

        var _group_def = {'leaves': [], 'groups': [], 'subgroups': [], 'id': group_count};

        parent.subgroups.push(_group_def);
        parent.groups.push(_group_def.id);

        if (init_node) {
            dependency_map[_group_def.id]['init'] = init_node.dependencies;
            dependency_map[_group_def.id][init_node.name] = init_node.dependencies;

            add_group_for_stage('init', _group_def.id);

            init_node.node.name = 'init';
            init_node.node.type = 'init';

            _group_def.leaves.push(init_node.node.id);
        } else {
            addNode(node_count, 'init', 'init', 'init', {}, _group_def);
            node_count += 1;
        }

        group_count += 1;

        stages.forEach(function (stage) {
            add_group_for_stage(stage.name, _group_def.id);
            addNode(node_count, stage.name, 'process', stage.name, stage, _group_def);
            _group_def.name = stage.name;
            node_count += 1;

            var scheduler = 'scheduler' in stage ? stage.scheduler : stage.rule;

            if ('step' in scheduler) {
                var step = scheduler.step;
                // push outputs and link them to the process.
                if ('publisher' in step) {
                    for (var output_key in step.publisher.outputmap) {
                        addNode(node_count, stage.name, 'output', output_key,
                            step.publisher.outputmap[output_key], _group_def);
                        node_count += 1;
                    }
                }
            }

            if ('parameters' in scheduler) {
                scheduler.parameters.forEach(function (parameter) {
                    processParameters(parameter, stage, _group_def);
                });
            }

            if ('workflow' in scheduler) {
                var parent = _group_def;
                processStages(scheduler.workflow.stages, last_nodes['process'], parent);
            }
        });
    }

    /**
     *
     * @param data
     * @returns {Object}
     */
    function generateGraph(data) {
        var parent = {'subgroups': [], 'groups': [], 'id': 0};
        processStages(data, null, parent);

        var extracted_groups = [];
        cap_workflow_vis.extractGroups(parent, extracted_groups);

        graph.groups = extracted_groups;

        console.log(parent);
        console.log(output_nodes);

        return graph;
    }

    return {
        generateGraph: generateGraph
    }
})
();