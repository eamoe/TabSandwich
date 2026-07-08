export interface SavedTab {
    id: string;
    title: string;
    url: string;
    faviconUrl?: string;
    /** References a name in Settings.categories, or is absent/unrecognized — both display as "Uncategorized". */
    category?: string;
    savedAt: number;
}

export interface Settings {
    outdatedEnabled: boolean;
    outdatedDays: number;
    /** User-managed presets. Never includes "Uncategorized" — that's an implicit, protected sentinel. */
    categories: string[];
    /** Category name -> palette key (see CategoryRepository.CATEGORY_COLOR_PALETTE). Missing entries fall back to a default. */
    categoryColors: Record<string, string>;
}
