# OpenAFPM CAD Visualization

Module for visualizing [openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core) 3D wind turbine model created in [FreeCAD](https://freecadweb.org/https://freecadweb.org/) via a [web browser](https://en.wikipedia.org/wiki/Web_browser).

1. Create the 3D model in [FreeCAD](https://freecadweb.org/https://freecadweb.org/).
2. Export the 3D model to [Wavefront OBJ](https://en.wikipedia.org/wiki/Wavefront_.obj_file) (`.obj`) format.
3. Load the 3D model (`.obj` file) with [three.js](https://threejs.org/).

![Flow](./flow.png)

## Prerequisites
Install [Node.js](https://nodejs.org/en/).

## How to Run
1. Install dependencies.

       npm install

2. (**OPTIONAL**) Build bundle if you want to make changes to files in `src/`.

       npm run watch

3. Start server.

       npm run serve

4. Navigate to http://127.0.0.1:8080/ in your web browser of choice. Currently tested in Chrome.

Additionally, on UNIX-like operating systems, you can run `npm start`; which runs `npm run watch` and `npm run serve` in parallel.

## Wind Turbine Object Names

A list of object names that **MUST** be present in the `.obj` file for the Wind Turbine.

In the [Wavefront .obj format](https://en.wikipedia.org/wiki/Wavefront_.obj_file), object names start with `o` and are delimited with a space on their own line (e.g. `o Coils`). 

1. Stator_Coils
2. Stator_ResinCast
3. Rotor_Disk_Front
4. Rotor_ResinCast_Front
5. Rotor_Magnets_Front
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
25. Studs_Frame

## API

### OpenAfpmCadVisualization

#### Constructor

Construct a new OpenAFPM CAD visualization instance.

Behind the scenes constructs a [WebGLRenderer](https://threejs.org/docs/?q=render#api/en/renderers/WebGLRenderer), and a single instance is intended to be used throughout the lifetime of various visualizations (i.e. Wind Turbine and tools).

##### Arguments

|Name|Type|Required|Description|
|----|----|--------|-----------|
|`options`|`Object`|`true`|See below rows documenting properties.|
|`options.rootDomElement`|[`Element`](https://developer.mozilla.org/en-US/docs/Web/API/Element)|`true`|DOM element to mount visualization elements to.|
|`options.width`|`number`|`true`|Width of visualization.|
|`options.height`|`number`|`true`|Height of visualization.|

#### visualize(objUrl, type, transformsByName)

##### Arguments

|Name|Type|Required|Description|
|----|----|--------|-----------|
|`objUrl`|`string`|`true`|URL to load [Wavefront OBJ](https://en.wikipedia.org/wiki/Wavefront_.obj_file) file.|
|`type`|[`string`]|`true`|Type of visualization. Must be one of `"WindTurbine"` or `"Tool"`.|
|`transformsByName`|`Object.<string, Array.<Transform>`|`true` when `type` === `"WindTurbine"`, `false` otherwise.|When `type` === `"WindTurbine"`, a `"furl"` property must be present containing a three element array of `Transform` objects needed to furl the tail. See below table for details.|

###### Transform

|Name|Type|Required|Description|
|----|----|--------|-----------|
|`transform`|`Object`|`true`|An object representing a 3D transformation in [Axis–angle representation](https://en.wikipedia.org/wiki/Axis%E2%80%93angle_representation).|
|`transform.name`|`string`|`false`|Name of transformation for descriptive purposes. (*optional*).|
|`transform.position`|`Array.<number>`|`true`|Three element array for x, y, and z coordinates.|
|`transform.axis`|`Array.<number>`|`true`|Axis of rotation, three element array for x, y, and z axes.|
|`transform.angle`|`number`|`true`|Angle of rotation (**in radians**).|

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

##### Arguments

|Name|Type|Required|Description|
|----|----|--------|-----------|
|`event`|[`MouseEvent`](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent)|`true`|[mousemove event](https://developer.mozilla.org/en-US/docs/Web/API/Element/mousemove_event).|

**Returns:** `undefined`

#### cleanUp()
Performs various clean-up such as [disposing geometries and materials](https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects).

**Returns:** `undefined`

## Related Repositories

* [openafpm-cad-core](https://github.com/gbroques/openafpm-cad-core)
