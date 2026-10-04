/**
 * Every piece of text the v3.0 screens show or announce, in one place — ready for translation
 * (v4.1) without hunting through components. Accessible names the robot tests find controls
 * by live here too, so renaming one is a visible, single-line change.
 */
export const strings = {
    appName: "Tab Sandwich",
    searchLabel: "Search saved tabs",
    searchPlaceholder: (count: number) => `Search ${count} saved tab${count === 1 ? "" : "s"}`,
    clearSearch: "Clear search",
    matches: (count: number) => (count === 0 ? "No matching tabs" : `${count} matching tab${count === 1 ? "" : "s"}`),
    addLinkManually: "Add link manually",
    openSettings: "Open settings",
    settingsTooltip: "Settings",

    currentTab: "Current tab",
    saveTab: "Save Tab",
    save: "Save",
    saved: "Saved!",
    alreadySaved: "Already saved",
    onlyWebPages: "Only web pages can be saved",
    saveToCategory: "Save to category",

    addLinkTitle: "Add a link by hand",
    urlLabel: "URL",
    urlPlaceholder: "Paste a link, like https://example.com",
    titleOptionalLabel: "Title (optional)",
    categoryOptionalLabel: "Category (optional)",
    add: "Add",
    cancel: "Cancel",
    enterValidUrl: "Enter a valid URL",

    filterLabel: "Filter saved tabs",
    all: "All",
    outdated: "Outdated",
    outdatedPill: (count: number) => `Outdated (${count})`,

    storageNearlyFull: (pct: number) => `Storage is ${pct}% full.`,
    seeStorage: "See storage",

    savedTabsLabel: "Saved tabs",
    noSavedTabs: "No saved tabs yet.",
    noMatchingTabs: "No matching tabs.",
    categoryForScreenReaders: (category: string) => `Category: ${category}`,
    savedDaysAgo: (days: number) => `Saved ${days} day${days === 1 ? "" : "s"} ago`,
    ageBadge: (days: number) => `${days}d`,
    editTab: (title: string) => `Edit ${title}`,
    deleteTab: (title: string) => `Delete ${title}`,
    editTooltip: "Edit",
    deleteTooltip: "Delete",

    titleLabel: "Title",
    titlePlaceholder: "Title",
    categoryLabel: "Category",
    editUrlPlaceholder: "https://example.com",
    enterValidUrlSentence: "Enter a valid URL.",
    alreadySavedAs: (title: string) => `Already saved as “${title}”.`,

    deleted: "Deleted",
    undo: "Undo",
} as const;
