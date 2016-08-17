# cap-workflow-vis
CERN Analysis Preservation Workflow Visualization

### Usage

To use the workflow vis, you need a JSON document describing your workflow similar to those available in the Data directory.
There are two different visualizations supported, one is the template (all the steps, inputs etc.)
The other is the instance, which is the executed workflow. This also encodes the status of the execution.

While the code involved in rendering workflows is exactly the same, the code involved in processing the JSON files
is rather different. 

Therefore, if you *only* want to visualize the *instance*, you will need to include the cap-workflow-vis-instance.js file.

```
<script src="assets/js/cap-workflow-vis-instance.js" type="text/javascript"></script>
<script src="assets/js/cap-workflow-vis.js" type="text/javascript"></script>
```

If you *only* want to visualize the *template*, you will need to include the cap-workflow-vis-template.js file.

```
<script src="assets/js/cap-workflow-vis-template.js" type="text/javascript"></script>
<script src="assets/js/cap-workflow-vis.js" type="text/javascript"></script>
```


For both, *template* and *instance* visualization, you will need to include all three JS files..
*The cap-workflow-vis.js file must always be loaded last since it depends on the processing logic in the instance and template files*.

```
<script src="assets/js/cap-workflow-vis-template.js" type="text/javascript"></script>
<script src="assets/js/cap-workflow-vis-instance.js" type="text/javascript"></script>
<script src="assets/js/cap-workflow-vis.js" type="text/javascript"></script>
```

Then, with your JSON, you can load the workflow visualization directly.

```javascript
var data = myjson;
// #workflow1 represents the ID of the DIV in your HTML where you want to render the workflow.
cap_workflow_vis.render('#workflow1', data, {width: 600, height: 800});
```

or, from a URL

```javascript
d3.json('data/basic.json', function (data) {
  cap_workflow_vis.render('#workflow1', data, {width: 600, height: 800})
});

```


### Libraries

We are grateful to Webcola and D3.js for their nice layout algorithms: 
- [Webcola.js](https://github.com/tgdwyer/WebCola)
- [d3.js](https://github.com/mbostock/d3)
