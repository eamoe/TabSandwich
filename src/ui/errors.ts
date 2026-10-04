import { StorageWriteError } from "../storage/chromeStorage";
import type { RemoveRefusal, RenameRefusal } from "../domain/CategoryRepository";
import { strings } from "./strings";

/** What to tell the user about a failed write: "storage is full" is worth naming; anything else just says to retry. */
export function writeErrorMessage(err: unknown): string {
    return err instanceof StorageWriteError && err.kind === "full" ? strings.storageFull : strings.couldntSave;
}

export function renameRefusalMessage(reason: RenameRefusal): string {
    return strings.renameRefusal[reason];
}

export function removeRefusalMessage(reason: RemoveRefusal): string {
    return strings.removeRefusal[reason];
}
