import type { SavedTab, Settings } from "../../types";
import { getTabCategory } from "../../domain/CategoryRepository";
import { ALL, ARCHIVED, OUTDATED, applyFilter, isArchived, siteName } from "../main/listModel";

/** The library's sidebar: what `applyFilter` knows, plus one saved window. */
export const WINDOW_PREFIX = "\u0000window:";
export const windowFilter = (groupId: string) => WINDOW_PREFIX + groupId;

export function filterLibrary(tabs: SavedTab[], settings: Settings, filter: string): SavedTab[] {
    if (!filter.startsWith(WINDOW_PREFIX)) return applyFilter(tabs, settings, filter);
    const id = filter.slice(WINDOW_PREFIX.length);
    return tabs.filter((t) => t.groupId === id && !isArchived(t));
}

export type LibraryColumn = "title" | "category" | "site" | "saved" | "opened";
export interface LibrarySort {
    column: LibraryColumn;
    ascending: boolean;
}
/** Newest saved first: the order a list of saved things is usually read in. */
export const DEFAULT_LIBRARY_SORT: LibrarySort = { column: "saved", ascending: false };

const byText = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

const COMPARE: Record<LibraryColumn, (a: SavedTab, b: SavedTab) => number> = {
    title: (a, b) => byText.compare(a.title, b.title),
    category: (a, b) => byText.compare(getTabCategory(a), getTabCategory(b)),
    site: (a, b) => byText.compare(siteName(a.url), siteName(b.url)),
    saved: (a, b) => a.savedAt - b.savedAt,
    opened: (a, b) => (a.lastOpenedAt ?? -1) - (b.lastOpenedAt ?? -1),
};

/** Stable, with the title breaking ties, so the same data always reads the same way. */
export function sortLibrary(tabs: SavedTab[], { column, ascending }: LibrarySort): SavedTab[] {
    const direction = ascending ? 1 : -1;
    return [...tabs].sort((a, b) => COMPARE[column](a, b) * direction || byText.compare(a.title, b.title));
}

/** Clicking a column sorts by it, and clicking it again turns it around. Text starts A to Z, dates start newest. */
export function nextSort(current: LibrarySort, column: LibraryColumn): LibrarySort {
    if (current.column === column) return { column, ascending: !current.ascending };
    return { column, ascending: column !== "saved" && column !== "opened" };
}

/** The rows worth drawing: those in view plus `extra` either side, so a 1,000-tab library draws a few dozen. */
export function rowsInView(count: number, rowHeight: number, scrollTop: number, viewHeight: number, extra = 8): { start: number; end: number } {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - extra);
    const end = Math.min(count, Math.ceil((scrollTop + viewHeight) / rowHeight) + extra);
    return { start: Math.min(start, end), end };
}

/** The sidebar's counts: what each filter would show, the archive apart. */
export function sidebarCounts(tabs: SavedTab[], settings: Settings): Map<string, number> {
    const counts = new Map<string, number>();
    const bump = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
    const waiting = new Set(applyFilter(tabs, settings, OUTDATED).map((t) => t.id));
    for (const tab of tabs) {
        if (isArchived(tab)) {
            bump(ARCHIVED);
            continue;
        }
        bump(ALL);
        bump(getTabCategory(tab));
        if (waiting.has(tab.id)) bump(OUTDATED);
        if (tab.groupId) bump(windowFilter(tab.groupId));
    }
    return counts;
}
