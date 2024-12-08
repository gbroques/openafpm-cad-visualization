import * as THREE from 'three';

const createSteel = () => new THREE.MeshPhongMaterial({
  color: 0xC0C1C8,
  shininess: 10,
  specular: 0xEAEAED,
  reflectivity: 0.5,
  transparent: true,
});

const createCopper = () => new THREE.MeshPhongMaterial({
  color: 0xB87333,
  shininess: 30,
  specular: 0xE3C7AD,
  reflectivity: 0.5,
  transparent: true,
});

const createResin = () => new THREE.MeshLambertMaterial({
  color: 0x77AA9C,
  opacity: 0.90,
  transparent: true,
});

const createMagnet = () => new THREE.MeshLambertMaterial({
  color: 0x625E62,
  transparent: true,
});

const createWood = () => new THREE.MeshLambertMaterial({
  color: 0xFDC099,
  reflectivity: 0.05,
  transparent: true,
});

const MaterialFactory = {
  createSteel,
  createCopper,
  createResin,
  createMagnet,
  createWood,
};

export default MaterialFactory;
