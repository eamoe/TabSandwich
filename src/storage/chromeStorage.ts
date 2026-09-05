import { SavedTab, Settings } from "../types";

const TABS_KEY = "tabSandwich.tabs";
const SETTINGS_KEY = "tabSandwich.settings";

export const DEFAULT_SETTINGS: Settings = {
    outdatedEnabled: true,
    outdatedDays: 7,
    categories: ["Work", "Personal", "Reading", "Entertainment"],
    categoryColors: { Work: "purple", Personal: "coral", Reading: "teal", Entertainment: "pink" },
};

export async function hasStoredTabs(): Promise<boolean> {
    const result = await chrome.storage.local.get(TABS_KEY);
    return Object.prototype.hasOwnProperty.call(result, TABS_KEY);
}

export async function getTabs(): Promise<SavedTab[]> {
    const result = await chrome.storage.local.get(TABS_KEY);
    return result[TABS_KEY] ?? [];
}

/** Thrown by setTabs/setSettings when the underlying write rejects — message is user-facing, safe to show as-is. */
export class StorageWriteError extends Error {
    constructor(message: string, public readonly cause: unknown) {
        super(message);
        this.name = "StorageWriteError";
    }
}

/** Quota exceeded is the one rejection reason worth naming specifically — everything else (corruption, a browser-imposed policy) gets a generic retry message rather than guessing at a cause. */
function describeWriteFailure(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);
    if (/quota/i.test(raw)) {
        return "Storage is full. Export your tabs, remove some, then try again.";
    }
    return "Couldn't save your changes. Try again.";
}

export async function setTabs(tabs: SavedTab[]): Promise<void> {
    try {
        await chrome.storage.local.set({ [TABS_KEY]: tabs });
    } catch (err) {
        throw new StorageWriteError(describeWriteFailure(err), err);
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
        throw new StorageWriteError(describeWriteFailure(err), err);
    }
}

/** Real usage against the real quota — backs FR-013's capacity indicator. No invented ceiling. */
export async function getStorageUsage(): Promise<{ bytesInUse: number; quotaBytes: number }> {
    const bytesInUse = await chrome.storage.local.getBytesInUse();
    return { bytesInUse, quotaBytes: chrome.storage.local.QUOTA_BYTES };
}
