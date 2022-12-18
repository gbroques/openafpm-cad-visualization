import * as THREE from 'three';
import CameraControls from 'camera-controls';

import Material from './material';
import getMaterial from './getMaterial';
import Part from './windTurbinePart';
import { forEachWithPrevious, groupBy, partition } from './array';
import { mapEntries, mapValues, mergeObjectsWithArrayValues } from './object';
import sortByPrimaryAndSecondaryFloatCriteria from './sortByPrimaryAndSecondaryFloatCriteria';

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
    return [createAmbientLight(), createDirectionalLight()];
  }

  setup(parts, setupContext) {
    const {
      camera, cameraControls, width, height, sortOverrideArray,
    } = setupContext;
    this._parts = sortPartsByZPosition(parts, sortOverrideArray);

    const [partsWithNegativeZMin, partsWithNonNegativeZMin] = partition(
      this._parts, (part) => getMinZ(part) < 0,
    );
    this._partsWithNonNegativeZMin = partsWithNonNegativeZMin;
    this._partsWithNegativeZMin = partsWithNegativeZMin;
    const boundingBoxes = this._parts.map(getBoundingBoxFromPart);
    const unionBox = unionBoundingBoxes(boundingBoxes);
    this._size = new THREE.Vector3();
    unionBox.getSize(this._size);
    const avgDimension = Math.round(((this._size.x + this._size.y + this._size.z) / 3));
    this._explosionFactor = avgDimension / MAX_EXPLODE;
    const maximumSpaceBetweenParts = this._explosionFactor * MAX_EXPLODE;
    const minZ = (
      partsWithNegativeZMin.length * maximumSpaceBetweenParts * -1
    );
    const maxZ = (
      partsWithNonNegativeZMin.length * maximumSpaceBetweenParts
    );

    const zLength = Math.abs(maxZ - minZ);
    camera.far = zLength * 10;
    const aspectRatio = width / height;
    const avgXyDimension = Math.round(((this._size.x + this._size.y) / 2));
    const viewSize = avgXyDimension * 4; // vertical space in view.
    camera.viewSize = viewSize;
    camera.left = -(aspectRatio * viewSize) / 2;
    camera.right = (aspectRatio * viewSize) / 2;
    camera.top = viewSize / 2;
    camera.bottom = -viewSize / 2;
    camera.updateProjectionMatrix();
    const x = zLength * 6;
    const y = this._size.y / 5;
    const z = maxZ * 6;
    cameraControls.setPosition(x, y, z);
    // look in middle of exploded parts
    const targetZ = ((maxZ - this._explosionFactor) + minZ) / 2;
    cameraControls.setTarget(0, 0, targetZ);
    cameraControls.maxDistance = zLength * 1.25;
    cameraControls.minDistance = avgXyDimension;
    const enableTransition = false;
    const azimuthAngle = Math.PI / 4;
    const { polarAngle } = cameraControls;
    cameraControls.rotateTo(azimuthAngle, polarAngle, enableTransition);
    // Return parts for ordering in Visibility menu.
    const reversedParts = [...this._parts].reverse();
    // Ungroup "array parts" by position to later be grouped by name for visibility toggling.
    return ungroupParts(reversedParts);
  }

  getGroupConfigurations({ parts }) {
    // Group all "array parts" by position for explosion.
    // This is needed for the Coil Winder visualization.
    const partsByPosition = groupBy(parts, (part) => getNumberAtEnd(part.name));
    return Object.entries(partsByPosition).map(([position, groupedParts]) => ({
      createGroup: () => {
        const group = new THREE.Group();
        group.name = 'Group' + position;
        return group;
      },
      partNames: new Set(groupedParts.map((part) => part.name)),
    }));
  }

  explode(controller) {
    const explode = controller.Explode;
    const explosionBaseFactor = explode * this._explosionFactor;
    const getExplosionAmountForChild = makeGetExplosionAmountForChild(
      explosionBaseFactor,
    );
    forEachWithPrevious(this._partsWithNonNegativeZMin, (part, previous, index) => {
      if (part.userData.isCompositePart) {
        part.children.forEach((child) => {
          const explosionAmount = getExplosionAmountForChild(child, index);
          const explosionVector = new THREE.Vector3(0, 0, explosionAmount);
          child.position.copy(explosionVector);
        });
      }
      // offset necessary for positioning of Outer_Nut_Front in Coil Winder explosion.
      const offset = getOffset(
        part, previous, getExplosionAmountForChild,
      );
      const explosionVector = new THREE.Vector3(
        0, 0, index * explosionBaseFactor + offset,
      );
      part.position.copy(explosionVector);
    });
    this._partsWithNegativeZMin.forEach((part, index) => {
      const explosionVector = new THREE.Vector3(
        0, 0, (index + 1) * explosionBaseFactor * -1,
      );
      part.position.copy(explosionVector);
    });
  }

  getTooltipLabel(partName) {
    const partNameWithoutNumber = trimEndingNumber(partName);
    const tooltipLabel = {
      [Part.Stator_Coils]: 'Coils',
      [Part.Stator_ResinCast]: 'Stator Resin Cast',
      [Part.Rotor_ResinCast_Front]: 'Rotor Resin Cast',
      [Part.Rotor_Disk_Back]: 'Rotor Disk',
      // Used by Magnet Jig
      Rotor_Magnets: 'Magnets',
      Rotor_MagnetJig: 'Magnet Jig',
      Rotor_MagnetJig_Disk: 'Inner Disk',
      // Used by Coil Winder
      Outer_Nut_Back: 'Nuts',
      Outer_Nut_Front: 'Nuts',
      Stator_CoilWinder_Cheeks: 'Cheek',
      Stator_CoilWinder_Cheek_Notches: 'Notched Cheek',
      Stator_CoilWinder_Cheek_Spacers: 'Spacer',
      NutStacks: 'Nuts',
    }[partNameWithoutNumber];
    if (tooltipLabel) {
      return tooltipLabel;
    } else {
      return PART_NAME_PREFIXES
        .reduce((name, prefix) => name.replace(prefix, ''), partNameWithoutNumber)
        .replaceAll('_', '')
        .replace(/([A-Z])/g, ' $1')
        .trim();
    }
  }

  getMaterial(partName) {
    return getMaterial(partName, Material.WOOD);
  }

  // Most of the complexity here is for the Coil Winder visualization.
  getPartNamesByVisibilityLabel(parts) {
    // Group "array parts" by name for visibility toggling.
    const [arrayParts, nonArrayParts] = partition(
      parts,
      (part) => getTextPrecedingNumberAtEnd(part.name),
    );
    // Outer_Nut_Back and Outer_Nut_Front map to same "Nuts" tooltip label.
    const nonArrayPartsByVisibilityLabel = groupBy(
      nonArrayParts, (part) => this.getTooltipLabel(part.name),
    );
    const nonArrayPartNamesByVisibilityLabel = mapValues(
      nonArrayPartsByVisibilityLabel, partsToNames,
    );
    const arrayPartsByName = groupBy(
      arrayParts,
      (part) => getTextPrecedingNumberAtEnd(part.name),
    );
    const arrayPartNamesByVisibilityLabel = mapEntries(arrayPartsByName, ([name, groupedParts]) => (
      [this.getTooltipLabel(name), partsToNames(groupedParts)]
    ));
    // NutStacks, Outer_Nut_Back, and Outer_Nut_Front map to same "Nuts" tooltip label.
    return mergeObjectsWithArrayValues(
      nonArrayPartNamesByVisibilityLabel, arrayPartNamesByVisibilityLabel,
    );
  }
}

function partsToNames(parts) {
  return parts.map((part) => part.name);
}

function createAmbientLight() {
  const color = 0xFFFFFF;
  const intensity = 0.55;
  return new THREE.AmbientLight(color, intensity);
}

// for providing shininess of copper coil
function createDirectionalLight() {
  const color = 0xFFFFFF;
  const directionalLightIntensity = 0.1;
  const light = new THREE.DirectionalLight(color, directionalLightIntensity);
  light.position.set(0, 100, 250);
  light.target.position.set(0, 50, 100);
  light.name = 'DirectionalLight';
  return light;
}

/**
 * Sort parts by z-position ascending for explosion.
 * Most parts use z-max as their z-position, but some use z-min.
 * "z-extrema" is the term used to describe either z-min or z-max.
 * If two parts are equal in z-position, then they are sorted by
 * XY plane area descending.
 *
 * Additionally, a sort override array of part names may be passed
 * to override the order of parts attained from the above rules.
 */
function sortPartsByZPosition(parts, sortOverrideArray) {
  // Ensure Bolts are between Base and Bolt Head Layer for Stator Mold.
  const zMinPartNames = new Set(['LocatingBolts', 'Bolts', 'Rotor_Magnets']);
  const getZExtremaFromPart = createGetZExtremaFromPart(zMinPartNames);
  const primarySort = {
    getFloatValue: getZExtremaFromPart,
    direction: 'ASC',
  };
  const secondarySort = {
    getFloatValue: getXyPlaneAreaFromPart,
    direction: 'DESC',
  };
  const tolerance = 1; // in mm for comparing two floats
  const sortedParts = sortByPrimaryAndSecondaryFloatCriteria(
    parts,
    primarySort,
    secondarySort,
    tolerance,
  );
  return sortBySortOverrideArray(sortedParts, sortOverrideArray);
}

function sortBySortOverrideArray(array, sortOverrideArray) {
  return [...array].sort((a, b) => {
    const findIndexByName = (part) => (
      sortOverrideArray.findIndex((partName) => partName === part.name)
    );
    const aIndex = findIndexByName(a);
    const bIndex = findIndexByName(b);
    if (aIndex === -1 || bIndex === -1) {
      return 0;
    }
    return Math.sign(aIndex - bIndex);
  });
}

function getMinZ(part) {
  return getZExtrema(part, 'min');
}

function getZExtrema(part, extrema) {
  // const mesh = findMesh(part);
  const boundingBox = getBoundingBoxFromPart(part);
  // stator coil and spacer z are effectively the same,
  // but different by ~0.2. Thus, we round to group them.
  return Math.round(boundingBox[extrema].z);
}

function getBoundingBoxFromPart(part) {
  // use wire group instead of mesh for bounding box
  // as the latter's z-min is always 0 for some reason.
  const wireGroups = findWireGroups(part);
  const boundingBoxes = wireGroups.map((wireGroup) => {
    const boundingBox = new THREE.Box3();
    boundingBox.setFromObject(wireGroup);
    return boundingBox;
  });
  return unionBoundingBoxes(boundingBoxes);
}

function findWireGroups(part) {
  const wireGroup = part.children.find((c) => c.name.endsWith('WireGroup'));
  if (wireGroup !== undefined) {
    return [wireGroup];
  } else {
    // search children of grouped "array parts" for wire groups.
    return part.children.map(findWireGroups).flat();
  }
}

function unionBoundingBoxes(boundingBoxes) {
  return boundingBoxes.reduce((unionBox, boundingBox) => (
    unionBox.union(boundingBox)
  ), new THREE.Box3());
}

function createGetZExtremaFromPart(zMinPartNames) {
  return (part) => {
    const boundingBox = getBoundingBoxFromPart(part);
    const extrema = zMinPartNames.has(part.name) ? 'min' : 'max';
    return boundingBox[extrema].z;
  };
}

function getXyPlaneAreaFromPart(part) {
  const boundingBox = getBoundingBoxFromPart(part);
  const size = new THREE.Vector3();
  boundingBox.getSize(size);
  return getXyPlaneArea(size);
}

function getXyPlaneArea(size) {
  return size.x * size.y;
}

function ungroupParts(parts) {
  const [compositeParts, nonCompositeParts] = partition(parts,
    (part) => part.userData.isCompositePart);
  const ungrouped = compositeParts.reduce((acc, group) => acc.concat(group.children), []);
  return nonCompositeParts.concat(ungrouped);
}

function endsWithNumber(str) {
  return /[0-9]+$/.test(str);
}

function getNumberAtEnd(str) {
  if (endsWithNumber(str)) {
    return Number(str.match(/[0-9]+$/)[0]);
  }
  return null;
}

function trimEndingNumber(str) {
  return endsWithNumber(str) ? getTextPrecedingNumberAtEnd(str) : str;
}

function getTextPrecedingNumberAtEnd(str) {
  if (endsWithNumber(str)) {
    const numberAtEnd = getNumberAtEnd(str);
    return str.replace(new RegExp(numberAtEnd.toString() + '$'), '');
  }
  return null;
}

function makeGetExplosionAmountForChild(explosionBaseFactor) {
  return (child, parentIndex) => {
    const { parent } = child;
    const childIndex = parent.children.indexOf(child);
    // Don't explode first child of composite part.
    const explosionIndex = parentIndex === 0 && childIndex === 0
      ? 0
      : parentIndex + 1 * childIndex;
    return (
      (explosionIndex * explosionBaseFactor) / parent.children.length
    );
  };
}

function getOffset(part, previous, getExplosionAmountForChild) {
  let offset = 0;
  if (previous && previous.userData.isCompositePart && !part.userData.isCompositePart) {
    const lastChildOfPrevious = getLastChild(previous);
    offset = getExplosionAmountForChild(lastChildOfPrevious, 0);
  }
  return offset;
}

function getLastChild(object) {
  if (!object.children.length) {
    return null;
  }
  return object.children[object.children.length - 1];
}

module.exports = ToolVisualizer;
