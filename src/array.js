export function forEachWithPrevious(array, fn) {
  array.forEach((element, index) => {
    const previous = index === 0 ? null : array[index - 1];
    fn(element, previous, index);
  });
}

export function groupBy(array, getKey) {
  return array.reduce((map, element) => {
    const key = getKey(element);
    if (key === null) return map;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(element);
    return map;
  }, new Map());
}

export function partition(array, predicate) {
  return [
    array.filter(predicate),
    array.filter((e) => !predicate(e)),
  ];
}

export function reverseArray(array) {
  return [...array].reverse();
}
