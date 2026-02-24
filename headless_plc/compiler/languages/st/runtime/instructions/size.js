const toInteger = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return 0;
};
/**
 * Runtime implementation of the SIZE instruction.
 * Accepts a single-dimensional array and returns its length.
 * Dimension argument is currently limited to zero (first dimension).
 */
export function size(arrayValue, dimension) {
    const dim = toInteger(dimension);
    if (dim !== 0) {
        throw new Error('SIZE supports only dimension 0 for single-dimensional arrays');
    }
    if (!Array.isArray(arrayValue)) {
        throw new Error('SIZE expects an array tag');
    }
    return arrayValue.length;
}
