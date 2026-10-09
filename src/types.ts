export interface SavedTab {
    id: string;
    title: string;
    url: string;
    /** References a name in Settings.categories, or is absent/unrecognized — both display as "Uncategorized". */
    category?: string;
    savedAt: number;
    /** The saved window this tab belongs to (v3.2). Absent, or naming a group that no longer exists: not in a group. */
    groupId?: string;
    /** Pinned (v3.3): shown above the rest in every sort (inside a saved window, at the top of it), and never waiting. Absent: not pinned. */
    pinned?: boolean;
    /**
     * When it was archived (v3.3): out of the list, the filters, the Waiting count and search, kept
     * (in its place in your order, and in its saved window) until it's restored or deleted for good
     * from the Archived filter. Absent: not archived.
     */
    archivedAt?: number;
    /** A line on why you saved it (v3.3), shown under the row and searched. At most MAX_NOTE_LENGTH characters; absent: no note. */
    note?: string;
}

/** A saved window: its tabs stay together in the list under one collapsible row (v3.2). */
export interface TabGroup {
    id: string;
    /** "github.com + 12 others, 6 Oct" when saved; the user can rename it. */
    name: string;
    createdAt: number;
    collapsed: boolean;
}

/** How the main list is ordered. "custom" is your own drag-and-drop order; the others are views of it that never rewrite it. */
export type SortOrder = "custom" | "newest" | "oldest" | "title" | "site";

/** "system" follows the OS light/dark setting; the other two pin the popup to one theme. */
export type ThemeChoice = "system" | "light" | "dark";

export interface Settings {
    /** How many days a tab in a waiting category waits before it shows as "Waiting" (1–365). */
    outdatedDays: number;
    /**
     * The categories whose tabs age (v3.3): saved to read later, they show as "Waiting" once
     * they've waited outdatedDays. Every other category is kept — its tabs never age. Names as in
     * `categories`, plus "Uncategorized". Replaces the single on/off switch (`outdatedEnabled`)
     * that versions before 3.3 stored; the version-3 upgrade turns that into this list.
     */
    waitingCategories: string[];
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
