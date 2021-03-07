import * as THREE from 'three';

const steelMaterial = new THREE.MeshPhongMaterial({
  color: 0xc0c1c8,
  shininess: 10,
  specular: 0xeaeaed,
  reflectivity: 0.5,
});

const copperMaterial = new THREE.MeshPhongMaterial({
  color: 0xB87333,
  shininess: 30,
  specular: 0xe3c7ad,
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
  STEEL: steelMaterial,
  COPPER: copperMaterial,
  RESIN: resinMaterial,
  MAGNET: magnetMaterial,
};

export default Material;
