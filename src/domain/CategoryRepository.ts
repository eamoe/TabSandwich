import { SavedTab } from "../types";
import { getSettings, setSettings, getTabs, setTabs } from "../storage/chromeStorage";
import { withStorageLock } from "../storage/writeQueue";

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
    return withStorageLock(async () => {
        const settings = await getSettings();
        if (settings.categories.includes(trimmed)) return;
        settings.categories = [trimmed, ...settings.categories];
        settings.categoryColors = {
            ...settings.categoryColors,
            [trimmed]: nextDefaultColorKey(settings.categoryColors),
        };
        await setSettings(settings);
    });
}

export async function setCategoryColor(name: string, colorKey: string): Promise<void> {
    if (!(colorKey in CATEGORY_COLOR_PALETTE)) return;
    return withStorageLock(async () => {
        const settings = await getSettings();
        settings.categoryColors = { ...settings.categoryColors, [name]: colorKey };
        await setSettings(settings);
    });
}

export interface RenameCategoryResult {
    renamed: boolean;
    reason?: string;
}

/**
 * Renames a category everywhere it's referenced: the categories list, its color mapping, and
 * every tab currently tagged with the old name. Tabs store a category by name, not by a
 * stable id (see SavedTab.category), so a rename that only touched Settings would silently
 * orphan every tab that used the old name — they'd fall back to displaying as Uncategorized.
 */
export async function renameCategory(oldName: string, newName: string): Promise<RenameCategoryResult> {
    const trimmed = newName.trim().slice(0, MAX_CATEGORY_NAME_LENGTH);
    if (!trimmed) return { renamed: false, reason: "Name can't be empty." };
    if (trimmed === oldName) return { renamed: true }; // unchanged — nothing to do, not an error

    return withStorageLock(async () => {
        const settings = await getSettings();
        if (!settings.categories.includes(oldName)) {
            return { renamed: false, reason: "Category no longer exists." };
        }
        if (trimmed === UNCATEGORIZED || settings.categories.includes(trimmed)) {
            return { renamed: false, reason: "That name is already used by another category." };
        }

        settings.categories = settings.categories.map((c) => (c === oldName ? trimmed : c));
        const { [oldName]: colorKey, ...remainingColors } = settings.categoryColors;
        settings.categoryColors = colorKey ? { ...remainingColors, [trimmed]: colorKey } : remainingColors;
        await setSettings(settings);

        // Re-reads tabs from storage rather than trusting the caller's snapshot: that snapshot
        // was taken whenever Settings last rendered, which may predate a tab add/edit/delete
        // that happened elsewhere during this same popup session.
        const currentTabs = await getTabs();
        if (currentTabs.some((t) => t.category === oldName)) {
            await setTabs(currentTabs.map((t) => (t.category === oldName ? { ...t, category: trimmed } : t)));
        }

        return { renamed: true };
    });
}

export type MoveDirection = "up" | "down";

/** Swaps a category with its immediate neighbor — sufficient for up/down controls; no-ops at either end of the list. */
export async function moveCategory(name: string, direction: MoveDirection): Promise<void> {
    return withStorageLock(async () => {
        const settings = await getSettings();
        const index = settings.categories.indexOf(name);
        if (index === -1) return;
        const swapWith = direction === "up" ? index - 1 : index + 1;
        if (swapWith < 0 || swapWith >= settings.categories.length) return;

        const categories = [...settings.categories];
        [categories[index], categories[swapWith]] = [categories[swapWith], categories[index]];
        settings.categories = categories;
        await setSettings(settings);
    });
}

/** Moves draggedName to sit where targetName currently is — drag-and-drop's counterpart to moveCategory's adjacent-only swap. */
export async function reorderCategories(draggedName: string, targetName: string): Promise<void> {
    if (draggedName === targetName) return;
    return withStorageLock(async () => {
        const settings = await getSettings();
        const fromIndex = settings.categories.indexOf(draggedName);
        const toIndex = settings.categories.indexOf(targetName);
        if (fromIndex === -1 || toIndex === -1) return;

        const categories = [...settings.categories];
        const [moved] = categories.splice(fromIndex, 1);
        categories.splice(toIndex, 0, moved);
        settings.categories = categories;
        await setSettings(settings);
    });
}

export interface RemoveCategoryResult {
    removed: boolean;
    reason?: string;
}

/**
 * Blocks removal while a category is in use or is the protected default (FR-007). Re-reads
 * tabs from storage rather than trusting a caller-supplied snapshot, same reasoning as
 * renameCategory: the "in use" check needs to see whatever's actually stored right now, not
 * whatever Settings happened to have on hand when it last rendered.
 */
export async function removeCategory(name: string): Promise<RemoveCategoryResult> {
    if (name === UNCATEGORIZED) {
        return { removed: false, reason: '"Uncategorized" can\'t be removed.' };
    }
    return withStorageLock(async () => {
        const tabs = await getTabs();
        if (tabs.some((t) => getTabCategory(t) === name)) {
            return { removed: false, reason: "In use — reassign its tabs first." };
        }
        const settings = await getSettings();
        settings.categories = settings.categories.filter((c) => c !== name);
        const { [name]: _removed, ...remainingColors } = settings.categoryColors;
        settings.categoryColors = remainingColors;
        await setSettings(settings);
        return { removed: true };
    });
}
