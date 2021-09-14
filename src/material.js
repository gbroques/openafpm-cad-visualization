import * as THREE from 'three';

const steelMaterial = new THREE.MeshPhongMaterial({
  color: 0xC0C1C8,
  shininess: 10,
  specular: 0xEAEAED,
  reflectivity: 0.5,
});

const copperMaterial = new THREE.MeshPhongMaterial({
  color: 0xB87333,
  shininess: 30,
  specular: 0xE3C7AD,
  reflectivity: 0.5,
});

const resinMaterial = new THREE.MeshLambertMaterial({
  color: 0x77AA9C,
  opacity: 0.90,
  transparent: true,
});

const magnetMaterial = new THREE.MeshLambertMaterial({
  color: 0x625E62,
});

const woodMaterial = new THREE.MeshLambertMaterial({
  color: 0xFDC099,
  reflectivity: 0.05,
});

const Material = {
  STEEL: steelMaterial,
  COPPER: copperMaterial,
  RESIN: resinMaterial,
  MAGNET: magnetMaterial,
  WOOD: woodMaterial,
};

export default Material;
