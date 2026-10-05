export interface SavedTab {
    id: string;
    title: string;
    url: string;
    /** References a name in Settings.categories, or is absent/unrecognized — both display as "Uncategorized". */
    category?: string;
    savedAt: number;
}

/** How the main list is ordered. "custom" is your own drag-and-drop order; the others are views of it that never rewrite it. */
export type SortOrder = "custom" | "newest" | "oldest" | "title" | "site";

/** "system" follows the OS light/dark setting; the other two pin the popup to one theme. */
export type ThemeChoice = "system" | "light" | "dark";

export interface Settings {
    outdatedEnabled: boolean;
    outdatedDays: number;
    /** User-managed presets. Never includes "Uncategorized" — that's an implicit, protected sentinel. */
    categories: string[];
    /** Category name -> palette key (see CategoryRepository.CATEGORY_COLOR_PALETTE). Missing entries fall back to a default. */
    categoryColors: Record<string, string>;
    /**
     * Added in v3.0. Settings stored by earlier versions don't have it; getSettings() fills in
     * the default on read (the same merge every other field relies on), so no data upgrade is needed.
     */
    theme: ThemeChoice;
    /** Added in v3.1, filled in on read like theme. Remembered between opens. */
    sort: SortOrder;
}
