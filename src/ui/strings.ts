import type { SortOrder } from "../types";

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

    filterBarLabel: "Filter and sort saved tabs",
    filterLabel: "Filter saved tabs",
    all: "All",
    outdated: "Outdated",
    outdatedPill: (count: number) => `Outdated (${count})`,

    sortButton: (choice: string) => `Sort: ${choice}`,
    sortMenuLabel: "Sort saved tabs",
    /** The menu's full wording. */
    sortOptions: { custom: "Your order", newest: "Newest first", oldest: "Oldest first", title: "Title (A–Z)", site: "Site (A–Z)" } as Record<SortOrder, string>,
    /** The short form the button shows while a sort other than your own order is on. */
    sortShort: { custom: "Your order", newest: "Newest", oldest: "Oldest", title: "Title", site: "Site" } as Record<SortOrder, string>,

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
    upgradeFailed: "Couldn't update your saved data for this version. Nothing was changed.",

    // Settings
    settingsTitle: "Settings",
    back: "Back",
    settingsSections: "Settings sections",
    tabGeneral: "General",
    tabCategories: "Categories",
    tabBackup: "Backup",
    tabAbout: "About",

    appearance: "Appearance",
    themeGroup: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    themeHint: "System follows your computer's light or dark setting, even while the popup is open.",
    outdatedTabs: "Outdated tabs",
    outdatedHint: "Highlight tabs saved longer than the threshold below",
    markOutdatedAfter: "Mark as outdated after",
    days: "days",
    keyboardShortcut: "Keyboard shortcut",
    shortcutNotSet: "Not set",
    customize: "Customize",
    storage: "Storage",
    storageUsed: "Storage used",
    storageSummary: (count: number, pct: number) =>
        `${count} saved · ${pct < 1 ? "less than 1%" : `${Math.round(pct)}%`} of the space Chrome gives extensions`,
    storageAdvice: "Export a backup, then remove tabs you no longer need.",

    newCategory: "New category",
    configuredCategories: "Configured categories",
    colorFor: (name: string) => `Color for ${name}`,
    renameCategory: (name: string) => `Rename ${name}`,
    moveUp: (name: string) => `Move ${name} up`,
    moveDown: (name: string) => `Move ${name} down`,
    removeCategory: (name: string) => `Remove ${name}`,
    tabCount: (count: number) => `${count} tab${count === 1 ? "" : "s"}`,
    renameRefusal: {
        empty: "Name can't be empty.",
        gone: "Category no longer exists.",
        taken: "That name is already used by another category.",
    },
    removeRefusal: {
        reserved: '"Uncategorized" can\'t be removed.',
        "in-use": "In use — reassign its tabs first.",
    },
    storageFull: "Storage is full. Export your tabs, remove some, then try again.",
    couldntSave: "Couldn't save your changes. Try again.",
    colorNames: {
        purple: "Purple",
        coral: "Coral",
        teal: "Teal",
        pink: "Pink",
        amber: "Amber",
        blue: "Blue",
        green: "Green",
        slate: "Slate",
        sand: "Sand",
    } as Record<string, string>,

    backupTitle: "Backup",
    backupHint: "Export your saved tabs to a file, or import a previous backup.",
    exportBackup: "Export",
    importBackup: "Import",
    chooseBackupFile: "Choose a backup file to import",
    fileContains: (tabs: number) =>
        `This file contains ${tabs} tab${tabs === 1 ? "" : "s"}. Merge adds anything new; Replace overwrites everything currently saved.`,
    merge: "Merge",
    replaceAll: "Replace all",
    exported: (tabs: number) => `Exported ${tabs} tab${tabs === 1 ? "" : "s"}.`,
    nothingNew: "Nothing new — everything in this file is already saved.",
    imported: (tabs: number, categories: number) =>
        `Imported ${[
            tabs > 0 ? `${tabs} tab${tabs === 1 ? "" : "s"}` : "",
            categories > 0 ? `${categories} categor${categories === 1 ? "y" : "ies"}` : "",
        ]
            .filter(Boolean)
            .join(" and ")}`,
    replacedAll: "Replaced all tabs and settings",
    notABackup: "That file doesn't look like a Tab Sandwich backup.",

    version: (v: string) => `Version ${v}`,
    localPromise: "Everything stays in this browser. No account, no server, no analytics. Your tabs leave the browser only when you export them.",
    privacyPolicy: "Privacy policy",
    sourceCode: "Source code",
} as const;
