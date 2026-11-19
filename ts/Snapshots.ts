import {Railroad} from './Railroad';

/**
 * A copy of everything in a railroad at one moment, keyed the way Railroad is.
 * Parts that did not change between two snapshots are shared between them, so
 * a step that edits one player does not hold another copy of every prop.
 */
export type Snapshot = Record<string, unknown>;

/**
 * Compare two values from a railroad, which is plain data all the way down.
 * @param {unknown} a
 * @param {unknown} b
 * @return {boolean}
 */
function sameData(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b);
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!sameData(a[i], b[i])) return false;
        }
        return true;
    }
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = Object.keys(left);
    if (keys.length !== Object.keys(right).length) return false;
    for (const key of keys) {
        if (!sameData(left[key], right[key])) return false;
    }
    return true;
}

/**
 * Copy a railroad as it is now.
 * @param {Railroad} railroad
 * @param {Snapshot} previous - The last snapshot taken. Parts that are unchanged since then are reused.
 * @return {Snapshot | undefined} Undefined when nothing has changed since the previous snapshot.
 */
export function takeSnapshot(railroad: Railroad, previous?: Snapshot): Snapshot | undefined {
    const snapshot: Snapshot = {};
    let changed = !previous;
    for (const [key, value] of Object.entries(railroad)) {
        if (previous && sameData(value, previous[key])) {
            snapshot[key] = previous[key];
        } else {
            snapshot[key] = structuredClone(value);
            changed = true;
        }
    }
    return changed ? snapshot : undefined;
}

/**
 * Put a railroad back the way it was when a snapshot was taken. The railroad
 * object itself stays, because the map and the editors hold on to it; what it
 * contains is replaced with fresh copies, so later edits leave the snapshot alone.
 * @param {Railroad} railroad
 * @param {Snapshot} snapshot
 */
export function applySnapshot(railroad: Railroad, snapshot: Snapshot): void {
    const target = railroad as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(snapshot)) {
        target[key] = structuredClone(value);
    }
}
