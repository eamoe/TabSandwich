/** Storage full is worth naming (StorageWriteError already phrases it); anything unexpected just says to retry rather than surfacing a raw exception. */
export function writeErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : "Couldn't save your changes. Try again.";
}
