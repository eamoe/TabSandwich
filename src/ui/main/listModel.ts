import type { SavedTab, Settings } from "../../types";
import { getTabCategory, UNCATEGORIZED } from "../../domain/CategoryRepository";
import { isOutdated } from "../../util/time";

/**
 * The main list's rules, kept free of Preact and the DOM so the logic tests can check them
 * directly: which filters exist and in what order, and what each filter shows.
 */

export const ALL = "All";
export const OUTDATED = "Outdated";

export function isTabOutdated(tab: SavedTab, settings: Settings): boolean {
    return isOutdated(tab.savedAt, settings.outdatedEnabled, settings.outdatedDays);
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

/** All first, then Outdated (only while something is outdated), then each category in use. */
export function filterOptions(tabs: SavedTab[], settings: Settings): FilterOption[] {
    const outdatedCount = tabs.filter((t) => isTabOutdated(t, settings)).length;
    const options: FilterOption[] = [{ key: ALL, count: tabs.length }];
    if (outdatedCount > 0) options.push({ key: OUTDATED, count: outdatedCount });
    for (const cat of categoriesInUse(tabs, settings.categories)) {
        options.push({ key: cat, count: tabs.filter((t) => getTabCategory(t) === cat).length });
    }
    return options;
}

/** A filter that has nothing left to show (its category is gone, or nothing is outdated now) falls back to All. */
export function effectiveFilter(filter: string, options: FilterOption[]): string {
    return options.some((o) => o.key === filter) ? filter : ALL;
}

export function applyFilter(tabs: SavedTab[], settings: Settings, filter: string): SavedTab[] {
    if (filter === ALL) return tabs;
    if (filter === OUTDATED) return tabs.filter((t) => isTabOutdated(t, settings));
    return tabs.filter((t) => getTabCategory(t) === filter);
}

/** "github.com" for "https://www.github.com/x" — what a row shows under its title. */
export function siteName(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
}
