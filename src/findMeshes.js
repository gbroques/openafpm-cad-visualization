export default function findMeshes(part) {
  const mesh = findMesh(part);
  if (mesh) {
    return [mesh];
  }
  const meshes = part.children.map(findMesh);
  if (meshes.some((m) => m === undefined)) {
    console.warn(`No mesh found for part '${part.name}'`);
  }
  return meshes.filter((m) => m);
}

function findMesh(part) {
  return part.children.find((c) => c.name.endsWith('Mesh'));
}
