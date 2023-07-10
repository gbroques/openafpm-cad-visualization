export default function makeGroupParts(furlTransformPromise, getGroupConfigurations) {
  return async (parts) => {
    const furlTransform = await furlTransformPromise;
    const groupConfigurations = getGroupConfigurations({ furlTransform, parts });
    groupConfigurations.forEach((configuration) => {
      const { createGroup, partNames, configurePart } = configuration;
      const group = createGroup();
      group.userData.isCompositePart = true;
      parts.forEach((part) => {
        if (partNames.has(part.name)) {
          if (configurePart) configurePart(part);
          group.add(part);
        }
      });
      parts.push(group);
    });
    const groupedPartNames = unionSets(groupConfigurations
      .map(({ partNames }) => partNames));
    return [parts.filter((part) => !groupedPartNames.has(part.name)), furlTransform];
  };
}

function unionSets(sets) {
  return new Set(sets.reduce((a, c) => a.concat([...c]), []));
}
