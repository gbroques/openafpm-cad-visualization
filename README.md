# OpenAFPM CAD Visualization

Module for visualizing [openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core)'s 3D wind turbine model in a [web browser](https://en.wikipedia.org/wiki/Web_browser).

The model housed in `openafpm-cad-core` is made with the open-source CAD program, [FreeCAD](https://freecad.org/).

The following is a high-level explanation for how `openafpm-cad-core` and `openafpm-cad-visualization` fit together:

1. `openafpm-cad-core`
    1. Create the 3D model in [FreeCAD](https://freecadweb.org/https://freecadweb.org/).
    2. Export the 3D model to [Wavefront OBJ](https://en.wikipedia.org/wiki/Wavefront_.obj_file) (`.obj`) format.
2. `openafpm-cad-visualization`
    1. Load the 3D model (`.obj` file) with [three.js](https://threejs.org/) for visualization in a web browser.

![Flow](./flow.png)

## Prerequisites
1. Install [Node.js](https://nodejs.org/en/).
2. Install [Yarn](https://yarnpkg.com/).

       npm install yarn -g

3. Install dependencies.

       yarn install

3. Generate OBJ files from [`openafpm-cad-core`](https://github.com/gbroques/openafpm-cad-core?tab=readme-ov-file#generating-obj-files-for-openafpm-cad-visualization).

## How to Run

1. (**OPTIONAL**) Build bundle if you want to make changes to files in `src/`.

       npm run watch

2. Start server.

       npm run serve

3. Navigate to http://127.0.0.1:8080/ in your web browser of choice. Currently tested in Chrome.

Additionally, on UNIX-like operating systems, you can run `npm start`; which runs `npm run watch` and `npm run serve` in parallel.

## Wind Turbine Object Names

A list of object names that **MUST** be present in the `.obj` file for the Wind Turbine.

In the [Wavefront .obj format](https://en.wikipedia.org/wiki/Wavefront_.obj_file), object names start with `o` and are delimited with a space on their own line (e.g. `o Coils`). 

1. Stator_Coils
2. Stator_ResinCast
3. Rotor_Disk_Front (*Optional*)
4. Rotor_ResinCast_Front (*Optional*)
5. Rotor_Magnets_Front (*Optional*)
6. Rotor_Disk_Back
7. Rotor_ResinCast_Back
8. Rotor_Magnets_Back
9. Hub_Flange
10. Hub_Flange_Cover_Front
11. Hub_Flange_Cover_Back
12. Hub_StubAxleShaft
13. Studs_Hub
14. Frame
15. YawBearing
16. Tail_Hinge_Inner
17. Tail_Hinge_Outer
18. Tail_Boom_Pipe
19. Tail_Boom_Support
20. Tail_Stop_HighEnd
21. Vane_Bracket_Top
22. Vane_Bracket_Bottom
23. Tail_Vane
24. Studs_Frame
25. Bolts (used by Tools)
26. Nuts (used by Tools)
27. *Screws (used by Tools)
28. LocatingWashers (used by Stator Mold)
29. LocatingBolts (used by Stator Mold)
30. Washers (used by Rotor Mold)
31. Rotor_MagnetJig (used by Magnet Jig)
32. Rotor_MagnetJig_Disk (used by Magnet Jig)
33. Rotor_Magnets (used by Magnet Jig)
34. Rods (used by Coil Winder)
35. Blade_Assembly_BackDisk
36. Blade_Assembly_FrontTriangle

\* Denotes and "ends with" match is performed.

## API

### OpenAfpmCadVisualization

#### Constructor

Construct a new OpenAFPM CAD visualization instance.

Behind the scenes constructs a [WebGLRenderer](https://threejs.org/docs/?q=render#api/en/renderers/WebGLRenderer), and a single instance is intended to be used throughout the lifetime of various visualizations (i.e. Wind Turbine and tools).

It also appends [`style`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/style) elements to the `head` of the document.

##### Arguments

|Name|Type|Required|Description|
|----|----|--------|-----------|
|`options`|`Object`|`true`|See below rows documenting properties.|
|`options.rootDomElement`|[`Element`](https://developer.mozilla.org/en-US/docs/Web/API/Element)|`true`|DOM element to mount visualization elements to.|
|`options.width`|`number`|`true`|Width of visualization.|
|`options.height`|`number`|`true`|Height of visualization.|

#### visualize(loadObj, assembly, furlTransformPromise)

Visualize a 3D model by loading it from a promise-based data source. Manages loading screen internally.

##### Arguments

|Name|Type|Required|Description|
|----|----|--------|-----------|
|`loadObj`|`function(): Promise.<string>`|`true`|Function that returns a `Promise` that resolves to [Wavefront OBJ](https://en.wikipedia.org/wiki/Wavefront_.obj_file) file contents.|
|`assembly`|[`string`]|`true`|Assembly of visualization. Must be one of `"WindTurbine"`, `"StatorMold"`, `"RotorMold"`, `"MagnetJig"`, or `"CoilWinder"`.|
|`furlTransformPromise`|`Promise.<FurlTransform>`|`true` when `type` === `"WindTurbine"`, `false` otherwise.|When `assembly` === `"WindTurbine"`, the `Promise` must resolve to a `FurlTransform` object. See below table for details.|

**Returns:** `undefined`

###### FurlTransform

|Name|Type|Required|Description|
|----|----|--------|-----------|
|`furlTransform`|`Object`|`true`|An object representing how to furl the tail.|
|`maximum_angle`|`number`|`true`|Maximum angle (**in degrees**) to furl the tail before high end stop hits the yaw bearing pipe.|
|`transforms`|`Array.<Transform>`|`true`|Three element array of `Transform` objects needed to furl the tail. See below table for details.|

###### Transform

|Name|Type|Required|Description|
|----|----|--------|-----------|
|`transform`|`Object`|`true`|An object representing a 3D transformation in [Axis–angle representation](https://en.wikipedia.org/wiki/Axis%E2%80%93angle_representation).|
|`transform.name`|`string`|`false`|Name of transformation for descriptive purposes. (*optional*).|
|`transform.position`|`Array.<number>`|`true`|Three element array for x, y, and z coordinates.|
|`transform.axis`|`Array.<number>`|`true`|Axis of rotation, three element array for x, y, and z axes.|
|`transform.angle`|`number`|`true`|Angle of rotation (**in radians**).|

#### render(objText, assembly, furlTransform)

Render a 3D model directly from OBJ text data. Use this for streaming scenarios where you receive data progressively. Call `setProgress()` to update the loading screen before calling this method.

**Example:**
```javascript
// Streaming usage pattern
visualization.setProgress('Downloading model...', 0);
// ... fetch chunks ...
visualization.setProgress('Processing model...', 50);
// ... process data ...
visualization.render(objText, 'WindTurbine', furlTransform);
```

##### Arguments

|Name|Type|Required|Description|
|----|----|--------|-----------|
|`objText`|`string`|`true`|[Wavefront OBJ](https://en.wikipedia.org/wiki/Wavefront_.obj_file) file contents.|
|`assembly`|[`string`]|`true`|Assembly of visualization. Must be one of `"WindTurbine"`, `"StatorMold"`, `"RotorMold"`, `"MagnetJig"`, or `"CoilWinder"`.|
|`furlTransform`|`FurlTransform`|`true` when `assembly` === `"WindTurbine"`, `false` otherwise.|When `assembly` === `"WindTurbine"`, must be a `FurlTransform` object. See below table for details.|

**Returns:** `undefined`

#### setProgress(message, percent)

Update the loading screen with progress information. Automatically shows the loading screen if not already visible.

##### Arguments

|Name|Type|Required|Description|
|----|----|--------|-----------|
|`message`|`string`|`true`|Progress message to display.|
|`percent`|`number`|`true`|Progress percentage (0-100).|

**Returns:** `undefined`

#### showError(message)

Display an error screen with the specified message. Automatically hides the loading screen.

##### Arguments

|Name|Type|Required|Description|
|----|----|--------|-----------|
|`message`|`string`|`true`|Error message to display.|

**Returns:** `undefined`

#### resize(width, height)
Resize visualization to specified `width` and `height`.

##### Arguments

|Name|Type|Required|Description|
|----|----|--------|-----------|
|`width`|`number`|`true`|Width to resize visualization to.|
|`height`|`number`|`true`|Height to resize visualization to.|

**Returns:** `undefined`

#### handleMouseMove(event)
Display tooltip if cursor hovers over part and update internal mouse coordinates.

This method is debounced with a 10 millisecond wait time.

**Note:** This method is exposed but not automatically attached to events. You must manually attach it to the window's `mousemove` event:

```javascript
window.addEventListener('mousemove', (event) => {
  visualization.handleMouseMove(event);
});
```

##### Arguments

|Name|Type|Required|Description|
|----|----|--------|-----------|
|`event`|[`MouseEvent`](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent)|`true`|[mousemove event](https://developer.mozilla.org/en-US/docs/Web/API/Element/mousemove_event).|

**Returns:** `undefined`

#### cleanUp()
Performs various clean-up such as [disposing geometries and materials](https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects).

**Returns:** `undefined`

## Themeing

Basic themeing support is available via the `data-theme` attribute on the `rootDomElement`.

Supported values include `"light"` (the default) and `"dark"`.

## Related Repositories

* [openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core)
