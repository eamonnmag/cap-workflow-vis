/**
 * Provides the mechanism to generate the graph layout for yandage workflow instances
 * @author Eamonn Maguire <eamonnmag@gmail.com>
 */
var cap_workflow_vis_instance = (function () {

    var graph = {'nodes': [], 'links': [], 'groups': []};
    var group_count = 0;
    var node_mapping = {};

    /**
     * Recursively finds the groups and subgroups in a graph to create the proper
     * nesting behaviour
     * @param data
     * @param parent - root to attach results to.
     */
    function processGroups(data, parent) {

        var _group_def = parent;
        if (data['_meta']) {
            _group_def = {'leaves': [], 'groups': [], 'subgroups': [], 'id': group_count};
            parent.subgroups.push(_group_def);
            parent.groups.push(group_count);

            group_count += 1;
            for (var _step_idx in data['_meta'].steps) {
                _group_def.leaves.push(node_mapping[data['_meta'].steps[_step_idx]]);
            }
        }
        for (var key in data) {
            if (key !== '_meta') {
                for (var _sub_key in data[key]) {
                    var parent = _group_def;
                    processGroups(data[key][_sub_key], parent);
                }
            }
        }
    }

    /**
     *
     * @param data
     * @returns {Array}
     */
    function generateGraph(data) {
        node_mapping = {};

        data.dag.nodes.forEach(function (d, i) {
            d._id = d.id;
            d.id = i;
            node_mapping[d._id] = d.id;
            d.type = 'process';
        });

        data.dag.edges.forEach(function (d) {
            d.source = node_mapping[d[0]];
            d.target = node_mapping[d[1]];
        });

        graph.nodes = data.dag.nodes;
        graph.links = data.dag.edges;

        var parent = {'subgroups': [], 'groups': []};
        processGroups(data.bookkeeping, parent);

        var extracted_groups = [];
        cap_workflow_vis.extractGroups(parent, extracted_groups);

        graph.groups = extracted_groups;

        return graph;
    }

    return {
        generateGraph: generateGraph
    }
})
();