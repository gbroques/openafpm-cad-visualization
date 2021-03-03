/* eslint-env browser */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Stats from 'three/examples/jsm/libs/stats.module';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { GUI } from 'three/examples/jsm/libs/dat.gui.module';

let scene;
let camera;
let renderer;
let windTurbine;
let explosionController;
let controls;
let stats;
let cameraLight;

class Part {
  constructor(mesh, lineSegments) {
    this.mesh = mesh;
    this.lineSegments = lineSegments;
  }

  set visible(value) {
    this.mesh.visible = value;
    this.lineSegments.visible = value;
  }

  set x(value) {
    this.mesh.position.x = value;
    this.lineSegments.position.x = value;
  }
}

function init() {
  windTurbine = {};

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const fieldOfView = 45;
  const aspectRatio = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 2000;
  camera = new THREE.PerspectiveCamera(
    fieldOfView,
    aspectRatio,
    near,
    far,
  );
  camera.position.set(0, 0, -700);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  const color = 0xFFFFFF;
  const directionalLightIntensity = 0.15;
  cameraLight = new THREE.DirectionalLight(color, directionalLightIntensity);
  cameraLight.target.position.set(0, 0, 0);
  scene.add(cameraLight);
  scene.add(cameraLight.target);

  const sun = new THREE.DirectionalLight(color, 0.1);
  sun.position.set(-1000, 1000, -1000);
  sun.target.position.set(0, 0, 0);
  scene.add(sun);
  scene.add(sun.target);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.maxDistance = 1000;
  controls.minDistance = 250;

  const metalMaterial = new THREE.MeshPhongMaterial({
    color: 0xc0c1c8,
    shininess: 10,
    specular: 0xeaeaed,
    reflectivity: 0.5,
  });

  const resinMaterial = new THREE.MeshPhongMaterial({
    color: 0x77aa9c,
    opacity: 0.90,
    shininess: 0,
    reflectivity: 0,
    transparent: true,
  });

  const magnetMaterial = new THREE.MeshPhongMaterial({
    color: 0x625e62,
    shininess: 10,
  });

  const Material = {
    METAL: metalMaterial,
    RESIN: resinMaterial,
    MAGNET: magnetMaterial,
  };

  const materialByName = {
    StatorResinCast: Material.RESIN,
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

  loadObj('wind-turbine.obj').then((object) => {
    object.position.set(0, 0, 0);

    Object.entries(materialByName).forEach(([name, material]) => {
      const mesh = object.getObjectByName(name);
      mesh.material = material;
      const edgeGeometry = new THREE.EdgesGeometry(mesh.geometry);
      const lineSegments = new THREE.LineSegments(
        edgeGeometry, new THREE.LineBasicMaterial({ color: 0x000000 }),
      );
      windTurbine[name] = new Part(mesh, lineSegments);

      scene.add(lineSegments);
    });
    scene.add(object);
  }).catch(console.error);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, false);

  stats = Stats();

  scene.add(new THREE.AxesHelper(1000));

  initGUI(windTurbine);

  document.body.appendChild(renderer.domElement);
  document.body.appendChild(stats.dom);
}

function animate() {
  window.requestAnimationFrame(animate);
  controls.update();
  stats.update();
  render();
}

function render() {
  cameraLight.position.set(camera.position.x, camera.position.y, camera.position.z);
  if (Object.keys(windTurbine).length) {
    const explode = explosionController.Explode;
    windTurbine.StatorResinCast.x = explode * 0;
    const rotorExlosionFactor = 0.5;
    windTurbine.BottomRotorResinCast.x = explode * rotorExlosionFactor;
    windTurbine.BottomDisc1.x = explode * rotorExlosionFactor;
    windTurbine.BottomMagnets.x = explode * rotorExlosionFactor;
    windTurbine.TopRotorResinCast.x = explode * -rotorExlosionFactor;
    windTurbine.TopDisc1.x = explode * -rotorExlosionFactor;
    windTurbine.TopMagnets.x = explode * -rotorExlosionFactor;
    windTurbine.Threads.x = explode * -0.7;
    windTurbine.Hub.x = explode * -1;
    windTurbine.Frame.x = explode * -2;
  }
  renderer.render(scene, camera);
}

function initGUI(windTurbine) {
  const gui = new GUI();

  const partNamesByVisibilityLabel = {
    'Stator Resin Cast': ['StatorResinCast'],
    'Rotor Resin Cast': ['BottomRotorResinCast', 'TopRotorResinCast'],
    'Rotor Disc': ['BottomDisc1', 'TopDisc1'],
    'Rotor Magnet': ['BottomMagnets', 'TopMagnets'],
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

  explosionController = {
    Explode: 0,
  };

  Object.entries(changeHandlerByVisibilityLabel).forEach(([visibilityLabel, changeHandler]) => {
    gui.add(visibilityController, visibilityLabel).onChange(changeHandler);
  });
  gui.add(explosionController, 'Explode', 0, 100);
}

init();
animate();

function loadObj(name) {
  return new Promise((resolve, reject) => {
    const objLoader = new OBJLoader();
    objLoader.load(name, resolve, handleProgress, reject);
  });
}

function handleProgress(xhr) {
  const url = new URL(xhr.target.responseURL);
  const filename = url.pathname.slice(1);
  const progressPercentage = (xhr.loaded / xhr.total) * 100;
  console.log(`index.js: ${filename} ${progressPercentage}% loaded.`);
}
