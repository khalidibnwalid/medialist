/**
 * Three-way merge used by the offline sync (server: api/sync, client: local sync engine).
 *
 * This file must stay pure & dependency-free (no imports, no Node/DOM APIs),
 * it is copied verbatim into the mobile client.
 *
 * - `base`: the value both sides started from (`undefined` => unknown)
 * - `local`: the value the client wants
 * - `remote`: the value currently on the server
 * - `preferLocal`: tie-break for real conflicts (last-writer-wins)
 */

type Primitive = string | number | boolean | null | undefined;

const isPrimitive = (value: unknown): value is Primitive =>
    value === null || (typeof value !== 'object' && typeof value !== 'function');

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};

const isPrimitiveArray = (value: unknown): value is Primitive[] =>
    Array.isArray(value) && value.every(isPrimitive);

/** structural equality for JSON-like values (a missing key equals `undefined`) */
export function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b);
    if (a instanceof Date || b instanceof Date)
        return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();

    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++)
            if (!deepEqual(a[i], b[i])) return false;
        return true;
    }

    if (isPlainObject(a) && isPlainObject(b)) {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const key of keys)
            if (!deepEqual(a[key], b[key])) return false;
        return true;
    }

    return false;
}

/** three-way merge of `local` and `remote` against their common `base` */
export function merge3<T = unknown>(base: unknown, local: T, remote: T, preferLocal: boolean): T {
    return mergeValues(base, local, remote, preferLocal, base !== undefined) as T;
}

function mergeValues(base: unknown, local: unknown, remote: unknown, preferLocal: boolean, baseKnown: boolean): unknown {
    if (deepEqual(local, remote)) return local;

    if (baseKnown) {
        if (deepEqual(base, local)) return remote; // only remote changed
        if (deepEqual(base, remote)) return local; // only local changed
    }

    // both changed => structural merge
    if (isPlainObject(local) && isPlainObject(remote))
        return mergeObjects(base, local, remote, preferLocal, baseKnown);

    if (isPrimitiveArray(local) && isPrimitiveArray(remote))
        return mergeSets(isPrimitiveArray(base) ? base : [], local, remote);

    if (Array.isArray(local) && Array.isArray(remote)) {
        if (baseKnown && Array.isArray(base) &&
            base.length === local.length && local.length === remote.length
        )
            return local.map((item, i) => mergeValues(base[i], item, remote[i], preferLocal, true));

        return preferLocal ? local : remote;
    }

    return preferLocal ? local : remote;
}

function mergeObjects(
    base: unknown,
    local: Record<string, unknown>,
    remote: Record<string, unknown>,
    preferLocal: boolean,
    baseKnown: boolean
) {
    const baseObject = isPlainObject(base) ? base : {};
    const result: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(remote), ...Object.keys(local)]);

    for (const key of keys) {
        const merged = mergeValues(baseObject[key], local[key], remote[key], preferLocal, baseKnown);
        if (merged !== undefined) result[key] = merged;
    }

    return result;
}

/** set-like merge (tags ids, keywords): remote's order, minus what local removed, plus what local added */
function mergeSets(base: Primitive[], local: Primitive[], remote: Primitive[]) {
    const localSet = new Set(local);
    const baseSet = new Set(base);

    const removedLocally = new Set(base.filter(value => !localSet.has(value)));
    const addedLocally = local.filter(value => !baseSet.has(value));

    const result = remote.filter(value => !removedLocally.has(value));
    const resultSet = new Set(result);

    addedLocally.forEach(value => {
        if (resultSet.has(value)) return;
        resultSet.add(value);
        result.push(value);
    });

    return result;
}
