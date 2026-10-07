import { SavedTab, Settings, TabGroup } from "../types";

const TABS_KEY = "tabSandwich.tabs";
const SETTINGS_KEY = "tabSandwich.settings";
/** Saved windows (v3.2). Data from before has no such key: read as no groups. */
export const GROUPS_KEY = "tabSandwich.groups";
/**
 * The last version whose "What's new" note you've seen (or that was installed fresh). Kept apart
 * from Settings on purpose: backups carry Settings, and restoring an old backup must not bring
 * back a note you already dismissed.
 */
const LAST_SEEN_VERSION_KEY = "tabSandwich.lastSeenVersion";

export const DEFAULT_SETTINGS: Settings = {
    outdatedEnabled: true,
    outdatedDays: 7,
    categories: ["Work", "Personal", "Reading", "Entertainment"],
    categoryColors: { Work: "purple", Personal: "coral", Reading: "teal", Entertainment: "pink" },
    theme: "system",
    sort: "custom",
};

export async function hasStoredTabs(): Promise<boolean> {
    const result = await chrome.storage.local.get(TABS_KEY);
    return Object.prototype.hasOwnProperty.call(result, TABS_KEY);
}

export async function getTabs(): Promise<SavedTab[]> {
    const result = await chrome.storage.local.get(TABS_KEY);
    return result[TABS_KEY] ?? [];
}

/**
 * Thrown by setTabs/setSettings when the underlying write rejects. `kind` says why, for the
 * screens to put into words (src/ui/errors.ts): a full storage is the one cause worth naming;
 * everything else (corruption, a browser policy) is "other" rather than a guess.
 */
export class StorageWriteError extends Error {
    constructor(public readonly kind: "full" | "other", public readonly cause: unknown) {
        super(`Storage write failed (${kind})`);
        this.name = "StorageWriteError";
    }
}

function writeFailure(err: unknown): StorageWriteError {
    const raw = err instanceof Error ? err.message : String(err);
    return new StorageWriteError(/quota/i.test(raw) ? "full" : "other", err);
}

export async function setTabs(tabs: SavedTab[]): Promise<void> {
    try {
        await chrome.storage.local.set({ [TABS_KEY]: tabs });
    } catch (err) {
        throw writeFailure(err);
    }
}

export async function getGroups(): Promise<TabGroup[]> {
    const result = await chrome.storage.local.get(GROUPS_KEY);
    return Array.isArray(result[GROUPS_KEY]) ? result[GROUPS_KEY] : [];
}

export async function setGroups(groups: TabGroup[]): Promise<void> {
    try {
        await chrome.storage.local.set({ [GROUPS_KEY]: groups });
    } catch (err) {
        throw writeFailure(err);
    }
}

/**
 * Tabs and groups in one write, for a change that touches both (saving a window, deleting a
 * group): either both land or neither does, so a tab never points at a group that wasn't saved.
 */
export async function setTabsAndGroups(tabs: SavedTab[], groups: TabGroup[]): Promise<void> {
    try {
        await chrome.storage.local.set({ [TABS_KEY]: tabs, [GROUPS_KEY]: groups });
    } catch (err) {
        throw writeFailure(err);
    }
}

export async function getSettings(): Promise<Settings> {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] ?? {}) };
}

export async function setSettings(settings: Settings): Promise<void> {
    try {
        await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    } catch (err) {
        throw writeFailure(err);
    }
}

/** Real usage against the real quota — backs FR-013's capacity indicator. No invented ceiling. */
export async function getStorageUsage(): Promise<{ bytesInUse: number; quotaBytes: number }> {
    const bytesInUse = await chrome.storage.local.getBytesInUse();
    return { bytesInUse, quotaBytes: chrome.storage.local.QUOTA_BYTES };
}

/** True when nothing at all is stored yet: a fresh install, before its first write. */
export async function isStorageEmpty(): Promise<boolean> {
    return Object.keys(await chrome.storage.local.get(null)).length === 0;
}

export async function getLastSeenVersion(): Promise<string | undefined> {
    const result = await chrome.storage.local.get(LAST_SEEN_VERSION_KEY);
    const value = result[LAST_SEEN_VERSION_KEY];
    return typeof value === "string" ? value : undefined;
}

export async function setLastSeenVersion(version: string): Promise<void> {
    try {
        await chrome.storage.local.set({ [LAST_SEEN_VERSION_KEY]: version });
    } catch (err) {
        throw writeFailure(err);
    }
}
