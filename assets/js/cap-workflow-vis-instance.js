/**
 * Provides the mechanism to visualize yandage workflows
 * using an interactive graph layout.
 * @author Eamonn Maguire <eamonnmag@gmail.com>
 */
var cap_workflow_vis_instance = (function () {

    var graph = {'nodes': [], 'links': [], 'groups': []};
    var group_count = 0;
    var node_mapping = {};

    function processSubchain(subchain, parent_group) {
        for (var _subchain_idx in subchain) {
            group_count += 1;
            var _group_def = {'leaves': [], 'groups': []};
            parent_group.push(group_count);
            for (var _step_idx in subchain[_subchain_idx]._meta.steps) {
                _group_def.leaves.push(node_mapping[subchain[_subchain_idx]._meta.steps[_step_idx]]);
            }
            graph.groups.push(_group_def);

            if ('subchain' in subchain[_subchain_idx])
                processSubchain(subchain[_idx].subchain);
        }
    }

    function processGroups(data) {

        var _group_def = {'leaves': [], 'groups': []};
        for (var _step_idx in data._meta.steps) {
            _group_def.leaves.push(node_mapping[data._meta.steps[_step_idx]]);
        }

        graph.groups.push(_group_def);

        if ('subchain' in data)
            processSubchain(data.subchain, _group_def.groups);

        console.log(graph.groups);


    }

    /**
     *
     * @param data
     * @returns {Array}
     */
    function generateGraph(data) {
        console.log(data.dag);

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

        processGroups(data.bookkeeping);

        return graph;
    }

    return {
        generateGraph: generateGraph
    }
})
();