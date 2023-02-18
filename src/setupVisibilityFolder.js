import findMeshes from './findMeshes';

export default function setupVisibilityFolder(
  gui,
  partNamesByVisibilityLabel,
  parts,
  visibleMeshes,
  onControllerChange,
) {
  const visibilityLabels = Object.keys(partNamesByVisibilityLabel);
  const visibilityController = getVisibilityController(visibilityLabels);

  const entries = Object.entries(partNamesByVisibilityLabel);
  const changeHandlerByVisibilityLabel = getChangeHandlerByVisibilityLabel(
    entries, parts, visibleMeshes, onControllerChange,
  );
  const visibilityGui = gui.addFolder('Visibility');
  Object.keys(partNamesByVisibilityLabel).forEach((visibilityLabel) => {
    const changeHandler = changeHandlerByVisibilityLabel[visibilityLabel];
    visibilityGui.add(visibilityController, visibilityLabel).onChange(changeHandler);
  });
  const cleanUp = () => {
    const li = visibilityGui.domElement.parentElement;
    const ul = gui.domElement.querySelector('ul');
    // Ensure internal GUI list contains item before removing
    // to avoid "Failed to execute 'removeChild' on 'Node'" error.
    // This error only occurs if you quickly switch visualizations
    // before the first GUI mounts.
    if (ul.contains(li)) {
      gui.removeFolder(visibilityGui);
    }
    gui.destroy();
  };
  return cleanUp;
}

function getVisibilityController(visibilityLabels) {
  return visibilityLabels.reduce((acc, visibilityLabel) => (
    { ...acc, [visibilityLabel]: true }
  ), {});
}

function getChangeHandlerByVisibilityLabel(
  entries, parts, visibleMeshes, onControllerChange,
) {
  return entries.reduce((accumulator, entry) => {
    const [visibilityLabel, partNames] = entry;
    return {
      ...accumulator,
      [visibilityLabel]: (visibility) => {
        partNames.forEach((partName) => {
          const changeVisibility = createChangeVisibility(
            parts, visibility, visibleMeshes, onControllerChange,
          );
          changeVisibility(partName);
        });
      },
    };
  }, {});
}

function createChangeVisibility(
  parts,
  visbility,
  visibleMeshes,
  onControllerChange,
) {
  return (partName) => {
    const part = findPart(parts, partName);
    if (part === undefined) {
      console.warn(`No part named '${partName}' found in parts`, parts);
      return;
    }
    part.visible = visbility;
    const partMeshes = findMeshes(part);
    if (!partMeshes) {
      console.warn(`No meshes found for part '${partName}'`);
    }
    if (visbility) {
      addToVisibleMeshes(visibleMeshes, partMeshes);
    } else {
      removeFromVisibleMeshes(visibleMeshes, partMeshes);
    }
    onControllerChange();
  };
}

function addToVisibleMeshes(visibleMeshes, partMeshes) {
  visibleMeshes.push(...partMeshes);
}

function removeFromVisibleMeshes(visibleMeshes, partMeshes) {
  const removeVisibleMesh = createRemoveVisibleMesh(visibleMeshes);
  partMeshes.forEach((mesh) => removeVisibleMesh(mesh.name));
}

function createRemoveVisibleMesh(visibleMeshes) {
  return (meshName) => {
    const index = visibleMeshes.findIndex((m) => m.name === meshName);
    if (index < 0) {
      console.warn(`No mesh named '${meshName}' found inside visible meshes`);
    } else {
      visibleMeshes.splice(index, 1);
    }
  };
}

function findPart(parts, partName) {
  let part = parts.find((p) => p.name === partName);
  if (part === undefined) {
    const compositePartChildren = getCompositePartChildren(parts);
    part = compositePartChildren.find((p) => p.name === partName);
  }
  return part;
}

function getCompositePartChildren(parts) {
  return parts
    .filter((p) => p.userData.isCompositePart)
    .map((p) => p.children)
    .flat();
}
