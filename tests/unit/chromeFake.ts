/**
 * An in-memory stand-in for the slice of the `chrome.*` API the domain and storage code uses,
 * so logic tests run in plain Node in milliseconds. It mirrors the real thing where that
 * matters for catching bugs: values are deep-copied on the way in and out (like the real
 * storage's serialization), so code that mutates an object it read can't accidentally pass
 * a test it would fail in the browser.
 */
export interface StorageFake {
    /** Raw stored values — read or seed directly in tests. */
    data: Record<string, unknown>;
    /** Makes the next `set` reject with this error (once), to exercise write-failure paths. */
    failNextSetWith: Error | null;
    /** Artificial latency for `set`, to force overlapping read-modify-write cycles. */
    setDelayMs: number;
    /** Finer-grained failure: return an error to reject a particular `set` call (checked on every call). */
    rejectSet: ((items: Record<string, unknown>) => Error | null) | null;
}

export const QUOTA_BYTES = 10_485_760;

function selectKeys(data: Record<string, unknown>, keys?: string | string[] | Record<string, unknown> | null) {
    if (keys == null) return structuredClone(data);
    if (typeof keys === "string") keys = [keys];
    if (Array.isArray(keys)) {
        const out: Record<string, unknown> = {};
        for (const k of keys) if (k in data) out[k] = structuredClone(data[k]);
        return out;
    }
    const out: Record<string, unknown> = {};
    for (const [k, fallback] of Object.entries(keys)) out[k] = structuredClone(k in data ? data[k] : fallback);
    return out;
}

export function installChromeFake(): StorageFake {
    const fake: StorageFake = { data: {}, failNextSetWith: null, setDelayMs: 0, rejectSet: null };

    const local = {
        QUOTA_BYTES,
        async get(keys?: string | string[] | Record<string, unknown> | null) {
            return selectKeys(fake.data, keys);
        },
        async set(items: Record<string, unknown>) {
            if (fake.setDelayMs > 0) await new Promise((r) => setTimeout(r, fake.setDelayMs));
            if (fake.failNextSetWith) {
                const err = fake.failNextSetWith;
                fake.failNextSetWith = null;
                throw err;
            }
            const rejection = fake.rejectSet?.(items);
            if (rejection) throw rejection;
            for (const [k, v] of Object.entries(items)) fake.data[k] = structuredClone(v);
        },
        async remove(keys: string | string[]) {
            for (const k of typeof keys === "string" ? [keys] : keys) delete fake.data[k];
        },
        async clear() {
            fake.data = {};
        },
        async getBytesInUse() {
            return Object.entries(fake.data).reduce((sum, [k, v]) => sum + k.length + JSON.stringify(v).length, 0);
        },
    };

    (globalThis as unknown as { chrome: unknown }).chrome = {
        storage: { local },
        runtime: { getURL: (path: string) => `chrome-extension://test-extension-id${path.startsWith("/") ? "" : "/"}${path}` },
    };
    return fake;
}
