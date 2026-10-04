import type { SavedTab, Settings } from "../../src/types";
import { DEFAULT_SETTINGS } from "../../src/storage/chromeStorage";
import { storage } from "./setup";

export const TABS_KEY = "tabSandwich.tabs";
export const SETTINGS_KEY = "tabSandwich.settings";

let counter = 0;
export function makeTab(overrides: Partial<SavedTab> = {}): SavedTab {
    counter += 1;
    return {
        id: `tab-${counter}`,
        title: `Tab ${counter}`,
        url: `https://example.com/page-${counter}`,
        savedAt: Date.UTC(2026, 0, 1),
        ...overrides,
    };
}

export function seed(tabs: SavedTab[], settings: Partial<Settings> = {}): void {
    storage.data[TABS_KEY] = structuredClone(tabs);
    storage.data[SETTINGS_KEY] = structuredClone({ ...DEFAULT_SETTINGS, ...settings });
}

export function storedTabs(): SavedTab[] {
    return (storage.data[TABS_KEY] as SavedTab[] | undefined) ?? [];
}

export function storedSettings(): Settings {
    return storage.data[SETTINGS_KEY] as Settings;
}
