export function forEachWithPrevious(array, fn) {
  array.forEach((element, index) => {
    const previous = index === 0 ? null : array[index - 1];
    fn(element, previous, index);
  });
}

export function groupBy(array, getKey) {
  return array.reduce((acc, element) => {
    const key = getKey(element);
    if (key === null) return acc;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(element);
    return acc;
  }, {});
}

export function partition(array, predicate) {
  return [
    array.filter(predicate),
    array.filter((e) => !predicate(e)),
  ];
}
