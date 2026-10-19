// Copy supported save data without silently stripping unknown fields or getters.
export function copyDetachedJsonData(value, seen = new Map(), active = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || active.has(value)) throw Error('UNSUPPORTED_DETACHED_JSON_DATA');
    if (seen.has(value)) return seen.get(value);
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    if (!array && proto !== null && Object.getPrototypeOf(proto) !== null) throw Error('UNSUPPORTED_DETACHED_JSON_PROTOTYPE');
    const fields = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(fields);
    if (keys.some(key => typeof key !== 'string')) throw Error('UNSUPPORTED_DETACHED_JSON_KEY');
    const result = array ? [] : {};
    seen.set(value, result); active.add(value);
    for (const key of keys) {
        if (array && key === 'length') continue;
        const field = fields[key];
        if (!field.enumerable || !Object.hasOwn(field, 'value') ||
            (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))) throw Error('UNSUPPORTED_DETACHED_JSON_FIELD');
        Object.defineProperty(result, key, { value: copyDetachedJsonData(field.value, seen, active), enumerable: true, writable: true, configurable: true });
    }
    if (array && (result.length !== value.length || Object.keys(result).length !== value.length)) throw Error('SPARSE_DETACHED_JSON_DATA');
    active.delete(value); return result;
}

export function freezeDetachedJsonData(value, seen = new Set()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value); Object.values(value).forEach(item => freezeDetachedJsonData(item, seen));
    return Object.freeze(value);
}
