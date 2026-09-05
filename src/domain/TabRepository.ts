import { SavedTab } from "../types";
import { getTabs, setTabs } from "../storage/chromeStorage";
import { urlsMatch } from "../util/url";

export interface AddTabInput {
    title: string;
    url: string;
    faviconUrl?: string;
    category?: string;
}

export interface AddTabResult {
    tab: SavedTab;
    duplicate: boolean;
}

/** Adds a tab, or returns the existing match untouched — FR-003's duplicate rule lives here so every save path shares it. */
export async function addTab(input: AddTabInput): Promise<AddTabResult> {
    const tabs = await getTabs();
    const existing = tabs.find((t) => urlsMatch(t.url, input.url));
    if (existing) {
        return { tab: existing, duplicate: true };
    }

    const newTab: SavedTab = {
        id: Date.now().toString(),
        title: input.title,
        url: input.url,
        faviconUrl: input.faviconUrl,
        category: input.category,
        savedAt: Date.now(),
    };
    await setTabs([newTab, ...tabs]);
    return { tab: newTab, duplicate: false };
}

export async function editTab(
    id: string,
    updates: Partial<Pick<SavedTab, "title" | "url" | "category">>
): Promise<void> {
    const tabs = await getTabs();
    const updated = tabs.map((t) => (t.id === id ? { ...t, ...updates } : t));
    await setTabs(updated);
}

export interface DeleteTabResult {
    tab: SavedTab;
    /** Position in the full stored array (not whatever's currently rendered) — what restoreTab needs to put it back exactly where it was. */
    index: number;
}

/** Deletes immediately (no undo-window delay in storage) and hands back what was removed, so a caller can offer undo without the deletion itself waiting on a timer. */
export async function deleteTab(id: string): Promise<DeleteTabResult | null> {
    const tabs = await getTabs();
    const index = tabs.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const tab = tabs[index];
    await setTabs([...tabs.slice(0, index), ...tabs.slice(index + 1)]);
    return { tab, index };
}

/**
 * Reinserts a previously-deleted tab at its original index — undo's counterpart to deleteTab.
 * Unlike addTab, this never runs duplicate detection: the caller is restoring an exact prior
 * state, not adding new input a user just typed. The index is clamped to the current array's
 * bounds since tabs may have been added or removed elsewhere during the undo window.
 */
export async function restoreTab(tab: SavedTab, index: number): Promise<void> {
    const tabs = await getTabs();
    const clampedIndex = Math.max(0, Math.min(index, tabs.length));
    await setTabs([...tabs.slice(0, clampedIndex), tab, ...tabs.slice(clampedIndex)]);
}

/**
 * Moves draggedId to sit where targetId currently is, in the full underlying array.
 * Operating by id (not by index into whatever's currently rendered) keeps this correct
 * even when the visible list is filtered by category or outdated status.
 */
export async function reorderTabs(draggedId: string, targetId: string): Promise<void> {
    if (draggedId === targetId) return;
    const tabs = await getTabs();
    const fromIndex = tabs.findIndex((t) => t.id === draggedId);
    const toIndex = tabs.findIndex((t) => t.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...tabs];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    await setTabs(reordered);
}
