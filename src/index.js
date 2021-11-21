/* eslint-env browser */
/* global DEBUG */
// TODO: Remove global debug variable in order to reduce coupling with esbuild
//       and make code more flexible. debug can be passed in options.
//       Should this be named development?
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { GUI } from 'three/examples/jsm/libs/dat.gui.module';
import CameraControls from 'camera-controls';

import makeGroupWiresTogether from './makeGroupWiresTogether';
import Material from './material';
import debounce from './debounce';
import createTooltip from './tooltip';
import flattenObject from './flattenObject';
import createLoadingScreen from './loading';
import transformsToMatrix4 from './transformsToMatrix4';
import findMeshes, { findMesh } from './findMeshes';
import Part from './part';
import ViewCube from './viewCube';

CameraControls.install({ THREE });

/**
 * Duplicated in openafpm-cad-core.
 *
 * We could possibly retrieve this from openafpm-cad-core
 * to avoid the duplication if it changes often.
 *
 * @see https://github.com/gbroques/openafpm-cad-core/blob/master/openafpm_cad_core/create_spreadsheet_document.py#L170-L173
 */
const ALTERNATOR_TILT_ANGLE = 4 * (Math.PI / 180);

const TAIL_PARTS = new Set([
  Part.Tail_Hinge_Outer,
  Part.Tail_Boom_Pipe,
  Part.Tail_Boom_Support,
  Part.Tail_Stop_HighEnd,
  Part.Vane_Bracket_Top,
  Part.Vane_Bracket_Bottom,
  Part.Tail_Vane,
]);

class OpenAfpmCadVisualization {
  constructor(options) {
    const {
      objUrl,
      rootDomElement,
      width,
      height,
      furlTransforms,
    } = options;

    this._camera = createCamera(width, height);
    this._renderer = createRenderer(width, height);

    this._cameraControls = createCameraControls(
      this._camera,
      this._renderer.domElement,
      () => this._render(),
    );
    this._clock = new THREE.Clock();
    this._windTurbine = {};
    this._controller = { Explode: 0, Furl: 0 };
    this._resetController = () => {
      this._controller.Explode = 0;
      this._controller.Furl = 0;
    };
    this._furlTransforms = furlTransforms;

    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this._tooltip = createTooltip();
    this.handleMouseMove = debounce(this._handleMouseMove, 15);
    // Use mutable array to keep track of visible meshes for tooltip performance.
    this._visibleMeshes = [];

    const rotateCameraTo = ({ azimuthAngle, polarAngle }) => {
      const enableTransition = false;
      this._cameraControls.rotateTo(azimuthAngle, polarAngle, enableTransition);
      this._render();
    };
    this._viewCube = new ViewCube(this._camera, rotateCameraTo);

    this._scene = new THREE.Scene();

    const lightByName = createLightByName();
    const lights = Object.values(lightByName);
    lights.forEach((light) => {
      this._scene.add(light);
      if (light.target) {
        light.target.name = `${light.name}Target`;
        light.target.updateMatrixWorld();
        this._scene.add(light.target);
      }
      // Uncomment below lines when debugging lights.
      // if (DEBUG && light.type === 'DirectionalLight') {
      //   const lightHelper = new THREE.DirectionalLightHelper(
      //     light, 100, 0x000000,
      //   );
      //   this._scene.add(lightHelper);
      // }
    });

    if (DEBUG) {
      const axesHelper = new THREE.AxesHelper(1000);
      axesHelper.name = 'Axes';
      this._scene.add(axesHelper);
    }

    const groupWiresTogether = makeGroupWiresTogether(width, height);

    const opacityDuration = 200; // in milliseconds
    const loadingScreen = createLoadingScreen(opacityDuration, height);
    rootDomElement.appendChild(loadingScreen);

    const tailMatrix = transformsToMatrix4(furlTransforms);
    this._tail = initializeTail(tailMatrix);

    this._tailCenter = new THREE.Vector3()
      .setFromMatrixPosition(tailMatrix);

    const tailMatrixInverse = new THREE.Matrix4()
      .copy(tailMatrix)
      .invert();

    loadObj(objUrl)
      .then(groupWiresTogether)
      .then((parts) => {
        loadingScreen.style.opacity = 0;
        setTimeout(() => {
          rootDomElement.removeChild(loadingScreen);
          const container = createAppContainer(opacityDuration);
          parts.forEach((part) => {
            const material = getMaterial(part.name);
            const mesh = findMesh(part);
            this._visibleMeshes.push(mesh);

            mesh.material = material;
            if (TAIL_PARTS.has(part.name)) {
              part.matrix = tailMatrixInverse;
              part.matrixAutoUpdate = false;
              this._tail.add(part);
            } else {
              this._scene.add(part);
              this._windTurbine[part.name] = part;
            }
          });
          this._scene.add(this._tail);
          this._windTurbine.Tail = this._tail;
          const updateCameraControls = false;
          const handleRender = debounce(() => this._render(updateCameraControls), 5);
          const [gui, cleanUpGui] = createGUI(
            this._cameraControls,
            this._windTurbine,
            this._visibleMeshes,
            this._controller,
            handleRender,
          );
          this._cleanUpGui = cleanUpGui;

          // Must append container to root DOM element before this._mount()
          rootDomElement.appendChild(container);
          this._mount(container, gui.domElement);
          container.style.opacity = '1';
          this._cameraControls.update();
          this._render();
        }, opacityDuration);
      }).catch(console.error);
  }

  resize(width, height) {
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    this._cameraControls.setViewport(0, 0, width, height);
    this._renderer.setSize(width, height);
    this._render();
  }

  _handleMouseMove(event) {
    if (this._tooltip.style.display !== 'none') {
      this._tooltip.style.left = `${event.clientX}px`;
      this._tooltip.style.top = `${event.clientY}px`;
    }

    const rect = this._renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this._mouse.x = (x / this._renderer.domElement.width) * 2 - 1;
    this._mouse.y = -(y / this._renderer.domElement.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this._camera);

    const recursive = false;
    const intersects = this._raycaster.intersectObjects(this._visibleMeshes, recursive);

    if (!intersects.length) {
      this._tooltip.style.display = 'none';
    } else {
      this._tooltip.style.display = 'block';

      const intersected = intersects[0];

      const label = getLabel(intersected.object.parent.name);
      this._tooltip.textContent = label;
    }
  }

  _mount(rootDomElement, guiDomElement) {
    const { top } = rootDomElement.getBoundingClientRect();
    const guiContainer = createGuiContainer(guiDomElement);
    guiContainer.style.top = `${top}px`;

    rootDomElement.appendChild(guiContainer);
    rootDomElement.appendChild(this._renderer.domElement);
    rootDomElement.appendChild(this._tooltip);
    rootDomElement.appendChild(this._viewCube.domElement);
  }

  /**
   * @see https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects
   */
  cleanUp() {
    // Resetting the controller and rendering once,
    // fixes an issue where tail furling would persist
    // when selecting different wind turbine variants.
    this._resetController();
    this._render();

    if (this._cleanUpGui) this._cleanUpGui();

    this._scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.material.dispose();
        object.geometry.dispose();
      }
    });
    this._renderer.dispose();
    this._cameraControls.dispose();
  }

  _render(updateCameraControls = true) {
    // update camera controls conditionally to avoid
    // visual jumping when toggling the visibility of parts.
    if (updateCameraControls) {
      const delta = this._clock.getDelta();
      this._cameraControls.update(delta);
    }
    if (this._isWindTurbineLoaded()) {
      const tailHingeExplosionFactor = -10.5;
      this._furl(tailHingeExplosionFactor);
      this._explode();
    }
    this._renderer.render(this._scene, this._camera);
    this._viewCube.update();
  }

  _isWindTurbineLoaded() {
    return Object.keys(this._windTurbine).length > 0;
  }

  _furl(tailHingeExplosionFactor) {
    const furlAngle = this._controller.Furl * (Math.PI / 180);
    // the 2nd furl transform is the hinge
    this._furlTransforms[1].angle = furlAngle;
    // TODO: transformsToMatrix4 creates many Matrix4 instances per render.
    //       Consider reworking this to mutate a single Matrix4 instance,
    //       for memory performance.
    const transform = transformsToMatrix4(this._furlTransforms);
    const explodeVector = this._getExplosionVector(tailHingeExplosionFactor);
    explodeVector.add(this._tailCenter);
    transform.setPosition(explodeVector);
    this._tail.matrix = transform;
  }

  _explode() {
    const statorExlosionFactor = 0;
    this._explodeAlongAlternatorTilt(Part.Stator_ResinCast, statorExlosionFactor);
    this._explodeAlongAlternatorTilt(Part.Stator_Coils, statorExlosionFactor);

    const rotorExlosionFactor = 1.5;
    this._explodeAlongAlternatorTilt(Part.Rotor_ResinCast_Front, rotorExlosionFactor);
    this._explodeAlongAlternatorTilt(Part.Rotor_Disk_Front, rotorExlosionFactor);
    this._explodeAlongAlternatorTilt(Part.Rotor_Magnets_Front, rotorExlosionFactor);
    this._explodeAlongAlternatorTilt(Part.Rotor_ResinCast_Back, -rotorExlosionFactor);
    this._explodeAlongAlternatorTilt(Part.Rotor_Disk_Back, -rotorExlosionFactor);
    this._explodeAlongAlternatorTilt(Part.Rotor_Magnets_Back, -rotorExlosionFactor);

    this._explodeAlongAlternatorTilt(Part.Hub_Flange_Cover_Front, -2.8);
    const flangeExplosionFactor = -3;
    this._explodeAlongAlternatorTilt(Part.Studs_Hub, flangeExplosionFactor);
    this._explodeAlongAlternatorTilt(Part.Hub_Flange, flangeExplosionFactor);
    this._explodeAlongAlternatorTilt(Part.Hub_Flange_Cover_Back, -3.3);
    this._explodeAlongAlternatorTilt(Part.Hub_StubAxleShaft, -4.5);

    const frameExplosionFactor = -6;
    this._explodeAlongAlternatorTilt(Part.Frame, frameExplosionFactor);
    this._explodeAlongAlternatorTilt(Part.Studs_Frame, frameExplosionFactor);

    this._explodeAlongAlternatorTilt(Part.YawBearing, -7);
    this._explodeAlongAlternatorTilt(Part.Tail_Hinge_Inner, -8.25);
  }

  _explodeAlongAlternatorTilt(property, explosionFactor) {
    if (this._windTurbine[property]) {
      const explosionVector = this._getExplosionVector(explosionFactor);
      this._windTurbine[property].position.copy(explosionVector);
    }
  }

  _getExplosionVector(explosionFactor) {
    const explode = this._controller.Explode;
    return new THREE.Vector3(
      explode * explosionFactor * Math.cos(ALTERNATOR_TILT_ANGLE),
      explode * explosionFactor * Math.sin(ALTERNATOR_TILT_ANGLE),
      0,
    );
  }
}

function createGuiContainer(guiDomElement) {
  const autoPlaceContainer = window.document.createElement('div');
  const datGuiCssNamespace = guiDomElement.classList[0];
  autoPlaceContainer.classList.add(datGuiCssNamespace);
  autoPlaceContainer.classList.add(GUI.CLASS_AUTO_PLACE_CONTAINER);
  guiDomElement.classList.add(GUI.CLASS_AUTO_PLACE);
  autoPlaceContainer.appendChild(guiDomElement);
  return autoPlaceContainer;
}

function createCamera(width, height) {
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
 * TODO
 * Consider sharing renderer across different wind turbine visualizations to avoid:
 * "WARNING: Too many active WebGL contexts. Oldest context will be lost."
 * @see https://stackoverflow.com/questions/21548247/clean-up-threejs-webgl-contexts
 *
 * Consider adding a "set" or "populate scene" method.
 */
function createRenderer(width, height) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  return renderer;
}

/**
 * @see https://github.com/yomotsu/camera-controls
 */
function createCameraControls(camera, domElement, onChange) {
  const controls = new CameraControls(camera, domElement);
  controls.maxDistance = 5000;
  controls.minDistance = 250;
  controls.addEventListener('control', onChange);
  controls.addEventListener('transitionstart', onChange);
  return controls;
}

function createLightByName() {
  return {
    ambientLight: createAmbientLight(),
    frontLight: createFrontLight(),
    backLight: createBackLight(),
  };
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

function getMaterial(partName) {
  switch (partName) {
    case Part.Stator_ResinCast:
    case Part.Rotor_ResinCast_Front:
    case Part.Rotor_ResinCast_Back:
      return Material.RESIN;
    case Part.Stator_Coils:
      return Material.COPPER;
    case Part.Rotor_Magnets_Front:
    case Part.Rotor_Magnets_Back:
      return Material.MAGNET;
    case Part.Tail_Vane:
      return Material.WOOD;
    default:
      return Material.STEEL;
  }
}

function createGUI(
  cameraControls,
  windTurbine,
  visibleMeshes,
  controller,
  onControllerChange,
) {
  const gui = new GUI({ autoPlace: false });
  gui.closed = false;

  const obj = {
    'Reset View': () => {
      cameraControls.reset(false);
      cameraControls.update();
      onControllerChange();
    },
  };
  gui.add(obj, 'Reset View');
  gui.add(controller, 'Explode', 0, 100)
    .onChange(onControllerChange);
  gui.add(controller, 'Furl', 0, 105)
    .onChange(onControllerChange);

  const guiConfiguration = {
    'Resin Cast': [
      Part.Stator_ResinCast,
      Part.Rotor_ResinCast_Front,
      Part.Rotor_ResinCast_Back,
    ],
    Coils: [Part.Stator_Coils],
    'Rotor Disk': [Part.Rotor_Disk_Front, Part.Rotor_Disk_Back],
    Magnets: [Part.Rotor_Magnets_Front, Part.Rotor_Magnets_Back],
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
    Tail: ['Tail'],
  };

  const partNamesByVisibilityLabel = flattenObject(guiConfiguration);

  const visibilityLabels = Object.keys(partNamesByVisibilityLabel);
  const visibilityController = visibilityLabels.reduce((acc, visibilityLabel) => (
    { ...acc, [visibilityLabel]: true }
  ), {});

  const entries = Object.entries(partNamesByVisibilityLabel);
  const changeHandlerByVisibilityLabel = entries.reduce((accumulator, entry) => {
    const [visibilityLabel, partNames] = entry;
    return {
      ...accumulator,
      [visibilityLabel]: (value) => {
        partNames.forEach((partName) => {
          const part = windTurbine[partName];
          part.visible = value;
          if (value) {
            const meshes = findMeshes(part);
            if (!meshes) {
              console.warn(`No meshes found for part '${partName}'`);
            } else {
              visibleMeshes.push(...meshes);
            }
          } else {
            const removeVisibleMesh = (meshName) => {
              const index = visibleMeshes.findIndex((m) => m.name === `${meshName}Mesh`);
              if (index < 0) {
                console.warn(`No mesh found for part '${meshName}'`);
              } else {
                visibleMeshes.splice(index, 1);
              }
            };
            const meshNamesByPartName = {
              Tail: TAIL_PARTS,
            };
            if (meshNamesByPartName[partName]) {
              meshNamesByPartName[partName].forEach(removeVisibleMesh);
            } else {
              removeVisibleMesh(partName);
            }
          }
          onControllerChange();
        });
      },
    };
  }, {});
  const visibilityGui = gui.addFolder('Visibility');
  Object.entries(guiConfiguration).forEach(([key, value]) => {
    const changeHandler = changeHandlerByVisibilityLabel[key];
    if (changeHandler) {
      visibilityGui.add(visibilityController, key).onChange(changeHandler);
    } else {
      // TODO
      // Consider removing subgui or sub-folder support for Visiblity folder,
      // as it complicates "destroying the GUI".
      // https://github.com/dataarts/dat.gui/issues/177#issuecomment-366414708
      const subgui = visibilityGui.addFolder(key);
      const subVisibilityLabels = Object.keys(value);
      subVisibilityLabels.forEach((visibilityLabel) => {
        const ch = changeHandlerByVisibilityLabel[visibilityLabel];
        subgui.add(visibilityController, visibilityLabel).onChange(ch);
      });
    }
  });
  const cleanUp = () => {
    gui.removeFolder(visibilityGui);
    gui.destroy();
  };
  return [gui, cleanUp];
}

function loadObj(url) {
  return new Promise((resolve, reject) => {
    const objLoader = new OBJLoader();
    objLoader.load(url, resolve, handleProgress, reject);
  });
}

function handleProgress(xhr) {
  const url = new URL(xhr.target.responseURL);
  const filename = url.pathname.slice(1);
  const progressPercentage = (xhr.loaded / xhr.total) * 100;
  if (DEBUG) {
    console.log(`index.js: ${filename} ${progressPercentage}% loaded.`);
  }
}

function createAppContainer(opacityDuration) {
  const container = window.document.createElement('div');
  container.style = `opacity: 0; transition: opacity ${opacityDuration}ms ease-in-out;`;
  return container;
}

function initializeTail(tailMatrix) {
  const tail = new THREE.Group();
  tail.name = 'Tail';
  tail.matrix = tailMatrix;
  tail.matrixAutoUpdate = false;
  return tail;
}

function getLabel(partName) {
  return {
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

module.exports = OpenAfpmCadVisualization;
