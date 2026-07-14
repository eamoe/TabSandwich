import { SavedTab } from "../types";
import { getSettings, setSettings } from "../storage/chromeStorage";

/** Reserved sentinel — never stored in Settings.categories, structurally impossible to rename or remove (FR-007). */
export const UNCATEGORIZED = "Uncategorized";

/** Fixed set compatible with the app's purple/coral design language — picking a color is choosing from this, not a raw color input. */
export const CATEGORY_COLOR_PALETTE: Record<string, string> = {
    purple: "#6C63C5",
    coral: "#D47663",
    teal: "#2DBEA6",
    pink: "#E8547E",
    amber: "#E8B93A",
    blue: "#4A90D9",
    green: "#6B8A68",
    slate: "#7A8699",
    sand: "#E5E2D5",
};

const PALETTE_KEYS = Object.keys(CATEGORY_COLOR_PALETTE);

/** Fixed and neutral — Uncategorized isn't user-configurable, so it never appears in the color picker. */
const UNCATEGORIZED_COLOR_HEX = "#B9B4CF";

export function getTabCategory(tab: SavedTab): string {
    return tab.category ?? UNCATEGORIZED;
}

/** Resolves a category's display color. Falls back to the first palette color for anything not yet assigned one. */
export function getCategoryColorHex(categoryName: string, categoryColors: Record<string, string>): string {
    if (categoryName === UNCATEGORIZED) return UNCATEGORIZED_COLOR_HEX;
    const key = categoryColors[categoryName];
    return CATEGORY_COLOR_PALETTE[key] ?? CATEGORY_COLOR_PALETTE[PALETTE_KEYS[0]];
}

function nextDefaultColorKey(existingColors: Record<string, string>): string {
    return PALETTE_KEYS[Object.keys(existingColors).length % PALETTE_KEYS.length];
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

const MAX_CATEGORY_NAME_LENGTH = 15;

/**
 * New categories go to the front — added at the end would land below the fold in a long
 * list, invisible without scrolling. Length is capped here (not just via the input's
 * `maxlength`) so the limit holds regardless of how this is ever called.
 */
export async function addCategory(name: string): Promise<void> {
    const trimmed = name.trim().slice(0, MAX_CATEGORY_NAME_LENGTH);
    if (!trimmed || trimmed === UNCATEGORIZED) return;
    const settings = await getSettings();
    if (settings.categories.includes(trimmed)) return;
    settings.categories = [trimmed, ...settings.categories];
    settings.categoryColors = { ...settings.categoryColors, [trimmed]: nextDefaultColorKey(settings.categoryColors) };
    await setSettings(settings);
}

export async function setCategoryColor(name: string, colorKey: string): Promise<void> {
    if (!(colorKey in CATEGORY_COLOR_PALETTE)) return;
    const settings = await getSettings();
    settings.categoryColors = { ...settings.categoryColors, [name]: colorKey };
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
    const { [name]: _removed, ...remainingColors } = settings.categoryColors;
    settings.categoryColors = remainingColors;
    await setSettings(settings);
    return { removed: true };
}
