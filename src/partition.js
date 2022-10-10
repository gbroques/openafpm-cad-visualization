export default function partition(array, predicate) {
  return [
    array.filter(predicate),
    array.filter((e) => !predicate(e)),
  ];
}
