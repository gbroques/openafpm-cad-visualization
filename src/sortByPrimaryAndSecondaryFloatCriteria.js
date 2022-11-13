/**
 * Object defining a sort order based on a float-value.
 *
 * @typedef {Object} SortOrder
 * @property {function} getFloatValue Function taking an element in an array
 *                                    and returning a float-value to sort on.
 * @property {string} direction 'ASC' or 'DESC' for ascending or descending sort direction.
 */

/**
 * Sort an array of elements based on primary and secondary float-value criteria.
 *
 * @param {Array} array Array of elements to sort.
 * @param {SortOrder} primarySort Primary sort order.
 * @param {SortOrder} secondarySort Secondary sort order used when two
 *                                  element's primary sort order are equal.
 * @param {number} tolerance Tolerance to compare two float values.
 * @returns New sorted array.
 */
export default function sortByPrimaryAndSecondaryFloatCriteria(
  array,
  primarySort,
  secondarySort,
  tolerance,
) {
  const sortedArray = [...array];
  sortedArray.sort((a, b) => {
    const result = compare(a, b, primarySort, tolerance);
    if (result === 0) {
      return compare(a, b, secondarySort, tolerance);
    }
    return result;
  });
  return sortedArray;
}

function compare(a, b, sortObject, tolerance) {
  const { getFloatValue, direction } = sortObject;
  const isAscending = direction === 'ASC';
  const aValue = getFloatValue(a);
  const bValue = getFloatValue(b);
  if (areEqual(aValue, bValue, tolerance)) {
    return 0;
  }
  return isAscending
    ? (aValue - bValue)
    : (bValue - aValue);
}

function areEqual(float1, float2, tolerance = 0.001) {
  return Math.abs(float1 - float2) < tolerance;
}
