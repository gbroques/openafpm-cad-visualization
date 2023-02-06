export function mapEntries(map, entryMapper) {
  const newMap = new Map();
  for (const entry of map.entries()) {
    const [key, value] = entryMapper(entry);
    newMap.set(key, value);
  }
  return newMap;
}

export function mapValues(map, valueMapper) {
  return mapEntries(map, ([key, value]) => (
    [key, valueMapper(value)]
  ));
}
