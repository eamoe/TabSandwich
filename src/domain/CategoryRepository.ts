import { SavedTab } from "../types";
import { getSettings, setSettings, getTabs, setTabs, setTabsAndSettings } from "../storage/chromeStorage";
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

/** Why a rename was refused; the screens put it into words (src/ui/errors.ts). */
export type RenameRefusal = "empty" | "gone" | "taken";

export interface RenameCategoryResult {
    renamed: boolean;
    reason?: RenameRefusal;
}

/**
 * Renames a category everywhere it's referenced: the categories list, its color mapping, and
 * every tab currently tagged with the old name. Tabs store a category by name, not by a
 * stable id (see SavedTab.category), so a rename that only touched Settings would silently
 * orphan every tab that used the old name — they'd fall back to displaying as Uncategorized.
 */
export async function renameCategory(oldName: string, newName: string): Promise<RenameCategoryResult> {
    const trimmed = newName.trim().slice(0, MAX_CATEGORY_NAME_LENGTH);
    if (!trimmed) return { renamed: false, reason: "empty" };
    if (trimmed === oldName) return { renamed: true }; // unchanged — nothing to do, not an error

    return withStorageLock(async () => {
        const settings = await getSettings();
        if (!settings.categories.includes(oldName)) {
            return { renamed: false, reason: "gone" };
        }
        if (trimmed === UNCATEGORIZED || settings.categories.includes(trimmed)) {
            return { renamed: false, reason: "taken" };
        }

        settings.categories = settings.categories.map((c) => (c === oldName ? trimmed : c));
        const { [oldName]: colorKey, ...remainingColors } = settings.categoryColors;
        settings.categoryColors = colorKey ? { ...remainingColors, [trimmed]: colorKey } : remainingColors;
        settings.waitingCategories = settings.waitingCategories.map((c) => (c === oldName ? trimmed : c));
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

/** Why a removal was refused; the screens put it into words (src/ui/errors.ts). */
export type RemoveRefusal = "reserved";

/** Everything a removal changed, for its Undo (restoreCategory). Kept in memory only. */
export interface RemovedCategory {
    name: string;
    index: number;
    colorKey: string | undefined;
    waiting: boolean;
    /** The tabs that used it (archived ones too), which now have no category. */
    tabIds: string[];
}

export interface RemoveCategoryResult {
    removed: boolean;
    reason?: RemoveRefusal;
    removedCategory?: RemovedCategory;
}

/**
 * Removes a category from the list, its color and its Waiting setting; the tabs that used it,
 * archived ones included, become Uncategorized (no category stored, like any other uncategorized
 * tab). One write for tabs and settings together. Re-reads both from storage rather than trusting
 * a caller's snapshot, same reasoning as renameCategory. Uncategorized itself can't be removed.
 */
export async function removeCategory(name: string): Promise<RemoveCategoryResult> {
    if (name === UNCATEGORIZED) {
        return { removed: false, reason: "reserved" };
    }
    return withStorageLock(async () => {
        const [tabs, settings] = await Promise.all([getTabs(), getSettings()]);
        const index = settings.categories.indexOf(name);
        const tabIds = tabs.filter((t) => t.category === name).map((t) => t.id);
        const removedCategory: RemovedCategory = {
            name,
            index,
            colorKey: settings.categoryColors[name],
            waiting: settings.waitingCategories.includes(name),
            tabIds,
        };
        settings.categories = settings.categories.filter((c) => c !== name);
        const { [name]: _removed, ...remainingColors } = settings.categoryColors;
        settings.categoryColors = remainingColors;
        // A category added later under the same name starts out kept, like any new one.
        settings.waitingCategories = settings.waitingCategories.filter((c) => c !== name);
        if (tabIds.length === 0) {
            await setSettings(settings);
        } else {
            const released = tabs.map((t) => {
                if (t.category !== name) return t;
                const { category: _gone, ...rest } = t;
                return rest;
            });
            await setTabsAndSettings(released, settings);
        }
        return { removed: true, removedCategory };
    });
}

/**
 * Undoes removeCategory: the category back in its place, with its color and Waiting setting, and
 * its tabs back in it — only those still uncategorized (one moved elsewhere since stays there).
 * If a category of that name was added in the meantime, that one is kept as it is and the tabs
 * join it.
 */
export async function restoreCategory(removed: RemovedCategory): Promise<void> {
    return withStorageLock(async () => {
        const [tabs, settings] = await Promise.all([getTabs(), getSettings()]);
        if (!settings.categories.includes(removed.name)) {
            const categories = [...settings.categories];
            categories.splice(Math.max(0, Math.min(removed.index, categories.length)), 0, removed.name);
            settings.categories = categories;
            if (removed.colorKey) settings.categoryColors = { ...settings.categoryColors, [removed.name]: removed.colorKey };
            if (removed.waiting && !settings.waitingCategories.includes(removed.name)) {
                settings.waitingCategories = [...settings.waitingCategories, removed.name];
            }
        }
        const ids = new Set(removed.tabIds);
        const restored = tabs.map((t) => (ids.has(t.id) && !t.category ? { ...t, category: removed.name } : t));
        await setTabsAndSettings(restored, settings);
    });
}
