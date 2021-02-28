/* eslint-env browser */
import * as THREE from '/build/three.module.js';
import { OrbitControls } from '/jsm/controls/OrbitControls.js';
import Stats from '/jsm/libs/stats.module.js';
import { OBJLoader } from '/jsm/loaders/OBJLoader.js';
import { MTLLoader } from '/jsm/loaders/MTLLoader.js';
import { GUI } from '/jsm/libs/dat.gui.module.js';

const gui = new GUI();

const windTurbine = {};

const partNames = [
  'StatorResinCast',
  'BottomRotorResinCast',
  'BottomDisc1',
  'TopRotorResinCast',
  'TopDisc1',
  'Hub',
  'Threads',
  'Frame',
];

const visibilityController = partNames.reduce((acc, name) => (
  { ...acc, [name]: true }
), {});

partNames.forEach((name) => {
  gui.add(visibilityController, name).onChange((value) => {
    windTurbine[name].visible = value;
  });
});

const explosionController = {
  Explode: 0,
};

gui.add(explosionController, 'Explode', 0, 100);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const fieldOfView = 45;
const aspectRatio = window.innerWidth / window.innerHeight;
const near = 0.1;
const far = 2000;
const camera = new THREE.PerspectiveCamera(
  fieldOfView,
  aspectRatio,
  near,
  far,
);
camera.position.set(0, 0, -700);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// X - Red
// Y - Green
// Z - Blue
scene.add(new THREE.AxesHelper(1000));

const color = 0xFFFFFF;
const directionalLightIntensity = 0.15;
const cameraLight = new THREE.DirectionalLight(color, directionalLightIntensity);
cameraLight.target.position.set(0, 0, 0);
scene.add(cameraLight);
scene.add(cameraLight.target);

const sun = new THREE.DirectionalLight(color, 0.1);
sun.position.set(-1000, 1000, -1000);
sun.target.position.set(0, 0, 0);
scene.add(sun);
scene.add(sun.target);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.maxDistance = 1000;
controls.minDistance = 250;

const path = '';
const format = '.jpg';
const urls = [
  `${path}px${format}`, `${path}nx${format}`,
  `${path}py${format}`, `${path}ny${format}`,
  `${path}pz${format}`, `${path}nz${format}`,
];

const reflectionCube = new THREE.CubeTextureLoader().load(urls);
reflectionCube.encoding = THREE.sRGBEncoding;
const metalMaterial = new THREE.MeshStandardMaterial({
  color: 0xFFFFFF,
  metalness: 0.8,
  roughness: 0.5,
  envMapIntensity: 0.7,
  envMap: reflectionCube,
});

const resinMaterial = new THREE.MeshPhongMaterial({
  color: 0x3c8571,
  opacity: 0.90,
  shininess: 10,
  transparent: true,
});

const Material = {
  METAL: metalMaterial,
  RESIN: resinMaterial,
};

const materialByName = {
  StatorResinCast: Material.RESIN,
  BottomRotorResinCast: Material.RESIN,
  BottomDisc1: Material.METAL,
  TopRotorResinCast: Material.RESIN,
  TopDisc1: Material.METAL,
  Frame: Material.METAL,
  Hub: Material.METAL,
  Threads: Material.METAL,
};

loadObj('wind-turbine.obj').then((object) => {
  object.position.set(0, 0, 0);

  Object.entries(materialByName).forEach(([name, material]) => {
    const mesh = object.getObjectByName(name);
    mesh.material = material;
    windTurbine[name] = mesh;
  });
  scene.add(object);
}).catch(console.error);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}, false);

const stats = Stats();
document.body.appendChild(stats.dom);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  render();
  stats.update();
}

let explode = explosionController.Explode;
function render() {
  renderer.render(scene, camera);
  cameraLight.position.set(camera.position.x, camera.position.y, camera.position.z);
  if (Object.keys(windTurbine).length && explode !== explosionController.Explode) {
    explode = explosionController.Explode;
    windTurbine.StatorResinCast.position.x = explode * 0;
    windTurbine.BottomRotorResinCast.position.x = explode * 0.25;
    windTurbine.BottomDisc1.position.x = explode * 0.25;
    windTurbine.TopRotorResinCast.position.x = explode * -0.25;
    windTurbine.TopDisc1.position.x = explode * -0.25;
    windTurbine.Threads.position.x = explode * -0.5;
    windTurbine.Hub.position.x = explode * -1;
    windTurbine.Frame.position.x = explode * -2;
  }
}

animate();

function loadMtl(name) {
  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();
    mtlLoader.load(name, resolve, handleProgress, reject);
  });
}

function loadObj(name, materials) {
  return new Promise((resolve, reject) => {
    const objLoader = new OBJLoader();
    if (materials) {
      objLoader.setMaterials(materials);
    }
    objLoader.load(name, resolve, handleProgress, reject);
  });
}

function handleProgress(xhr) {
  const url = new URL(xhr.target.responseURL);
  const filename = url.pathname.slice(1);
  const progressPercentage = (xhr.loaded / xhr.total) * 100;
  console.log(`index.js: ${filename} ${progressPercentage}% loaded.`);
}
