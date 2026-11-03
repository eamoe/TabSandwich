/**
 * Every mutation across TabRepository/CategoryRepository/backup-import is read-modify-write:
 * fetch the current tabs or settings, derive a new value from that snapshot, write it back.
 * Nothing in chrome.storage.local makes that atomic, so two such cycles overlapping is a lost
 * update — the second cycle's read happened before the first cycle's write landed, so its own
 * write silently reverts whatever the first one just changed. This is a real risk here: nothing
 * disables a button while its own write is in flight, and since v4.0 several parts of the
 * extension write at once (a popup, a side panel, the library page, the background worker).
 *
 * So there is one lock for all of them. Web Locks are shared by every page and worker of the
 * extension, serve requests in order, and let go by themselves if a popup closes mid-write.
 * One lock is enough: some operations (renaming a category) touch both tabs and settings in one
 * cycle, so locking per key would still leave cross-key races.
 */
const LOCK_NAME = "tabSandwich.storage";

/** Where Web Locks don't exist (the logic tests' plain Node): one context, so a FIFO chain does the same job. */
let queue: Promise<unknown> = Promise.resolve();

export function withStorageLock<T>(run: () => Promise<T>): Promise<T> {
    const locks = globalThis.navigator?.locks;
    if (locks) return locks.request(LOCK_NAME, run) as Promise<T>;
    const result = queue.then(run, run);
    queue = result.then(
        () => undefined,
        () => undefined
    );
    return result;
}
