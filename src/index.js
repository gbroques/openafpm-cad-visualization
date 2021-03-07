/* eslint-env browser */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Stats from 'three/examples/jsm/libs/stats.module';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { GUI } from 'three/examples/jsm/libs/dat.gui.module';
import Part from './part';
import Material from './material';

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
    this._stats = Stats();
    this._scene = new THREE.Scene();

    const lights = Object.values(lightByName);
    lights.forEach((light) => {
      this._scene.add(light);
      if (light.target) {
        this._scene.add(light.target);
      }
    });

    const axesHelper = new THREE.AxesHelper(1000);
    this._scene.add(axesHelper);

    const materialByPartName = createMaterialByPartName();

    loadObj(objUrl).then((object) => {
      Object.entries(materialByPartName).forEach(([partName, material]) => {
        const mesh = object.getObjectByName(partName);
        mesh.material = material;
        const lineSegments = createLineSegments(mesh.geometry);
        this._windTurbine[partName] = new Part(mesh, lineSegments);
        this._scene.add(lineSegments);
      });
      this._scene.add(object);
      this._animate();
    }).catch(console.error);

    const gui = createGUI(this._windTurbine, this._explosionController);
    this._mount(rootDomElement, gui.domElement);
  }

  resize(width, height) {
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(width, height);
  }

  _mount(rootDomElement, guiDomElement) {
    const guiContainer = createGuiContainer(guiDomElement);

    rootDomElement.appendChild(guiContainer);
    rootDomElement.appendChild(this._renderer.domElement);
    rootDomElement.appendChild(this._stats.dom);
  }

  _animate() {
    this._orbitControls.update();
    this._stats.update();
    this._render();
    window.requestAnimationFrame(() => this._animate());
  }

  _render() {
    this._cameraLight.position.set(
      this._camera.position.x,
      this._camera.position.y,
      this._camera.position.z,
    );
    if (Object.keys(this._windTurbine).length) {
      const explode = this._explosionController.Explode;
      const statorExlosionFactor = 0;
      this._windTurbine.StatorResinCast.x = explode * statorExlosionFactor;
      this._windTurbine.Coils.x = explode * statorExlosionFactor;
      const rotorExlosionFactor = 0.5;
      this._windTurbine.BottomRotorResinCast.x = explode * rotorExlosionFactor;
      this._windTurbine.BottomDisc1.x = explode * rotorExlosionFactor;
      this._windTurbine.BottomMagnets.x = explode * rotorExlosionFactor;
      this._windTurbine.TopRotorResinCast.x = explode * -rotorExlosionFactor;
      this._windTurbine.TopDisc1.x = explode * -rotorExlosionFactor;
      this._windTurbine.TopMagnets.x = explode * -rotorExlosionFactor;
      this._windTurbine.Threads.x = explode * -0.7;
      this._windTurbine.Hub.x = explode * -1;
      this._windTurbine.Frame.x = explode * -2;
    }
    this._renderer.render(this._scene, this._camera);
  }
}

function createLineSegments(meshGeometry) {
  const edgeGeometry = new THREE.EdgesGeometry(meshGeometry);
  return new THREE.LineSegments(
    edgeGeometry, new THREE.LineBasicMaterial({ color: 0x000000 }),
  );
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
  const fieldOfView = 45;
  const aspectRatio = width / height;
  const near = 0.1;
  const far = 2000;
  const camera = new THREE.PerspectiveCamera(
    fieldOfView,
    aspectRatio,
    near,
    far,
  );
  camera.position.set(0, 0, -700);
  return camera;
}

function createRenderer(width, height) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  return renderer;
}

function createOrbitControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.maxDistance = 1000;
  controls.minDistance = 250;
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
  const color = 0xffffff;
  const intensity = 0.3;
  return new THREE.AmbientLight(color, intensity);
}

function createMaterialByPartName() {
  return {
    StatorResinCast: Material.RESIN,
    Coils: Material.COPPER,
    BottomRotorResinCast: Material.RESIN,
    BottomDisc1: Material.METAL,
    BottomMagnets: Material.MAGNET,
    TopRotorResinCast: Material.RESIN,
    TopDisc1: Material.METAL,
    TopMagnets: Material.MAGNET,
    Frame: Material.METAL,
    Hub: Material.METAL,
    Threads: Material.METAL,
  };
}

function createGUI(windTurbine, explosionController) {
  const gui = new GUI({ autoPlace: false });

  const partNamesByVisibilityLabel = {
    'Stator Resin Cast': ['StatorResinCast'],
    Coils: ['Coils'],
    'Rotor Resin Cast': ['BottomRotorResinCast', 'TopRotorResinCast'],
    'Rotor Disc': ['BottomDisc1', 'TopDisc1'],
    'Rotor Magnets': ['BottomMagnets', 'TopMagnets'],
    Hub: ['Hub'],
    Threads: ['Threads'],
    Frame: ['Frame'],
  };

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
          windTurbine[partName].visible = value;
        });
      },
    };
  }, {});

  Object.entries(changeHandlerByVisibilityLabel).forEach(([visibilityLabel, changeHandler]) => {
    gui.add(visibilityController, visibilityLabel).onChange(changeHandler);
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
  console.log(`index.js: ${filename} ${progressPercentage}% loaded.`);
}

module.exports = OpenAfpmCadVisualization;
