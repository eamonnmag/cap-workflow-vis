# cap-workflow-vis
CERN Analysis Preservation Workflow Visualization

### Usage

To use the workflow vis, you need a JSON document describing your workflow similar to those available in the Data directory.

Then, with your JSON, you can load the workflow visualization directly.

```javascript
var data = myjson;
// #workflow1 represents the ID of the DIV in your HTML where you want to render the workflow.
analysis_workflow_vis.render('#workflow1', data, {width: 600, height: 800});
```

or, from a URL

```javascript
d3.json('data/basic.json', function (data) {
  analysis_workflow_vis.render('#workflow1', data, {width: 600, height: 800})
});

```
