import { SavedTab, TabGroup } from "../types";
import { getGroups, getTabs, setTabs, setTabsAndGroups } from "../storage/chromeStorage";
import { withStorageLock } from "../storage/writeQueue";
import { urlsMatch } from "../util/url";

export interface AddTabInput {
    title: string;
    url: string;
    category?: string;
}

export interface AddTabResult {
    tab: SavedTab;
    duplicate: boolean;
}

/** Adds a tab, or returns the existing match untouched — FR-003's duplicate rule lives here so every save path shares it. */
export async function addTab(input: AddTabInput): Promise<AddTabResult> {
    return withStorageLock(async () => {
        const tabs = await getTabs();
        const existing = tabs.find((t) => urlsMatch(t.url, input.url));
        if (existing) {
            return { tab: existing, duplicate: true };
        }

        // crypto.randomUUID(), not Date.now(): two saves in the same millisecond (a double
        // click, or two async saves racing) used to mint identical ids, and every id-keyed
        // lookup below (edit/delete/reorder) would then silently act on whichever matching
        // tab it found first.
        const newTab: SavedTab = {
            id: crypto.randomUUID(),
            title: input.title,
            url: input.url,
            category: input.category,
            savedAt: Date.now(),
        };
        await setTabs([newTab, ...tabs]);
        return { tab: newTab, duplicate: false };
    });
}

export interface AddTabsResult {
    /** What was written, in the order given — now at the top of the list. */
    added: SavedTab[];
    /** Inputs skipped because their page was saved meanwhile (or given twice). */
    duplicates: number;
    /** The saved window they were put in together, if one was asked for and 2+ tabs were added. */
    group: TabGroup | null;
}

/** Names a new saved window, given the names already in use (so it can pick one that isn't). */
export type NameGroup = (taken: string[]) => string;

/**
 * Saves several pages in one write (a whole window): the same duplicate rule as addTab, checked
 * again under the lock in case something was saved since the caller looked. The new tabs go to
 * the top of the list, keeping the order they were given in, all into one category. With
 * `nameGroup`, two or more added tabs also become a saved window (collapsed), written together
 * with them; a single tab needs no group.
 */
export async function addTabs(inputs: { title: string; url: string }[], category?: string, nameGroup?: NameGroup): Promise<AddTabsResult> {
    return withStorageLock(async () => {
        const tabs = await getTabs();
        const added: SavedTab[] = [];
        const savedAt = Date.now();
        for (const input of inputs) {
            if (tabs.some((t) => urlsMatch(t.url, input.url)) || added.some((t) => urlsMatch(t.url, input.url))) continue;
            added.push({ id: crypto.randomUUID(), title: input.title, url: input.url, category, savedAt });
        }
        let group: TabGroup | null = null;
        if (nameGroup && added.length >= 2) {
            const groups = await getGroups();
            group = { id: crypto.randomUUID(), name: nameGroup(groups.map((g) => g.name)), createdAt: savedAt, collapsed: true };
            for (const tab of added) tab.groupId = group.id;
            await setTabsAndGroups([...added, ...tabs], [group, ...groups]);
        } else if (added.length > 0) {
            await setTabs([...added, ...tabs]);
        }
        return { added, duplicates: inputs.length - added.length, group };
    });
}

export interface EditTabResult {
    /** The other saved tab the new URL would have duplicated — set means nothing was written. */
    duplicateOf: SavedTab | null;
}

/**
 * Applies the same duplicate rule as addTab, so an edit can't create the copy that saving is
 * built to prevent. Only checked when the URL actually changes to a different page: a title or
 * category edit on a row that already duplicates another (possible in data from before this
 * rule, or from the legacy migration) must keep working rather than being blocked forever.
 */
export async function editTab(
    id: string,
    updates: Partial<Pick<SavedTab, "title" | "url" | "category">>
): Promise<EditTabResult> {
    return withStorageLock(async () => {
        const tabs = await getTabs();
        const current = tabs.find((t) => t.id === id);
        if (current && updates.url !== undefined && !urlsMatch(current.url, updates.url)) {
            const other = tabs.find((t) => t.id !== id && urlsMatch(t.url, updates.url!));
            if (other) return { duplicateOf: other };
        }
        const updated = tabs.map((t) => (t.id === id ? { ...t, ...updates } : t));
        await setTabs(updated);
        return { duplicateOf: null };
    });
}

/**
 * "Update" in the save card: brings a saved tab up to date with the page it was saved from —
 * the page's title and exact address now, the chosen category, and now as its saved date (so it
 * no longer counts as outdated). The address is a variant of the same page (the card only
 * offers Update when the two match), so there's no duplicate to check for. Hands back the tab
 * as it was, for Undo; null if it was deleted meanwhile (nothing written).
 */
export async function refreshTab(id: string, page: { title: string; url: string; category?: string }): Promise<SavedTab | null> {
    return withStorageLock(async () => {
        const tabs = await getTabs();
        const previous = tabs.find((t) => t.id === id);
        if (!previous) return null;
        const refreshed: SavedTab = { ...previous, title: page.title, url: page.url, category: page.category, savedAt: Date.now() };
        await setTabs(tabs.map((t) => (t.id === id ? refreshed : t)));
        return previous;
    });
}

/** Undo for refreshTab: puts the tab back exactly as it was, in its place (unless it's been deleted since). */
export async function putBackTab(previous: SavedTab): Promise<void> {
    return withStorageLock(async () => {
        const tabs = await getTabs();
        if (!tabs.some((t) => t.id === previous.id)) return;
        await setTabs(tabs.map((t) => (t.id === previous.id ? previous : t)));
    });
}

export interface DeleteTabResult {
    tab: SavedTab;
    /** Position in the full stored array (not whatever's currently rendered) — what restoreTab needs to put it back exactly where it was. */
    index: number;
}

/** Deletes immediately (no undo-window delay in storage) and hands back what was removed, so a caller can offer undo without the deletion itself waiting on a timer. */
export async function deleteTab(id: string): Promise<DeleteTabResult | null> {
    return withStorageLock(async () => {
        const tabs = await getTabs();
        const index = tabs.findIndex((t) => t.id === id);
        if (index === -1) return null;

        const tab = tabs[index];
        await setTabs([...tabs.slice(0, index), ...tabs.slice(index + 1)]);
        return { tab, index };
    });
}

/**
 * Reinserts a previously-deleted tab at its original index — undo's counterpart to deleteTab.
 * Unlike addTab, this never runs duplicate detection: the caller is restoring an exact prior
 * state, not adding new input a user just typed. The index is clamped to the current array's
 * bounds since tabs may have been added or removed elsewhere during the undo window.
 */
export async function restoreTab(tab: SavedTab, index: number): Promise<void> {
    return withStorageLock(async () => {
        const tabs = await getTabs();
        const clampedIndex = Math.max(0, Math.min(index, tabs.length));
        await setTabs([...tabs.slice(0, clampedIndex), tab, ...tabs.slice(clampedIndex)]);
    });
}

/** A tab's category before a bulk move — what Undo puts back. */
export interface PreviousCategory {
    id: string;
    category?: string;
}

/**
 * Moves several tabs into one category (undefined: Uncategorized) in one write, and hands back
 * what each had before, for one Undo (restoreCategories). Ids no longer saved are skipped.
 */
export async function setCategoryOf(ids: string[], category: string | undefined): Promise<PreviousCategory[]> {
    return withStorageLock(async () => {
        const tabs = await getTabs();
        const wanted = new Set(ids);
        const previous = tabs.filter((t) => wanted.has(t.id)).map((t) => ({ id: t.id, category: t.category }));
        if (previous.length > 0) await setTabs(tabs.map((t) => (wanted.has(t.id) ? { ...t, category } : t)));
        return previous;
    });
}

/** Undo for setCategoryOf: each tab back in the category it had (tabs deleted since are skipped). */
export async function restoreCategories(previous: PreviousCategory[]): Promise<void> {
    return withStorageLock(async () => {
        const before = new Map(previous.map((p) => [p.id, p.category]));
        const tabs = await getTabs();
        await setTabs(tabs.map((t) => (before.has(t.id) ? { ...t, category: before.get(t.id) } : t)));
    });
}

/**
 * Deletes several tabs in one write and hands back each with its position, for one Undo that
 * puts them all back where they were (restoreTabs). Ids no longer saved are skipped.
 */
export async function deleteTabs(ids: string[]): Promise<DeleteTabResult[]> {
    return withStorageLock(async () => {
        const tabs = await getTabs();
        const wanted = new Set(ids);
        const removed = tabs.flatMap((tab, index) => (wanted.has(tab.id) ? [{ tab, index }] : []));
        if (removed.length > 0) await setTabs(tabs.filter((t) => !wanted.has(t.id)));
        return removed;
    });
}

/**
 * Undo for deleteTabs: reinserts each tab at its old position, lowest first, so each index
 * means what it did before the delete (clamped, as tabs may have changed meanwhile). A tab
 * that's somehow back already is not added twice.
 */
export async function restoreTabs(removed: DeleteTabResult[]): Promise<void> {
    return withStorageLock(async () => {
        const tabs = await getTabs();
        for (const { tab, index } of [...removed].sort((a, b) => a.index - b.index)) {
            if (tabs.some((t) => t.id === tab.id)) continue;
            tabs.splice(Math.max(0, Math.min(index, tabs.length)), 0, tab);
        }
        await setTabs(tabs);
    });
}

/**
 * Moves a tab to where `targetId` is (itself: it stays put), into the saved window `groupId`, or
 * out of any window (null), in one write: dragging a tab into or out of a window, or stepping it
 * out with Alt+arrows. Hands back the tab as it was, and where, for Undo (undoMoveTab); null if
 * either tab is gone.
 */
export async function moveTab(draggedId: string, targetId: string, groupId: string | null): Promise<DeleteTabResult | null> {
    return withStorageLock(async () => {
        const tabs = await getTabs();
        const fromIndex = tabs.findIndex((t) => t.id === draggedId);
        const toIndex = tabs.findIndex((t) => t.id === targetId);
        if (fromIndex === -1 || toIndex === -1) return null;
        const previous = tabs[fromIndex];
        const { groupId: _old, ...rest } = previous;
        const moved: SavedTab = groupId ? { ...rest, groupId } : rest;
        const next = [...tabs];
        next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        await setTabs(next);
        return { tab: previous, index: fromIndex };
    });
}

/**
 * Drag and drop: puts a tab just before or just after `targetId`, into the saved window `groupId`
 * or out of any (null), in one write. Placed next to itself (a window's first tab dropped above
 * its window), it stays where it is and only changes window. Hands back the tab as it was, and
 * where, for Undo (undoMoveTab); null if either tab is gone.
 */
export async function placeTab(draggedId: string, targetId: string, side: "before" | "after", groupId: string | null): Promise<DeleteTabResult | null> {
    if (draggedId === targetId) return moveTab(draggedId, targetId, groupId);
    return withStorageLock(async () => {
        const tabs = await getTabs();
        const fromIndex = tabs.findIndex((t) => t.id === draggedId);
        if (fromIndex === -1) return null;
        const previous = tabs[fromIndex];
        const rest = tabs.filter((t) => t.id !== draggedId);
        const at = rest.findIndex((t) => t.id === targetId);
        if (at === -1) return null;
        const { groupId: _old, ...plain } = previous;
        rest.splice(side === "before" ? at : at + 1, 0, groupId ? { ...plain, groupId } : plain);
        await setTabs(rest);
        return { tab: previous, index: fromIndex };
    });
}

/** Undo for moveTab and placeTab: the tab back exactly as it was, in its old place (unless it's been deleted since). */
export async function undoMoveTab(previous: DeleteTabResult): Promise<void> {
    return withStorageLock(async () => {
        const tabs = await getTabs();
        const at = tabs.findIndex((t) => t.id === previous.tab.id);
        if (at === -1) return;
        tabs.splice(at, 1);
        tabs.splice(Math.max(0, Math.min(previous.index, tabs.length)), 0, previous.tab);
        await setTabs(tabs);
    });
}

/**
 * Moves draggedId to sit where targetId currently is, in the full underlying array.
 * Operating by id (not by index into whatever's currently rendered) keeps this correct
 * even when the visible list is filtered by category or outdated status.
 */
export async function reorderTabs(draggedId: string, targetId: string): Promise<void> {
    if (draggedId === targetId) return;
    return withStorageLock(async () => {
        const tabs = await getTabs();
        const fromIndex = tabs.findIndex((t) => t.id === draggedId);
        const toIndex = tabs.findIndex((t) => t.id === targetId);
        if (fromIndex === -1 || toIndex === -1) return;

        const reordered = [...tabs];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        await setTabs(reordered);
    });
}
