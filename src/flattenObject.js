/**
 * Flattens an object by disregarding top-level keys.
 *
 * @example
 * flattenObject({
 *  someValue: 1,
 *  obj: {
 *      anotherValue: 2
 *  }
 * })
 * // {someValue: 1, anotherValue: 2}
 *
 * @param {Object} object Object to flatten.
 * @returns Flattened object.
 */
function flattenObject(object) {
  return Object.entries(object).reduce((acc, entry) => {
    const [key, value] = entry;
    if (!isObject(value)) {
      return { ...acc, [key]: value };
    }
    return { ...acc, ...value };
  }, {});
}

function isObject(value) {
  return typeof value === 'object' && !Array.isArray(value);
}

module.exports = flattenObject;
