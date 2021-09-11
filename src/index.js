/* eslint-env browser */
/* global DEBUG */
// TODO: Remove global debug variable in order to reduce coupling with esbuild
//       and make code more flexible. debug can be passed in options.
//       Should this be named development?
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Stats from 'three/examples/jsm/libs/stats.module';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { GUI } from 'three/examples/jsm/libs/dat.gui.module';
import makeGroupWiresTogether from './makeGroupWiresTogether';
import Material from './material';
import debounce from './debounce';
import createTooltip from './tooltip';
import flattenObject from './flattenObject';
import createLoadingScreen from './loading';

const DEFAULT_ORBIT_CONTROLS_X = -1100;

class OpenAfpmCadVisualization {
  constructor(options) {
    const {
      objUrl,
      rootDomElement,
      width,
      height,
    } = options;

    this._camera = createCamera(width, height);
    this._renderer = createRenderer(width, height);
    this._orbitControls = createOrbitControls(this._camera, this._renderer.domElement);
    this._windTurbine = {};
    this._explosionController = { Explode: 0 };

    const lightByName = createLightByName();
    this._cameraLight = lightByName.cameraLight;
    if (DEBUG) {
      this._stats = Stats();
    }

    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this._tooltip = createTooltip();
    this.handleMouseMove = debounce(this._handleMouseMove, 15);
    // Use mutable array to keep track of visible meshes for tooltip performance.
    this._visibleMeshes = [];

    this._scene = new THREE.Scene();

    const lights = Object.values(lightByName);
    lights.forEach((light) => {
      this._scene.add(light);
      if (light.target) {
        this._scene.add(light.target);
      }
    });

    if (DEBUG) {
      const axesHelper = new THREE.AxesHelper(1000);
      axesHelper.name = 'Axes';
      this._scene.add(axesHelper);
    }

    const materialByPartName = createMaterialByPartName();

    const groupWiresTogether = makeGroupWiresTogether(width, height);

    const opacityDuration = 200; // in milliseconds
    const loadingScreen = createLoadingScreen(opacityDuration, height);
    rootDomElement.appendChild(loadingScreen);
    loadObj(objUrl)
      .then(groupWiresTogether)
      .then((parts) => {
        loadingScreen.style.opacity = 0;
        setTimeout(() => {
          rootDomElement.removeChild(loadingScreen);
          const container = createAppContainer(opacityDuration);
          parts.forEach((part) => {
            const material = materialByPartName[part.name];
            const mesh = part.children.find((c) => c.name.endsWith('Mesh'));
            this._visibleMeshes.push(mesh);
            mesh.material = material;
            this._scene.add(part);
            this._windTurbine[part.name] = part;
          });
          const gui = createGUI(
            this._orbitControls,
            this._windTurbine,
            this._visibleMeshes,
            this._explosionController,
          );
          // Must append container to root DOM element before this._mount()
          rootDomElement.appendChild(container);
          this._mount(container, gui.domElement);
          container.style.opacity = '1';
          this._animate();
        }, opacityDuration);
      }).catch(console.error);
  }

  resize(width, height) {
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(width, height);
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
  }

  _mount(rootDomElement, guiDomElement) {
    const { top } = rootDomElement.getBoundingClientRect();
    const guiContainer = createGuiContainer(guiDomElement);
    guiContainer.style.top = `${top}px`;

    rootDomElement.appendChild(guiContainer);
    rootDomElement.appendChild(this._renderer.domElement);
    if (DEBUG) {
      this._stats.dom.style.top = `${top}px`;
      rootDomElement.appendChild(this._stats.dom);
    }
    rootDomElement.appendChild(this._tooltip);
  }

  _animate() {
    this._orbitControls.update();
    if (DEBUG) {
      this._stats.update();
    }
    this._render();
    this._animationFrameRequestId = window.requestAnimationFrame(() => this._animate());
  }

  cleanUp() {
    this._scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.material.dispose();
        object.geometry.dispose();
      }
    });
    window.cancelAnimationFrame(this._animationFrameRequestId);
  }

  _render() {
    this._positionCameraLight();
    if (this._isWindTurbineLoaded()) {
      this._explode();
    }

    this._raycaster.setFromCamera(this._mouse, this._camera);

    const recursive = false;
    const intersects = this._raycaster.intersectObjects(this._visibleMeshes, recursive);

    if (!intersects.length) {
      this._tooltip.style.display = 'none';
    } else {
      this._tooltip.style.display = 'block';

      const intersected = intersects[0];

      const label = separatePascalCaseBySpaces(intersected.object.parent.name);
      this._tooltip.textContent = label;
    }
    this._renderer.render(this._scene, this._camera);
  }

  _positionCameraLight() {
    this._cameraLight.position.set(
      this._camera.position.x,
      this._camera.position.y,
      this._camera.position.z,
    );
  }

  _isWindTurbineLoaded() {
    return Object.keys(this._windTurbine).length > 0;
  }

  _explode() {
    const statorExlosionFactor = 0;
    this._explodeX('StatorResinCast', statorExlosionFactor);
    this._explodeX('Coils', statorExlosionFactor);

    const rotorExlosionFactor = 0.5;
    this._explodeX('BottomRotorResinCast', rotorExlosionFactor);
    this._explodeX('BottomRotorDisk', rotorExlosionFactor);
    this._explodeX('BottomMagnets', rotorExlosionFactor);
    this._explodeX('TopRotorResinCast', -rotorExlosionFactor);
    this._explodeX('TopRotorDisk', -rotorExlosionFactor);
    this._explodeX('TopMagnets', -rotorExlosionFactor);

    this._explodeX('HubThreads', -0.7);
    this._explodeX('RotorSideFlangeCover', -1);
    this._explodeX('Flange', -1.2);
    this._explodeX('FrameSideFlangeCover', -1.4);
    this._explodeX('StubAxleShaft', -1.6);

    const frameExplosionFactor = -2.5;
    this._explodeX('Frame', frameExplosionFactor);
    this._explodeX('StatorMountingStuds', frameExplosionFactor);

    this._explodeX('YawBearing', -3.4);
    this._explodeX('TailHinge', -4.3);
    this._explodeX('TailBoom', -5);
    this._explodeX('TailVane', -7);
  }

  _explodeX(property, explosionFactor) {
    const explode = this._explosionController.Explode;
    if (this._windTurbine[property]) {
      this._windTurbine[property].position.x = explode * explosionFactor;
    }
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
  camera.position.set(1000, 150, -2000);
  return camera;
}

function createRenderer(width, height) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  return renderer;
}

function createOrbitControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.maxDistance = 5000;
  controls.minDistance = 250;
  controls.target.set(DEFAULT_ORBIT_CONTROLS_X, 0, 0);
  return controls;
}

function createLightByName() {
  return {
    cameraLight: createCameraLight(),
    ambientLight: createAmbientLight(),
    sunLight: createSunLight(),
  };
}

function createCameraLight() {
  const color = 0xFFFFFF;
  const directionalLightIntensity = 0.15;
  const cameraLight = new THREE.DirectionalLight(color, directionalLightIntensity);
  cameraLight.target.position.set(0, 0, 0);
  return cameraLight;
}

function createSunLight() {
  const color = 0xFFFFFF;
  const directionalLightIntensity = 0.1;
  const sunLight = new THREE.DirectionalLight(color, directionalLightIntensity);
  sunLight.position.set(-1000, 1000, -1000);
  sunLight.target.position.set(0, 0, 0);
  return sunLight;
}

function createAmbientLight() {
  const color = 0xFFFFFF;
  const intensity = 0.3;
  return new THREE.AmbientLight(color, intensity);
}

function createMaterialByPartName() {
  return {
    StatorResinCast: Material.RESIN,
    StatorMountingStuds: Material.STEEL,
    Coils: Material.COPPER,
    BottomRotorResinCast: Material.RESIN,
    BottomRotorDisk: Material.STEEL,
    BottomMagnets: Material.MAGNET,
    TopRotorResinCast: Material.RESIN,
    TopRotorDisk: Material.STEEL,
    TopMagnets: Material.MAGNET,
    Frame: Material.STEEL,
    Flange: Material.STEEL,
    RotorSideFlangeCover: Material.STEEL,
    FrameSideFlangeCover: Material.STEEL,
    StubAxleShaft: Material.STEEL,
    HubThreads: Material.STEEL,
    YawBearing: Material.STEEL,
    TailHinge: Material.STEEL,
    TailBoom: Material.STEEL,
    TailVane: Material.WOOD,
  };
}

function createGUI(orbitControls, windTurbine, visibleMeshes, explosionController) {
  const gui = new GUI({ autoPlace: false });
  gui.closed = true;

  const obj = {
    'Reset View': () => {
      orbitControls.reset();
      orbitControls.target.set(DEFAULT_ORBIT_CONTROLS_X, 0, 0);
    },
  };
  gui.add(obj, 'Reset View');

  const guiConfiguration = {
    'Stator Resin Cast': ['StatorResinCast'],
    Studs: ['StatorMountingStuds'],
    Coils: ['Coils'],
    'Rotor Resin Cast': ['BottomRotorResinCast', 'TopRotorResinCast'],
    'Rotor Disk': ['BottomRotorDisk', 'TopRotorDisk'],
    'Rotor Magnets': ['BottomMagnets', 'TopMagnets'],
    Hub: {
      Flange: ['Flange'],
      'Rotor Side Flange Cover': ['RotorSideFlangeCover'],
      'Frame Side Flange Cover': ['FrameSideFlangeCover'],
      'Stub Axle Shaft': ['StubAxleShaft'],
    },
    Threads: ['HubThreads'],
    Frame: ['Frame'],
    'Yaw Bearing': ['YawBearing'],
    'Tail Hinge': ['TailHinge'],
    'Tail Boom': ['TailBoom'],
    'Tail Vane': ['TailVane'],
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
            const mesh = part.children.find((c) => c.name.endsWith('Mesh'));
            if (!mesh) {
              console.warn(`No mesh found for part '${partName}'`);
            } else {
              visibleMeshes.push(mesh);
            }
          } else {
            const index = visibleMeshes.findIndex((m) => m.name === `${partName}Mesh`);
            if (index < 0) {
              console.warn(`No mesh found for part '${partName}'`);
            } else {
              visibleMeshes.splice(index, 1);
            }
          }
        });
      },
    };
  }, {});
  Object.entries(guiConfiguration).forEach(([key, value]) => {
    const changeHandler = changeHandlerByVisibilityLabel[key];
    if (changeHandler) {
      gui.add(visibilityController, key).onChange(changeHandler);
    } else {
      const subgui = gui.addFolder(key);
      const subVisibilityLabels = Object.keys(value);
      subVisibilityLabels.forEach((visibilityLabel) => {
        const ch = changeHandlerByVisibilityLabel[visibilityLabel];
        subgui.add(visibilityController, visibilityLabel).onChange(ch);
      });
    }
  });
  gui.add(explosionController, 'Explode', 0, 100);
  return gui;
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

function separatePascalCaseBySpaces(pascalCaseWord) {
  return pascalCaseWord.replace(/([A-Z])/g, ' $1').trim();
}

function createAppContainer(opacityDuration) {
  const container = window.document.createElement('div');
  container.style = `opacity: 0; transition: opacity ${opacityDuration}ms ease-in-out;`;
  return container;
}

module.exports = OpenAfpmCadVisualization;
