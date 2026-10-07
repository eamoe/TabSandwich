import type { SavedTab, Settings, TabGroup } from "../types";
import { getGroups, getSettings, getTabs, setSettings, setTabsAndGroups } from "../storage/chromeStorage";
import { withStorageLock } from "../storage/writeQueue";
import { mergeImport, replaceImport, type ApplyImportResult, type ParsedImport } from "./backup";

/** Everything saved, as it was just before an import — what Undo puts back. */
export interface Snapshot {
    tabs: SavedTab[];
    settings: Settings;
    groups: TabGroup[];
}

const takeSnapshot = async (): Promise<Snapshot> => ({ tabs: await getTabs(), settings: await getSettings(), groups: await getGroups() });

export interface ImportOutcome {
    result: ApplyImportResult;
    before: Snapshot;
}

/**
 * Merges a backup into what's saved. The read, the merge decision built from it and the write
 * happen as one locked unit, so a save or delete landing in between can't be silently erased.
 * Returns null when there's nothing new to add (no tabs and no categories): nothing is written.
 */
export async function importMerge(parsed: ParsedImport): Promise<ImportOutcome | null> {
    return withStorageLock(async () => {
        const before = await takeSnapshot();
        const result = mergeImport(before.tabs, before.settings, parsed, before.groups);
        // Both counts matter: a merge can restore a category with no tabs to show for it.
        if (result.addedCount === 0 && result.addedCategoryCount === 0) return null;
        await setTabsAndGroups(result.tabs, result.groups);
        await setSettings(result.settings);
        return { result, before };
    });
}

/** Replaces everything saved with the backup's contents. */
export async function importReplace(parsed: ParsedImport): Promise<ImportOutcome> {
    return withStorageLock(async () => {
        const before = await takeSnapshot();
        const result = replaceImport(parsed);
        await setTabsAndGroups(result.tabs, result.groups);
        await setSettings(result.settings);
        return { result, before };
    });
}

/** Undo for either import: puts back exactly what was saved before it. */
export async function restoreSnapshot(snapshot: Snapshot): Promise<void> {
    return withStorageLock(async () => {
        await setTabsAndGroups(snapshot.tabs, snapshot.groups);
        await setSettings(snapshot.settings);
    });
}
