import findMeshes from './findMeshes';

export default function setupTransparencyFolder(
  gui,
  partNamesByTransparencyLabel,
  parts,
  visibleMeshes,
  onControllerChange,
) {
  const transparencyLabels = Object.keys(partNamesByTransparencyLabel);
  const transparencyByLabel = getTransparencyByLabel(transparencyLabels);

  const entries = Object.entries(partNamesByTransparencyLabel);
  const changeHandlerByTransparencyLabel = getChangeHandlerByTransparencyLabel(
    entries, parts, visibleMeshes, onControllerChange,
  );
  const transparencyGui = gui.addFolder('Transparency');
  Object.keys(partNamesByTransparencyLabel).forEach((label) => {
    const changeHandler = changeHandlerByTransparencyLabel[label];
    const min = 0;
    const max = 100;
    const step = 10;
    const controller = transparencyGui.add(transparencyByLabel, label, min, max, step);
    controller.onChange(changeHandler);
    controller.$name.style = 'cursor: pointer';
    controller.$name.addEventListener('click', () => {
      transparencyByLabel[label] = transparencyByLabel[label] ? min : max;
      changeHandler(transparencyByLabel[label]);
      controller.updateDisplay();
    });
  });
  const cleanUp = () => {
    gui.destroy();
  };
  return cleanUp;
}

function getTransparencyByLabel(labels) {
  return labels.reduce((acc, label) => (
    { ...acc, [label]: 100 }
  ), {});
}

function getChangeHandlerByTransparencyLabel(
  entries, parts, visibleMeshes, onControllerChange,
) {
  return entries.reduce((accumulator, entry) => {
    const [label, partNames] = entry;
    return {
      ...accumulator,
      [label]: (transparency) => {
        partNames.forEach((partName) => {
          const changeTransparency = createChangeTransparency(
            parts, transparency, visibleMeshes, onControllerChange,
          );
          changeTransparency(partName);
        });
      },
    };
  }, {});
}

function createChangeTransparency(
  parts,
  transparency,
  visibleMeshes,
  onControllerChange,
) {
  return (partName) => {
    const part = findPart(parts, partName);
    if (part === undefined) {
      console.warn(`No part named '${partName}' found in parts`, parts);
      return;
    }
    const partMeshes = findMeshes(part);
    if (!partMeshes) {
      console.warn(`No meshes found for part '${partName}'`);
    }
    setTransparency(partMeshes, transparency);
    if (transparency) {
      addToVisibleMeshes(visibleMeshes, partMeshes);
    } else {
      if (part.visibile) {
        removeFromVisibleMeshes(visibleMeshes, partMeshes);
      }
    }
    part.visible = Boolean(transparency);
    onControllerChange();
  };
}

function setTransparency(partMeshes, transparency) {
    partMeshes.forEach(mesh => {
        mesh.material.opacity = transparency / 100;
    });
}

function addToVisibleMeshes(visibleMeshes, partMeshes) {
    partMeshes.forEach(mesh => {
      if (!visibleMeshes.includes(mesh)) {
        visibleMeshes.push(mesh);
      }
    })
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
