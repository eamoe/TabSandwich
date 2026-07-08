import { SavedTab, Settings } from "../types";

const TABS_KEY = "tabSandwich.tabs";
const SETTINGS_KEY = "tabSandwich.settings";

const DEFAULT_SETTINGS: Settings = {
    outdatedEnabled: true,
    outdatedDays: 7,
    categories: ["Work", "Personal", "Reading", "Entertainment"],
};

export async function hasStoredTabs(): Promise<boolean> {
    const result = await chrome.storage.local.get(TABS_KEY);
    return Object.prototype.hasOwnProperty.call(result, TABS_KEY);
}

export async function getTabs(): Promise<SavedTab[]> {
    const result = await chrome.storage.local.get(TABS_KEY);
    return result[TABS_KEY] ?? [];
}

export async function setTabs(tabs: SavedTab[]): Promise<void> {
    await chrome.storage.local.set({ [TABS_KEY]: tabs });
}

export async function getSettings(): Promise<Settings> {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] ?? {}) };
}

export async function setSettings(settings: Settings): Promise<void> {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

/** Real usage against the real quota — backs FR-013's capacity indicator. No invented ceiling. */
export async function getStorageUsage(): Promise<{ bytesInUse: number; quotaBytes: number }> {
    const bytesInUse = await chrome.storage.local.getBytesInUse();
    return { bytesInUse, quotaBytes: chrome.storage.local.QUOTA_BYTES };
}
