import * as THREE from 'three';

export default function transformsToMatrix4(transforms) {
  return transforms.reduce(
    (matrix, next) => matrix.multiply(transformToMatrix4(next)),
    new THREE.Matrix4(),
  );
}

function transformToMatrix4({ position, axis, angle }) {
  const matrix = new THREE.Matrix4();
  matrix.makeRotationAxis(
    new THREE.Vector3(...axis),
    angle,
  );
  matrix.setPosition(new THREE.Vector3(...position));
  return matrix;
}
