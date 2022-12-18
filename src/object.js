export function mapEntries(obj, entryMapper) {
  return Object.fromEntries(Object.entries(obj).map(entryMapper));
}

export function mapValues(obj, valueMapper) {
  return mapEntries(obj, ([key, value]) => (
    [key, valueMapper(value)]
  ));
}

export function mergeObjectsWithArrayValues(...objects) {
  return entries(...objects).reduce((acc, entry) => {
    const [key, value] = entry;
    if (Array.isArray(acc[key]) && Array.isArray(value)) {
      return { ...acc, [key]: acc[key].concat(value) };
    }
    return { ...acc, [key]: value };
  }, {});
}

export function entries(...objects) {
  return objects.map(Object.entries).flat();
}
