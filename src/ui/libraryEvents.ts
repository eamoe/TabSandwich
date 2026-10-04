/**
 * "Saved data changed — reload." Settings (still vanilla) changes categories, colors and the
 * outdated rule; the main screen has to reflect those without the two importing each other.
 */
const listeners = new Set<() => void>();

export function notifyLibraryChanged(): void {
    for (const listener of listeners) listener();
}

export function onLibraryChanged(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
