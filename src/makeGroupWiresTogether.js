/* eslint-env browser */
import * as THREE from 'three';
import { EdgeSplitModifier } from 'three/examples/jsm/modifiers/EdgeSplitModifier';
import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';

/**
 * Group together FreeCAD object mesh with related wires from exported Wavefront .obj format.
 *
 * See: {@link https://github.com/gbroques/freecad-to-obj/}
 *
 * @param {number} width Width of Three.js application.
 * @param {number} height Height of Three.js application.
 * @returns {function} Function that transforms an Object3D into grouped wires.
 */
function makeGroupWiresTogether(width, height) {
  const wireMaterial = createWireMaterial(width, height);
  return (object) => {
    const meshes = findMeshes(object);
    return meshes.map((importedMesh) => {
      const mesh = createMesh(importedMesh);
      mesh.name = `${importedMesh.name}Mesh`;

      const numberOfWires = findNumberOfWires(object, importedMesh.name);
      const wireMeshes = [...Array(numberOfWires).keys()].map((n) => {
        const wireName = `${importedMesh.name}Wire${n}`;
        const importedWireMesh = object.getObjectByName(wireName);
        return createWireMesh(importedWireMesh, wireMaterial);
      });
      const wireMeshGroup = wireMeshes.reduce((group, wireMesh) => {
        group.add(wireMesh);
        return group;
      }, new THREE.Group());
      wireMeshGroup.name = `${importedMesh.name}WireGroup`;

      const part = new THREE.Group();
      part.add(mesh);
      part.add(wireMeshGroup);
      part.name = importedMesh.name;
      return part;
    });
  };
}

/**
 * Create wire mesh.
 *
 * WebGL cannot render lines wider than 1px due to browser limitations.
 * Thus, Line2 used.
 * {@link https://threejs.org/examples/?q=fat#webgl_lines_fat}
 * {@link https://jsfiddle.net/brLk6aud/1/}
 *
 */
function createWireMesh(importedMesh, material) {
  const importedPositions = importedMesh.geometry.attributes.position.array;
  const geometry = createWireGeometry(importedPositions);

  const mesh = new Line2(geometry, material);
  mesh.name = importedMesh.name;
  return mesh;
}

function createWireGeometry(positions) {
  const geometry = new LineGeometry();
  geometry.setPositions(positions);
  return geometry;
}

/**
 * {@link https://github.com/mrdoob/three.js/blob/r132/examples/jsm/lines/LineMaterial.js}
 */
function createWireMaterial(width, height) {
  const material = new LineMaterial({
    color: 0x000000,
    linewidth: 1.5, // in pixels
    dashed: false,
    dashScale: 3,
    dashSize: 1,
    gapSize: 1,
  });
  material.resolution.set(width, height);
  return material;
}

/**
 * EdgeSplitModifier combine vertices,
 * so that smoothing normals can be generated WITHOUT removing hard edges of model.
 * {@link https://threejs.org/examples/?q=edgesplit#webgl_modifier_edgesplit}
 * {@link https://github.com/mrdoob/three.js/pull/20535}
 */
function createMesh(importedMesh) {
  const edgeSplitModifier = new EdgeSplitModifier();
  const cutOffAngle = 20 * (Math.PI / 180);
  const edgeSplitGeometry = edgeSplitModifier.modify(
    importedMesh.geometry,
    cutOffAngle,
  );
  return new THREE.Mesh(edgeSplitGeometry, importedMesh.material);
}

function findMeshes(object) {
  const wirePattern = /Wire[0-9]+$/;
  return object
    .children
    .filter((child) => !wirePattern.test(child.name));
}

function findNumberOfWires(object, name) {
  return object
    .children
    .filter((child) => child.name.startsWith(`${name}Wire`))
    .length;
}

module.exports = makeGroupWiresTogether;
