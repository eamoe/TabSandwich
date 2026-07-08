import { SavedTab } from "../types";
import { getSettings, setSettings } from "../storage/chromeStorage";

/** Reserved sentinel — never stored in Settings.categories, structurally impossible to rename or remove (FR-007). */
export const UNCATEGORIZED = "Uncategorized";

export function getTabCategory(tab: SavedTab): string {
    return tab.category ?? UNCATEGORIZED;
}

/** Configured categories, in display order. Does not include the implicit Uncategorized sentinel. */
export async function listCategories(): Promise<string[]> {
    const settings = await getSettings();
    return settings.categories;
}

/** The full selection list for dropdowns — configured categories plus Uncategorized last (FR-004: selection-only). */
export async function getSelectableCategories(): Promise<string[]> {
    return [...(await listCategories()), UNCATEGORIZED];
}

/** New categories go to the front — added at the end would land below the fold in a long list, invisible without scrolling. */
export async function addCategory(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed || trimmed === UNCATEGORIZED) return;
    const settings = await getSettings();
    if (settings.categories.includes(trimmed)) return;
    settings.categories = [trimmed, ...settings.categories];
    await setSettings(settings);
}

export interface RemoveCategoryResult {
    removed: boolean;
    reason?: string;
}

/** Blocks removal while a category is in use or is the protected default (FR-007). */
export async function removeCategory(name: string, tabs: SavedTab[]): Promise<RemoveCategoryResult> {
    if (name === UNCATEGORIZED) {
        return { removed: false, reason: '"Uncategorized" can\'t be removed.' };
    }
    if (tabs.some((t) => getTabCategory(t) === name)) {
        return { removed: false, reason: "In use — reassign its tabs first." };
    }
    const settings = await getSettings();
    settings.categories = settings.categories.filter((c) => c !== name);
    await setSettings(settings);
    return { removed: true };
}
