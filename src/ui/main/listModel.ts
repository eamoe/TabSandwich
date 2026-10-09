import type { SavedTab, Settings, SortOrder, TabGroup } from "../../types";
import { getTabCategory, UNCATEGORIZED } from "../../domain/CategoryRepository";
import { isOutdated } from "../../util/time";
import { strings } from "../strings";

/**
 * The main list's rules, kept free of Preact and the DOM so the logic tests can check them
 * directly: which filters exist and in what order, and what each filter shows.
 */

export const ALL = "All";
export const OUTDATED = "Outdated";
/** The Archived filter: never a category's name (those are at most 15 characters, and this one can't be typed). */
export const ARCHIVED = "\u0000archived";

/** Archived: out of the list, kept for the Archived filter (SavedTab.archivedAt). */
export function isArchived(tab: SavedTab): boolean {
    return tab.archivedAt !== undefined;
}

/** Waiting: not pinned, in a category whose tabs age (Settings.waitingCategories), saved at least the set number of days ago. */
export function isTabOutdated(tab: SavedTab, settings: Settings): boolean {
    if (tab.pinned || isArchived(tab)) return false;
    return isOutdated(tab.savedAt, settings.waitingCategories.includes(getTabCategory(tab)), settings.outdatedDays);
}

/**
 * Categories in use, in the order Settings lists them, so reordering categories there shows up
 * here too. A category somehow in use but missing from Settings (stale data) still gets a
 * filter, appended alphabetically, rather than its tabs becoming unreachable. Uncategorized
 * always comes last.
 */
export function categoriesInUse(tabs: SavedTab[], configuredOrder: string[]): string[] {
    const inUse = new Set(tabs.map(getTabCategory));
    inUse.delete(UNCATEGORIZED);
    const ordered = configuredOrder.filter((c) => inUse.has(c));
    const strays = [...inUse].filter((c) => !configuredOrder.includes(c)).sort();
    const result = [...ordered, ...strays];
    if (tabs.some((t) => getTabCategory(t) === UNCATEGORIZED)) result.push(UNCATEGORIZED);
    return result;
}

export interface FilterOption {
    key: string;
    count: number;
}

/**
 * All first, then Waiting (only while something is waiting), then each category in use, then
 * Archived (only while something is archived). Everything but Archived counts only tabs in the list.
 */
export function filterOptions(all: SavedTab[], settings: Settings): FilterOption[] {
    const tabs = all.filter((t) => !isArchived(t));
    const outdatedCount = tabs.filter((t) => isTabOutdated(t, settings)).length;
    const options: FilterOption[] = [{ key: ALL, count: tabs.length }];
    if (outdatedCount > 0) options.push({ key: OUTDATED, count: outdatedCount });
    for (const cat of categoriesInUse(tabs, settings.categories)) {
        options.push({ key: cat, count: tabs.filter((t) => getTabCategory(t) === cat).length });
    }
    const archivedCount = all.length - tabs.length;
    if (archivedCount > 0) options.push({ key: ARCHIVED, count: archivedCount });
    return options;
}

/** A filter that has nothing left to show (its category is gone, or nothing is outdated now) falls back to All. */
export function effectiveFilter(filter: string, options: FilterOption[]): string {
    return options.some((o) => o.key === filter) ? filter : ALL;
}

/** What a filter shows: Archived, the archive; every other filter, tabs in the list only. */
export function applyFilter(all: SavedTab[], settings: Settings, filter: string): SavedTab[] {
    if (filter === ARCHIVED) return all.filter(isArchived);
    const tabs = all.filter((t) => !isArchived(t));
    if (filter === ALL) return tabs;
    if (filter === OUTDATED) return tabs.filter((t) => isTabOutdated(t, settings));
    return tabs.filter((t) => getTabCategory(t) === filter);
}

const byText = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/**
 * The list in the chosen order. A view only: the stored order (your own, "custom") is never
 * rewritten, which is why switching back to it restores it exactly. Ties keep your own order,
 * so the result never shuffles between opens.
 */
export function sortTabs(tabs: SavedTab[], sort: SortOrder): SavedTab[] {
    if (sort === "custom") return tabs;
    const compare: (a: SavedTab, b: SavedTab) => number = {
        newest: (a: SavedTab, b: SavedTab) => b.savedAt - a.savedAt,
        oldest: (a: SavedTab, b: SavedTab) => a.savedAt - b.savedAt,
        title: (a: SavedTab, b: SavedTab) => byText.compare(a.title, b.title),
        site: (a: SavedTab, b: SavedTab) => byText.compare(siteName(a.url), siteName(b.url)) || byText.compare(a.title, b.title),
    }[sort];
    // Array.prototype.sort is stable, so equal tabs stay in your own order.
    return [...tabs].sort(compare);
}

/**
 * Pinned tabs first, in whatever order they're given (your own, or the sort's), then the rest —
 * except tabs shown inside a saved window (`inWindow`), which keep their place: a window holds
 * its pinned tabs at its own top instead (groupItems).
 */
export function pinnedFirst(tabs: SavedTab[], inWindow: ReadonlySet<string> = new Set()): SavedTab[] {
    const top = tabs.filter((t) => t.pinned && !inWindow.has(t.id));
    if (top.length === 0) return tabs;
    return [...top, ...tabs.filter((t) => !t.pinned || inWindow.has(t.id))];
}

/** One entry in the list as shown: a saved tab, or a saved window with its tabs. */
export type ListItem = { kind: "tab"; tab: SavedTab } | { kind: "group"; group: TabGroup; tabs: SavedTab[] };

/**
 * The list with saved windows put together: each group stands where its first tab falls in the
 * given order, holding its tabs in that same order, pinned ones first. A group only shows as one
 * while it has two or more of the given tabs (one left over is just a tab); a tab naming a group
 * that's gone is just a tab.
 */
export function groupItems(tabs: SavedTab[], groups: TabGroup[]): ListItem[] {
    const byId = new Map(groups.map((g) => [g.id, g]));
    const members = new Map<string, SavedTab[]>();
    for (const tab of tabs) {
        if (tab.groupId && byId.has(tab.groupId)) members.set(tab.groupId, [...(members.get(tab.groupId) ?? []), tab]);
    }
    const items: ListItem[] = [];
    const placed = new Set<string>();
    for (const tab of tabs) {
        const inGroup = tab.groupId ? members.get(tab.groupId) : undefined;
        if (!inGroup || inGroup.length < 2) items.push({ kind: "tab", tab });
        else if (!placed.has(tab.groupId!)) {
            placed.add(tab.groupId!);
            items.push({ kind: "group", group: byId.get(tab.groupId!)!, tabs: pinnedFirst(inGroup) });
        }
    }
    return items;
}

/**
 * Each tab's saved window name, for the tabs that show inside one (a group of two or more of the
 * given tabs, as in groupItems): what search matches and what a search result names, since
 * results list every tab as its own row.
 */
export function windowNames(tabs: SavedTab[], groups: TabGroup[]): Map<string, string> {
    const names = new Map<string, string>();
    for (const item of groupItems(tabs, groups)) {
        if (item.kind === "group") for (const tab of item.tabs) names.set(tab.id, item.group.name);
    }
    return names;
}

/**
 * A name for a newly saved window, picked at random, sandwich-style ("Toasted Rye"), and not one
 * already in use (a number is added in the unlikely case every pairing is taken). `random` is
 * there for the logic tests.
 */
export function newGroupName(taken: string[], random: () => number = Math.random): string {
    const { adjectives, nouns } = strings.groupNameWords;
    const pick = (words: readonly string[]) => words[Math.floor(random() * words.length)];
    const used = new Set(taken);
    for (let attempt = 0; attempt < 50; attempt++) {
        const name = `${pick(adjectives)} ${pick(nouns)}`;
        if (!used.has(name)) return name;
    }
    const base = `${pick(adjectives)} ${pick(nouns)}`;
    let n = 2;
    while (used.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
}

/** "github.com" for "https://www.github.com/x" — what a row shows under its title. */
export function siteName(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
}

/** The item a tab is in: its saved window, or none (a loose tab). */
function locate(items: ListItem[], tabId: string): { index: number; group: Extract<ListItem, { kind: "group" }> | null } {
    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (item.kind === "tab" && item.tab.id === tabId) return { index, group: null };
        if (item.kind === "group" && item.tabs.some((t) => t.id === tabId)) return { index, group: item };
    }
    return { index: -1, group: null };
}

/**
 * Where a move takes a tab: next to which tab in your own order (reorderTabs moves it to that
 * tab's place; itself = it stays put), and which saved window it's then in (null: none).
 */
export interface Move {
    to: string;
    group: string | null;
    /**
     * Drag and drop only: lands just before or just after `to`, wherever the dragged tab came
     * from. Without it (Alt+arrows), the tab takes `to`'s place in your own order.
     */
    side?: DropSide;
}

/** Which half of a row a dragged tab is over: it lands above the row, or below it. */
export type DropSide = "before" | "after";

/**
 * Alt+arrows. A tab in a window moves within it, and steps out of it past its first or last
 * tab, staying where it is but no longer in the window; a loose tab steps past a whole window
 * at once (to its first tab going up, its last going down). Null: it can't move that way.
 */
export function reorderTarget(items: ListItem[], tabId: string, direction: "up" | "down"): Move | null {
    const { index, group } = locate(items, tabId);
    if (index === -1) return null;
    const step = direction === "down" ? 1 : -1;
    const pinned = !!tabIn(items, tabId)?.pinned;
    if (group) {
        const neighbor = group.tabs[group.tabs.findIndex((t) => t.id === tabId) + step];
        // Pinned and unpinned tabs each keep to their side of the line (pinning is the pin button's job).
        if (neighbor && !!neighbor.pinned !== pinned) return null;
        return neighbor ? { to: neighbor.id, group: group.group.id } : { to: tabId, group: null };
    }
    const neighbor = items[index + step];
    if (!neighbor) return null;
    if (neighbor.kind === "tab" ? !!neighbor.tab.pinned !== pinned : pinned) return null;
    if (neighbor.kind === "tab") return { to: neighbor.tab.id, group: null };
    const edge = direction === "down" ? neighbor.tabs.at(-1) : neighbor.tabs[0];
    return edge ? { to: edge.id, group: null } : null;
}

/**
 * Drag and drop. Dropped on a tab's upper half, the dragged tab lands just above it, on its lower
 * half just below it, and joins whatever window that tab is in (leaving its own, onto a loose
 * tab). On a window's own row: its upper half puts the tab just before the window, outside it;
 * its lower half just after a closed window, or into an open one as its first tab. Null: nowhere
 * to go (dropped on itself).
 */
export function dropTarget(
    items: ListItem[],
    draggedId: string,
    target: { tabId?: string; groupId?: string },
    side: DropSide
): Move | null {
    if (locate(items, draggedId).index === -1) return null;
    const pinned = !!tabIn(items, draggedId)?.pinned;
    // The list as it stands without the dragged tab; in `loose`, a window's row is null (never pinned).
    const rest = items.filter((i) => i.kind !== "tab" || i.tab.id !== draggedId);
    const loose = rest.map((i) => (i.kind === "tab" ? i.tab : null));
    if (target.groupId) {
        const at = rest.findIndex((i) => i.kind === "group" && i.group.id === target.groupId);
        const item = rest[at];
        if (!item || item.kind !== "group") return null;
        const first = item.tabs[0];
        const last = item.tabs.at(-1);
        if (!first || !last) return null;
        if (side === "before") return keepsLine(loose, at, "before", pinned) ? { to: first.id, group: null, side: "before" } : null;
        if (item.group.collapsed) return pinned ? null : { to: last.id, group: null, side: "after" };
        const inside = item.tabs.filter((t) => t.id !== draggedId);
        return keepsLine(inside, 0, "before", pinned) ? { to: first.id, group: item.group.id, side: "before" } : null;
    }
    if (!target.tabId || target.tabId === draggedId) return null;
    const to = locate(items, target.tabId);
    if (to.index === -1) return null;
    const run = to.group ? to.group.tabs.filter((t) => t.id !== draggedId) : loose;
    const at = run.findIndex((t) => t?.id === target.tabId);
    if (!keepsLine(run, at, side, pinned)) return null;
    return { to: target.tabId, group: to.group?.group.id ?? null, side };
}

/**
 * Whether landing before or after `run[at]` keeps a tab on its own side of the pinned line:
 * a pinned one only where everything above it is pinned too, an unpinned one only where nothing
 * below it is pinned. (`null` in a run stands for a window's row: never pinned.)
 */
/** Whether a keyboard move came to nothing because of the pinned line (rather than the list's end). */
export function stoppedAtPinLine(items: ListItem[], tabId: string, direction: "up" | "down"): boolean {
    const { index, group } = locate(items, tabId);
    if (index === -1) return false;
    const pinned = !!tabIn(items, tabId)?.pinned;
    const step = direction === "down" ? 1 : -1;
    if (group) {
        const neighbor = group.tabs[group.tabs.findIndex((t) => t.id === tabId) + step];
        return !!neighbor && !!neighbor.pinned !== pinned;
    }
    const neighbor = items[index + step];
    return !!neighbor && (neighbor.kind === "tab" ? !!neighbor.tab.pinned !== pinned : pinned);
}

function keepsLine(run: (SavedTab | null)[], at: number, side: DropSide, pinned: boolean): boolean {
    const above = side === "before" ? run[at - 1] : run[at];
    const below = side === "before" ? run[at] : run[at + 1];
    return pinned ? above === undefined || !!above?.pinned : !below?.pinned;
}

function tabIn(items: ListItem[], tabId: string): SavedTab | undefined {
    for (const item of items) {
        if (item.kind === "tab" && item.tab.id === tabId) return item.tab;
        if (item.kind === "group") {
            const found = item.tabs.find((t) => t.id === tabId);
            if (found) return found;
        }
    }
    return undefined;
}
