import { SavedTab, Settings } from "../types";

const TABS_KEY = "tabSandwich.tabs";
const SETTINGS_KEY = "tabSandwich.settings";

export const DEFAULT_SETTINGS: Settings = {
    outdatedEnabled: true,
    outdatedDays: 7,
    categories: ["Work", "Personal", "Reading", "Entertainment"],
    categoryColors: { Work: "purple", Personal: "coral", Reading: "teal", Entertainment: "pink" },
    theme: "system",
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
