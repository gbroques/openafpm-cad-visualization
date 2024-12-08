import * as THREE from 'three';
import CameraControls from 'camera-controls';

import MaterialFactory from './materialFactory';
import createMaterial from './createMaterial';
import transformsToMatrix4 from './transformsToMatrix4';
import findMeshes from './findMeshes';
import Part from './windTurbinePart';

/**
 * Duplicated in openafpm-cad-core.
 *
 * We could possibly retrieve this from openafpm-cad-core
 * to avoid the duplication if it changes often.
 *
 * @see https://github.com/gbroques/openafpm-cad-core/blob/bd1d123a5d2e3572b292f448acac67278cd0de3c/openafpm_cad_core/alternator_cells.py#L149-L151
 */
const ALTERNATOR_TILT_ANGLE = 4 * (Math.PI / 180);

/**
 * Approximate length of a T Shape turbine.
 *
 * Used for making explosion proportional to wind turbine length.
 *
 * 2000 is rounded and observed from the bounding box of the T Shape turbine.
 */
const APPROXIMATE_LENGTH_OF_T_SHAPE_ALONG_X_AXIS = 2000;

const TAIL_NAME = 'Tail';

const TAIL_PARTS = new Set([
  Part.Tail_Hinge_Outer,
  Part.Tail_Boom_Pipe,
  Part.Tail_Boom_Support,
  Part.Tail_Stop_HighEnd,
  Part.Vane_Bracket_Top,
  Part.Vane_Bracket_Bottom,
  Part.Tail_Vane,
]);

/**
 * Visualizes a Wind Turbine.
 *
 * Implements the Visualizer interface. See visualizer.js.
 */
class WindTurbineVisualizer {
  createCamera(width, height) {
    const fieldOfView = 55;
    const aspectRatio = width / height;
    const near = 0.1;
    const far = 8000;
    const camera = new THREE.PerspectiveCamera(
      fieldOfView,
      aspectRatio,
      near,
      far,
    );
    camera.up = new THREE.Vector3(0, 1, 0); // default in Three.js
    camera.position.set(1800, 150, -700);
    return camera;
  }

  /**
   * @see https://github.com/yomotsu/camera-controls
   */
  createCameraControls(camera, domElement, onChange) {
    const controls = new CameraControls(camera, domElement);
    controls.maxDistance = 5000;
    controls.minDistance = 250;
    controls.addEventListener('control', onChange);
    controls.addEventListener('transitionstart', onChange);
    return controls;
  }

  getInitialController() {
    return { Explode: 0, 'Furl (in deg)': 0 };
  }

  getViewCubeFaces() {
    return ['front', 'back', 'top', 'bottom', 'left', 'right'];
  }

  createLights() {
    return [
      createAmbientLight(),
      createFrontLight(),
      createBackLight(),
    ];
  }

  /**
   * Various things are pre-calcuated and set as properties
   * for render performance when exploding the model or
   * furling the tail later.
   */
  setup(parts, setupContext) {
    const { furlTransform } = setupContext;
    this._furlTransforms = deepCopy(furlTransform.transforms);
    const tailMatrix = transformsToMatrix4(this._furlTransforms);
    this._tailCenter = new THREE.Vector3()
      .setFromMatrixPosition(tailMatrix);

    // Used for making explosion proportional
    // to the length of the wind turbine.
    this._lengthAlongXAxis = calculateLengthAlongXAxis(parts);

    this._partByName = {};
    parts.forEach((part) => {
      this._partByName[part.name] = part;
    });
    return parts;
  }

  getGroupConfigurations({ furlTransform }) {
    const { transforms } = furlTransform;
    const tailMatrix = transformsToMatrix4(transforms);
    const tailMatrixInverse = new THREE.Matrix4()
      .copy(tailMatrix)
      .invert();
    return [
      {
        createGroup: () => initializeTail(tailMatrix),
        partNames: TAIL_PARTS,
        configurePart: (part) => {
          part.matrix = tailMatrixInverse;
          part.matrixAutoUpdate = false;
        },
      },
    ];
  }

  handleRender(controller) {
    const tailHingeExplosionFactor = -10.5;
    this._furl(controller, tailHingeExplosionFactor);
  }

  explode(controller) {
    const statorExlosionFactor = 0;
    this._explodeAlongAlternatorTilt(
      controller, Part.Stator_ResinCast, statorExlosionFactor,
    );
    this._explodeAlongAlternatorTilt(
      controller, Part.Stator_Coils, statorExlosionFactor,
    );

    const bladeAssemblyFrontTriangleExplosionFactor = 4.5;
    this._explodeAlongAlternatorTilt(
      controller, Part.Blade_Assembly_FrontTriangle, bladeAssemblyFrontTriangleExplosionFactor,
    );
    const bladeAssemblyBackDiskExplosionFactor = 3;
    this._explodeAlongAlternatorTilt(
      controller, Part.Blade_Assembly_BackDisk, bladeAssemblyBackDiskExplosionFactor,
    );
    const rotorExlosionFactor = 1.5;
    this._explodeAlongAlternatorTilt(
      controller, Part.Rotor_ResinCast_Front, rotorExlosionFactor,
    );
    this._explodeAlongAlternatorTilt(
      controller, Part.Rotor_Disk_Front, rotorExlosionFactor,
    );
    this._explodeAlongAlternatorTilt(
      controller, Part.Rotor_Magnets_Front, rotorExlosionFactor,
    );
    this._explodeAlongAlternatorTilt(
      controller, Part.Rotor_ResinCast_Back, -rotorExlosionFactor,
    );
    this._explodeAlongAlternatorTilt(
      controller, Part.Rotor_Disk_Back, -rotorExlosionFactor,
    );
    this._explodeAlongAlternatorTilt(
      controller, Part.Rotor_Magnets_Back, -rotorExlosionFactor,
    );

    this._explodeAlongAlternatorTilt(
      controller, Part.Hub_Flange_Cover_Front, -2.8,
    );
    const flangeExplosionFactor = -3;
    this._explodeAlongAlternatorTilt(
      controller, Part.Studs_Hub, flangeExplosionFactor,
    );
    this._explodeAlongAlternatorTilt(
      controller, Part.Hub_Flange, flangeExplosionFactor,
    );
    this._explodeAlongAlternatorTilt(
      controller, Part.Hub_Flange_Cover_Back, -3.3,
    );
    this._explodeAlongAlternatorTilt(
      controller, Part.Hub_StubAxleShaft, -4.5,
    );

    const frameExplosionFactor = -6;
    this._explodeAlongAlternatorTilt(
      controller, Part.Frame, frameExplosionFactor,
    );
    this._explodeAlongAlternatorTilt(
      controller, Part.Studs_Frame, frameExplosionFactor,
    );

    this._explodeAlongAlternatorTilt(
      controller, Part.YawBearing, -7,
    );
    this._explodeAlongAlternatorTilt(
      controller, Part.Tail_Hinge_Inner, -8.25,
    );
  }

  getTooltipLabel(partName) {
    return {
      [Part.Blade_Assembly_BackDisk]: 'Back Rotor Hub',
      [Part.Blade_Assembly_FrontTriangle]: 'Front Rotor Hub',
      [Part.Stator_Coils]: 'Coils',
      [Part.Stator_ResinCast]: 'Stator Resin Cast',
      [Part.Rotor_Disk_Front]: 'Rotor Disk',
      [Part.Rotor_ResinCast_Front]: 'Rotor Resin Cast',
      [Part.Rotor_Magnets_Front]: 'Magnets',
      [Part.Rotor_Disk_Back]: 'Rotor Disk',
      [Part.Rotor_ResinCast_Back]: 'Rotor Resin Cast',
      [Part.Rotor_Magnets_Back]: 'Rotor Magnets',
      [Part.Hub_Flange]: 'Flange',
      [Part.Hub_Flange_Cover_Front]: 'Flange Cover',
      [Part.Hub_Flange_Cover_Back]: 'Flange Cover',
      [Part.Hub_StubAxleShaft]: 'Stub Axle Shaft',
      [Part.Studs_Hub]: 'Hub Studs',
      [Part.Frame]: 'Frame',
      [Part.YawBearing]: 'Yaw Bearing',
      [Part.Tail_Hinge_Inner]: 'Tail Hinge',
      [Part.Tail_Hinge_Outer]: 'Outer Tail Hinge',
      [Part.Tail_Boom_Pipe]: 'Boom Pipe',
      [Part.Tail_Boom_Support]: 'Boom Support',
      [Part.Tail_Stop_HighEnd]: 'High End Stop',
      [Part.Vane_Bracket_Top]: 'Vane Bracket',
      [Part.Vane_Bracket_Bottom]: 'Vane Bracket',
      [Part.Tail_Vane]: 'Vane',
      [Part.Studs_Frame]: 'Frame Studs',
    }[partName];
  }

  createMaterial(partName) {
    return createMaterial(partName, MaterialFactory.createSteel);
  }

  setupGui(gui, controller, onControllerChange, setupContext) {
    const maximumFurlAngle = setupContext.furlTransform.maximum_angle;
    gui.add(controller, 'Furl (in deg)', 0, maximumFurlAngle, 0.01)
      .onChange(onControllerChange);
  }

  getPartNamesByTransparencyLabel() {
    return {
      'Front Rotor Hub': [
        Part.Blade_Assembly_FrontTriangle
      ],
      'Back Rotor Hub': [
        Part.Blade_Assembly_BackDisk
      ],
      'Resin Cast': [
        Part.Stator_ResinCast,
        Part.Rotor_ResinCast_Front,
        Part.Rotor_ResinCast_Back,
      ],
      Coils: [Part.Stator_Coils],
      Magnets: [Part.Rotor_Magnets_Front, Part.Rotor_Magnets_Back],
      'Rotor Disks': [Part.Rotor_Disk_Front, Part.Rotor_Disk_Back],
      Hub: [
        Part.Hub_Flange,
        Part.Hub_Flange_Cover_Front,
        Part.Hub_Flange_Cover_Back,
        Part.Hub_StubAxleShaft,
        Part.Studs_Hub,
      ],
      Frame: [Part.Frame, Part.Studs_Frame],
      'Yaw Bearing': [Part.YawBearing],
      'Tail Hinge': [Part.Tail_Hinge_Inner],
      Boom: [
        Part.Tail_Hinge_Outer,
        Part.Tail_Boom_Pipe,
        Part.Tail_Boom_Support,
        Part.Tail_Stop_HighEnd,
        Part.Vane_Bracket_Top,
        Part.Vane_Bracket_Bottom,
      ],
      Vane: [Part.Tail_Vane],
    };
  }

  _furl(controller, tailHingeExplosionFactor) {
    const furlAngle = controller['Furl (in deg)'] * (Math.PI / 180);
    // the 2nd furl transform is the hinge
    this._furlTransforms[1].angle = furlAngle;
    // TODO: transformsToMatrix4 creates many Matrix4 instances per render.
    //       Consider reworking this to mutate a single Matrix4 instance,
    //       for memory performance.
    const transform = transformsToMatrix4(this._furlTransforms);
    const baseExplosionFactor = this._calculateBaseExplosionFactor();
    const explodeVector = getExplosionVector(
      controller, baseExplosionFactor * tailHingeExplosionFactor,
    );
    explodeVector.add(this._tailCenter);
    transform.setPosition(explodeVector);
    this._partByName[TAIL_NAME].matrix = transform;
  }

  _explodeAlongAlternatorTilt(controller, partName, explosionFactor) {
    if (this._partByName[partName]) {
      const baseExplosionFactor = this._calculateBaseExplosionFactor();
      const explosionVector = getExplosionVector(
        controller, baseExplosionFactor * explosionFactor,
      );
      this._partByName[partName].position.copy(explosionVector);
    }
  }

  _calculateBaseExplosionFactor() {
    return (
      this._lengthAlongXAxis / APPROXIMATE_LENGTH_OF_T_SHAPE_ALONG_X_AXIS
    );
  }
}

function initializeTail(tailMatrix) {
  const tail = new THREE.Group();
  tail.name = TAIL_NAME;
  tail.matrix = tailMatrix;
  tail.matrixAutoUpdate = false;
  return tail;
}

function calculateLengthAlongXAxis(parts) {
  const boundingBox = calculateBoundingBox(parts);
  const size = new THREE.Vector3();
  boundingBox.getSize(size);
  return size.x;
}

function calculateBoundingBox(parts) {
  const meshes = parts.map(findMeshes).flat();
  let minX = 0;
  let minY = 0;
  let minZ = 0;
  let maxX = 0;
  let maxY = 0;
  let maxZ = 0;
  meshes.forEach((mesh) => {
    mesh.geometry.computeBoundingBox();
    const bBox = mesh.geometry.boundingBox;

    // compute overall bbox
    minX = Math.min(minX, bBox.min.x);
    minY = Math.min(minY, bBox.min.y);
    minZ = Math.min(minZ, bBox.min.z);
    maxX = Math.max(maxX, bBox.max.x);
    maxY = Math.max(maxY, bBox.max.y);
    maxZ = Math.max(maxZ, bBox.max.z);
  });

  const boundingBoxMin = new THREE.Vector3(minX, minY, minZ);
  const boundingBoxMax = new THREE.Vector3(maxX, maxY, maxZ);
  return new THREE.Box3(boundingBoxMin, boundingBoxMax);
}

function getExplosionVector(controller, explosionFactor) {
  const explode = controller.Explode;
  return new THREE.Vector3(
    explode * explosionFactor * Math.cos(ALTERNATOR_TILT_ANGLE),
    explode * explosionFactor * Math.sin(ALTERNATOR_TILT_ANGLE),
    0,
  );
}

function createFrontLight() {
  const color = 0xFFFFFF;
  const directionalLightIntensity = 0.1;
  const light = new THREE.DirectionalLight(color, directionalLightIntensity);
  light.position.set(800, 100, -1000);
  light.target.position.set(-1000, 0, -150);
  light.name = 'FrontLight';
  return light;
}

function createBackLight() {
  const color = 0xFFFFFF;
  const directionalLightIntensity = 0.1;
  const light = new THREE.DirectionalLight(color, directionalLightIntensity);
  light.position.set(-2000, -100, 0);
  light.target.position.set(0, 0, 0);
  light.name = 'BackLight';
  return light;
}

function createAmbientLight() {
  const color = 0xFFFFFF;
  const intensity = 0.50;
  return new THREE.AmbientLight(color, intensity);
}

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export default WindTurbineVisualizer;
