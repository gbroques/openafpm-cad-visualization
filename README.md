# OpenAFPM CAD Visualization

This repository demonstrates one workflow for visualizing 3D models created in [FreeCAD](https://freecadweb.org/https://freecadweb.org/) via a [web browser](https://en.wikipedia.org/wiki/Web_browser).

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
