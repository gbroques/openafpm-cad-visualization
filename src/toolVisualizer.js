import * as THREE from 'three';
import CameraControls from 'camera-controls';

import Material from './material';
import { findMesh } from './findMeshes';

const PART_NAME_PREFIXES = [
  'Stator_Mold',
  'Rotor_Mold',
  'Stator_CoilWinder',
];

const MAX_EXPLODE = 100;

/**
 * Visualizes tools for constructing a Wind Turbine.
 *
 * These tools include the Stator Mold, Rotor Mold,
 * and Coil Winder.
 *
 * Implements the Visualizer interface. See visualizer.js.
 */
class ToolVisualizer {
  /**
   * Create an orthographic camera for viewing tools.
   *
   * This method creates a camera instance,
   * but the parameter values don't matter much
   * since they are set again later in setup.
   *
   * For an explanation of orhographic camera parameter
   * derivation from aspect-ratio and viewSize:
   * [Three.js Orthographic Camera - Interactive 3D Graphics]{@link https://www.youtube.com/watch?v=k3adBAnDpos}
   */
  createCamera(width, height) {
    const aspectRatio = width / height;
    const viewSize = 1000; // vertical space in view.
    const left = -(aspectRatio * viewSize) / 2;
    const right = (aspectRatio * viewSize) / 2;
    const top = viewSize / 2;
    const bottom = -viewSize / 2;
    const near = 0.1;
    const far = 8000;
    const camera = new THREE.OrthographicCamera(
      left,
      right,
      top,
      bottom,
      near,
      far,
    );
    camera.viewSize = viewSize;

    camera.up = new THREE.Vector3(0, 1, 0); // default in Three.js
    return camera;
  }

  /**
   * @see https://github.com/yomotsu/camera-controls
   */
  createCameraControls(camera, domElement, onChange) {
    const controls = new CameraControls(camera, domElement);
    controls.addEventListener('control', onChange);
    controls.addEventListener('transitionstart', onChange);
    return controls;
  }

  getInitialController() {
    return { Explode: MAX_EXPLODE };
  }

  getViewCubeFaces() {
    return ['right', 'left', 'top', 'bottom', 'front', 'back'];
  }

  createLights() {
    return [createAmbientLight()];
  }

  setup(parts, setupContext) {
    const {
      camera, cameraControls, width, height,
    } = setupContext;
    this._parts = sortPartsByZPosition(parts);

    this._partsByZMax = groupBy(this._parts, getMaxZ);
    const boundingBoxes = this._parts
      .map(findMesh)
      .map((mesh) => mesh.geometry.boundingBox);
    const unionBox = boundingBoxes.reduce((acc, boundingBox) => (
      acc.union(boundingBox)
    ), new THREE.Box3());
    this._size = new THREE.Vector3();
    unionBox.getSize(this._size);
    this._explosionFactor = ((this._size.x + this._size.y) / (200));
    const maxIndex = Object.entries(this._partsByZMax).length - 1;
    const maxZ = maxIndex * MAX_EXPLODE * this._explosionFactor;
    camera.far = maxZ * 3.5;
    const aspectRatio = width / height;
    const viewSize = maxZ; // vertical space in view.
    camera.viewSize = viewSize;
    camera.left = -(aspectRatio * viewSize) / 2;
    camera.right = (aspectRatio * viewSize) / 2;
    camera.top = viewSize / 2;
    camera.bottom = -viewSize / 2;
    camera.updateProjectionMatrix();
    const x = maxZ * 1;
    const y = this._size.y / 5;
    const z = maxZ * 1.5;
    const avgDimension = (this._size.x + this._size.y) / 2;
    cameraControls.setPosition(x, y, z);
    cameraControls.maxDistance = z * 1.25;
    cameraControls.minDistance = avgDimension;
  }

  explode(controller, cameraControls) {
    const explode = controller.Explode;

    const maxIndex = Object.entries(this._partsByZMax).length - 1;
    const maxZ = maxIndex * explode * this._explosionFactor;
    cameraControls.setTarget(0, 0, maxZ / 2);
    cameraControls.update();
    // Rotor Mold Surround & Island have same z max
    // and should be exploded the same amount.
    Object.values(this._partsByZMax).forEach((parts, index) => {
      parts.forEach((part) => {
        const explosionVector = new THREE.Vector3(
          0, 0, index * explode * this._explosionFactor,
        );
        part.position.copy(explosionVector);
      });
    });
  }

  getTooltipLabel(partName) {
    return PART_NAME_PREFIXES
      .reduce((name, prefix) => name.replace(prefix, ''), partName)
      .replaceAll('_', '')
      .replace(/([A-Z])/g, ' $1')
      .trim();
  }

  getMaterial() {
    return Material.WOOD;
  }

  getPartNamesByVisibilityLabel(parts) {
    return Object.fromEntries(
      parts.map((part) => {
        const visibilityLabel = this.getTooltipLabel(part.name);
        const partNames = [part.name];
        return [visibilityLabel, partNames];
      }),
    );
  }
}

function createAmbientLight() {
  const color = 0xFFFFFF;
  const intensity = 0.55;
  return new THREE.AmbientLight(color, intensity);
}

function sortPartsByZPosition(parts) {
  const partsToBeSorted = [...parts];
  const boundingBoxByName = {};
  parts.forEach((part) => {
    const mesh = findMesh(part);
    mesh.geometry.computeBoundingBox();
    boundingBoxByName[part.name] = mesh.geometry.boundingBox;
  });
  return partsToBeSorted.sort((a, b) => {
    const aBoundingBox = boundingBoxByName[a.name];
    const bBoundingBox = boundingBoxByName[b.name];
    // < 0, sort a before b
    return aBoundingBox.max.z <= bBoundingBox.max.z ? -1 : 1;
  });
}

function getMaxZ(part) {
  const mesh = findMesh(part);
  return mesh.geometry.boundingBox.max.z;
}

function groupBy(array, getKey) {
  return array.reduce((acc, element) => {
    const key = getKey(element);
    if (!acc[key]) acc[key] = [];
    acc[key].push(element);
    return acc;
  }, {});
}

module.exports = ToolVisualizer;
