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
    // The save card on a page that's already saved.
    savedAgo: (days: number) => (days <= 0 ? "Saved today" : days === 1 ? "Saved yesterday" : `Saved ${days} days ago`),
    show: "Show",
    showTooltip: "Show it in the list",
    update: "Update",
    updateTooltip: "Update the saved copy: this page's title and address, today's date, and the category picked here",
    updatedButton: "Updated!",
    updatedToast: "Updated",
    categoryOfSaved: "Saved in category",
    open: "Open",
    openSavedTooltip: "Open the saved link in a new tab",
    onlyWebPages: "Only web pages can be saved",
    // Saving a whole window, under the save card.
    saveWindowAll: (count: number) => `Save all ${count} tabs in this window`,
    saveWindowNew: (count: number) => `Save ${count} new tab${count === 1 ? "" : "s"} from this window`,
    saveWindowTooltip: "Saves every web page open in this window into the category picked above (Uncategorized when the page you're on is already saved). Pages you've already saved are skipped.",
    savingWindow: "Saving…",
    windowSaved: (count: number) => (count === 0 ? "Nothing new to save" : `Saved ${count} tab${count === 1 ? "" : "s"}`),
    windowSkippedCount: (count: number) => `${count} skipped`,
    windowSkipped: (alreadySaved: number, browserPages: number) =>
        [
            alreadySaved > 0 && `${alreadySaved} already saved`,
            browserPages > 0 && `${browserPages} browser page${browserPages === 1 ? "" : "s"}`,
        ]
            .filter(Boolean)
            .join(", "),
    closeTabs: (count: number) => `Close ${count} tab${count === 1 ? "" : "s"}`,
    closeTabsTooltip: "Close the saved tabs in this window. The tab you're on stays open.",
    closedTabs: (count: number) => `Closed ${count} tab${count === 1 ? "" : "s"}`,
    windowDenied: "Nothing saved. Saving a window needs your OK to see its tabs.",
    tryAgain: "Try again",
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
    // The list with nothing to show: first run (or everything deleted), and a search with no results.
    emptyTitle: "Nothing saved yet",
    emptyLead: "Tabs you save land here, ready for when you need them.",
    emptyTipsLabel: "Getting started",
    tipSave: "Save the page you're on: pick a category above, then press Save.",
    tipShortcut: "Open Tab Sandwich from anywhere with",
    tipShortcutUnset: "Open Tab Sandwich from anywhere with a keyboard shortcut.",
    setShortcut: "Set one",
    tipCategories: "Make the categories yours.",
    editCategories: "Edit categories",
    noMatchesTitle: (query: string) => `No saved tabs match “${query}”`,
    noMatchesHint: "Search looks at titles and sites. Try fewer letters, or part of the site's name.",
    noMatchesInFilter: (filter: string) => `Only tabs in ${filter} were searched.`,
    searchAllTabs: "Search all tabs",

    // "What's new": one note per feature release, shown once after updating (see domain/whatsNew.ts).
    whatsNewTitle: (release: string) => `New in ${release}`,
    dismissWhatsNew: "Dismiss what's new",
    whatsNewNotes: {
        "3.1": [
            "Sort your list by newest, oldest, title or site.",
            "A page you've already saved says so, with Show and Update.",
            "Everything works from the keyboard. The keys are in Settings › General.",
        ],
    } as Record<string, readonly string[]>,
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

    // Keyboard control of the list (stage 4 of v3.1).
    movedTo: (title: string, position: number, total: number) => `Moved “${title}” to position ${position} of ${total}`,
    cantMoveSorted: "Tabs can only be moved in your own order. Switch the sort to Your order first.",
    cantMoveSearching: "Clear the search to move tabs.",
    keyboardKeys: "Keys in the list",
    keyHelp: {
        search: "Jump to search",
        move: "Move through your saved tabs",
        open: "Open the tab",
        edit: "Edit it",
        delete: "Delete it",
        undo: "Undo, while Undo is showing",
        reorder: "Move it up or down (in your own order)",
        back: "Back to search",
    },
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
