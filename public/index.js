/* eslint-env browser */
import * as THREE from '/build/three.module.js';
import { OrbitControls } from '/jsm/controls/OrbitControls.js';
import Stats from '/jsm/libs/stats.module.js';
import { OBJLoader } from '/jsm/loaders/OBJLoader.js';
import { MTLLoader } from '/jsm/loaders/MTLLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

// let cube = null;

// loadMtl('cube.mtl').then((materialCreator) => {
//   materialCreator.preload();
//   console.log('materialCreator', materialCreator);

//   Object.values(materialCreator.materials).forEach((material) => {
//     if (material.opacity === 0) {
//       material.opacity = 1;
//     }
//   });
//   loadObj('cube.obj', materialCreator).then((object) => {
//     console.log('object', object);
//     object.position.set(-5, 0, 0);
//     scene.add(object);
//     cube = object;
//   });
// }).catch(console.error);

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

// const intensity = 0.5;
// const distance = 500;
// const decay = 1;
// const pointLight = new THREE.PointLight(0xffffff, intensity, distance, decay);
// pointLight.position.set(0, 0, -500);
// scene.add(pointLight);

// const topLight = new THREE.PointLight(0xffffff, intensity, distance, decay);
// topLight.position.set(0, 500, 0);
// scene.add(topLight);

// TODO: restrict zooming in and out

const color = 0xFFFFFF;
const directionalLightIntensity = 0.15;
const light = new THREE.DirectionalLight(color, directionalLightIntensity);
// light.position.set(-1000, 1000, -1000);
light.target.position.set(0, 0, 0);
scene.add(light);
scene.add(light.target);

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
  color: 0x215A53,
  opacity: 0.97,
  shininess: 10,
  transparent: true,
});

loadObj('wind-turbine.obj').then((object) => {
  console.log('object', object);
  object.position.set(0, 0, 0);

  const frame_mesh = object.getObjectByName('Frame');
  frame_mesh.material = metalMaterial;

  const thread_mesh = object.getObjectByName('Threads');
  thread_mesh.material = metalMaterial;

  const alternator_mesh = object.getObjectByName('Alternator');
  alternator_mesh.material = resinMaterial;

  scene.add(object);
  // fitCameraToObject(camera, object, 1, controls);
  // cube = object;
});

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
  // if (cube) {
  //   cube.rotation.x += 0.01;
  //   cube.rotation.y += 0.01;
  // }

  controls.update();
  render();
  stats.update();
}

function render() {
  renderer.render(scene, camera);
  light.position.set(camera.position.x, camera.position.y, camera.position.z);
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

function fitCameraToObject(camera, object, offset, controls) {
  offset = offset || 1.25;

  const boundingBox = new THREE.Box3();

  // get bounding box of object - this will be used to setup controls and camera
  boundingBox.setFromObject(object);

  const center = boundingBox.getCenter();

  const size = boundingBox.getSize();

  // get the max side of the bounding box (fits to width OR height as needed )
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 4 * Math.tan(fov * 2));

  cameraZ *= offset; // zoom out a little so that objects don't fill the screen

  camera.position.z = cameraZ;

  const minZ = boundingBox.min.z;
  const cameraToFarEdge = (minZ < 0) ? -minZ + cameraZ : cameraZ - minZ;

  camera.far = cameraToFarEdge * 3;
  camera.updateProjectionMatrix();

  if (controls) {
    // set camera to rotate around center of loaded object
    controls.target = center;

    // prevent camera from zooming out far enough to create far plane cutoff
    controls.maxDistance = cameraToFarEdge * 2;

    controls.saveState();
  } else {
    camera.lookAt(center);
  }
}
