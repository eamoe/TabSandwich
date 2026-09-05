/**
 * Every mutation across TabRepository/CategoryRepository/backup-import is read-modify-write:
 * fetch the current tabs or settings, derive a new value from that snapshot, write it back.
 * Nothing in chrome.storage.local makes that atomic, so two such cycles overlapping is a lost
 * update — the second cycle's read happened before the first cycle's write landed, so its own
 * write silently reverts whatever the first one just changed. This is a real risk here: nothing
 * disables a button while its own write is in flight, so a second click (or a drag-reorder
 * landing while an edit is still saving) can start a second cycle before the first resolves.
 *
 * A single FIFO chain is enough to fix it — tabs and settings share one popup's worth of calls,
 * and some operations (renaming a category) touch both keys in one cycle, so locking per-key
 * would still leave cross-key races.
 */
let queue: Promise<unknown> = Promise.resolve();

export function withStorageLock<T>(run: () => Promise<T>): Promise<T> {
    const result = queue.then(run, run);
    queue = result.then(
        () => undefined,
        () => undefined
    );
    return result;
}
