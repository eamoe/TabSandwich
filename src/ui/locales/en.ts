import type { SortOrder } from "../../types";
import { reminderDay } from "../../util/time";
import { localeFor, pluralizer, type Picker } from "../i18n";

const n = pluralizer("en");
const tag = localeFor("en");
const ADJECTIVES = ["Toasted", "Crispy", "Golden", "Buttery", "Warm", "Crusty", "Fluffy", "Grilled", "Melty", "Savory", "Zesty", "Tangy",
    "Smoky", "Honeyed", "Peppery", "Herby", "Sunny", "Rustic", "Hearty", "Flaky", "Spicy", "Fresh", "Cozy", "Seeded"];
const NOUNS = ["Rye", "Bagel", "Panini", "Baguette", "Ciabatta", "Brioche", "Croissant", "Focaccia", "Pretzel", "Sourdough", "Muffin", "Pita",
    "Wrap", "Club", "Reuben", "Toastie", "Melt", "Hoagie", "Bun", "Crumpet", "Biscuit", "Flatbread", "Roll", "Loaf", "Pickle",
    "Cheddar", "Pesto", "Avocado", "Tomato", "Mustard"];
const reminderDate = (at: number) => new Date(at).toLocaleDateString(tag, { weekday: "short", day: "numeric", month: "short" });

/**
 * Every piece of text the screens, the worker and the notifications show or announce, in
 * English — the language every other dictionary in this folder translates, key for key (a
 * missing or extra key fails the type check and tests/unit/locales.test.ts). Accessible names
 * the robot tests find controls by live here too, so renaming one is a visible, single-line change.
 *
 * A count's text is one whole sentence per plural form (`n`), never a word with an "s" glued on;
 * "{}" marks where a key cap or a field sits inside a sentence (see aroundSlot in ../i18n.ts).
 */
export const en = {
    appName: "Tab Sandwich",
    /** The browser tab's name for the full-page library. */
    libraryPageTitle: "Tab Sandwich Library",
    /** Shown for tabs with no category of their own. The stored name is always the English one. */
    uncategorized: "Uncategorized",
    /**
     * A fresh install's categories, written once in the install's language (at most 15 characters
     * each, the limit for any category's name). From then on they're the user's own names.
     */
    starterCategories: { work: "Work", personal: "Personal", reading: "Reading", entertainment: "Entertainment" },
    searchLabel: "Search saved tabs",
    searchPlaceholder: (count: number) => n(count, { one: `Search ${count} saved tab`, other: `Search ${count} saved tabs` }),
    searchArchivePlaceholder: (count: number) => n(count, { one: `Search ${count} archived tab`, other: `Search ${count} archived tabs` }),
    clearSearch: "Clear search",
    matches: (count: number) => (count === 0 ? "No matching tabs" : n(count, { one: `${count} matching tab`, other: `${count} matching tabs` })),
    addLinkManually: "Add link manually",
    openIn: "Open in",
    openInTooltip: "Open in the side panel or the library",
    openSidePanel: "Open side panel",
    sidePanelFailed: "Chrome couldn't open the side panel.",
    // The save card in the side panel, which can't see the page until Chrome has been asked.
    panelPageTitle: "The page you're on",
    panelPageHint: "Chrome asks once before the first save.",
    panelDenied: "Tab Sandwich needs that to see the page, so nothing was saved.",

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
    saveWindowNew: (count: number) => n(count, { one: `Save ${count} new tab from this window`, other: `Save ${count} new tabs from this window` }),
    saveWindowTooltip: "Saves every web page open in this window into the category picked above (Uncategorized when the page you're on is already saved). Pages you've already saved are skipped.",
    savingWindow: "Saving…",
    windowSaved: (count: number) => (count === 0 ? "Nothing new to save" : n(count, { one: `Saved ${count} tab`, other: `Saved ${count} tabs` })),
    windowSkippedCount: (count: number) => `${count} skipped`,
    windowSkipped: (alreadySaved: number, browserPages: number) =>
        [
            alreadySaved > 0 && `${alreadySaved} already saved`,
            browserPages > 0 && n(browserPages, { one: `${browserPages} browser page`, other: `${browserPages} browser pages` }),
        ]
            .filter(Boolean)
            .join(", "),
    closeTabs: (count: number) => n(count, { one: `Close ${count} tab`, other: `Close ${count} tabs` }),
    closeTabsTooltip: "Close the saved tabs in this window. The tab you're on stays open.",
    closedTabs: (count: number) => n(count, { one: `Closed ${count} tab`, other: `Closed ${count} tabs` }),
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
    outdated: "Waiting",
    outdatedPill: (count: number) => `Waiting (${count})`,
    archived: "Archived",
    archivedPill: (count: number) => `Archived (${count})`,

    sortButton: (choice: string) => `Sort: ${choice}`,
    sortMenuLabel: "Sort saved tabs",
    /** The menu's full wording. */
    sortOptions: {
        custom: "Your order",
        newest: "Newest first",
        oldest: "Oldest first",
        title: "Title (A–Z)",
        site: "Site (A–Z)",
        opened: "Recently opened",
        openedMost: "Most opened",
    } as Record<SortOrder, string>,
    /** The short form the button shows while a sort other than your own order is on. */
    sortShort: { custom: "Your order", newest: "Newest", oldest: "Oldest", title: "Title", site: "Site", opened: "Opened", openedMost: "Most opened" } as Record<SortOrder, string>,

    storageNearlyFull: (pct: number) => `Storage is ${pct}% full.`,
    seeStorage: "See storage",

    savedTabsLabel: "Saved tabs",
    // The list with nothing to show: first run (or everything deleted), and a search with no results.
    emptyTitle: "Nothing saved yet",
    emptyLead: "Tabs you save land here, ready for when you need them.",
    emptyTipsLabel: "Getting started",
    tipSave: "Save the page you're on: pick a category above, then press Save.",
    /** {} = the shortcut's keys. */
    tipShortcut: "Open Tab Sandwich from anywhere with {}",
    tipShortcutUnset: "Open Tab Sandwich from anywhere with a keyboard shortcut.",
    setShortcut: "Set one",
    tipCategories: "Make the categories yours.",

    menuSave: "Save to Tab Sandwich",
    omniboxHint: "Search your saved tabs for <match>%s</match>",
    menuOpenLibrary: "Open library",
    openLibrary: "Open library",
    library: "Library",
    libraryHint: "All your saved tabs on a full page, with room to sort and clean up.",
    libraryAll: "All tabs",
    libraryFilters: "Filter your library",
    libraryWindows: "Saved windows",
    libraryEmpty: "Nothing here.",
    columnTitle: "Title",
    columnCategory: "Category",
    columnSite: "Site",
    columnSaved: "Saved",
    columnOpened: "Opened",
    columnActions: "Actions",
    notOpenedFromHere: "Not opened from Tab Sandwich yet",
    columnOpenedHint: "When you last opened it from Tab Sandwich. Visits outside it aren't counted.",
    openedTimes: (count: number) => n(count, { one: `Opened ${count} time from Tab Sandwich`, other: `Opened ${count} times from Tab Sandwich` }),
    editPageTitle: "Edit tab",
    notOpenedYet: "Not yet",
    daysAgo: (days: number) => (days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`),
    selectAllShown: "Select all shown",
    selectTab: (title: string) => `Select ${title}`,
    toolbarIcon: "Toolbar icon",
    toolbarGroup: "What the toolbar icon opens",
    toolbarPopup: "Popup",
    toolbarPanel: "Side panel",
    toolbarHint: "What clicking the icon or pressing the shortcut opens.",

    welcomeTitle: "Welcome to Tab Sandwich",
    welcomeLead: "Save the tabs you want to keep, close them, and find them again in seconds.",
    welcomePinTitle: "Pin it to your toolbar",
    welcomePinText: "Click the puzzle piece next to the address bar, then the pin beside Tab Sandwich.",
    welcomeSaveTitle: "Save a page",
    welcomeSaveText: "On any page, click the icon, pick a category and press Save. Or right-click any link.",
    welcomeShortcutTitle: "Open it from anywhere",
    /** {} = the shortcut's keys. */
    welcomeShortcutText: "Press {}",
    /** {} = "ts", the address bar's keyword. */
    welcomeSearch: "Or type {} and a word in the address bar to jump to a saved tab.",
    welcomePromise: "Everything stays in this browser. No account, no tracking.",
    welcomeDone: "Got it",
    editCategories: "Edit categories",
    noMatchesTitle: (query: string) => `No saved tabs match “${query}”`,
    noMatchesHint: "Search looks at titles, sites, categories and saved windows. Try fewer letters, or part of a name.",
    noMatchesInFilter: (filter: string) => `Only tabs in ${filter} were searched.`,
    searchAllTabs: "Search all tabs",

    // "What's new": one note per feature release, shown once after updating (see domain/whatsNew.ts).
    // Another language needs only the newest release's note: an older one never shows again.
    whatsNewTitle: (release: string) => `New in ${release}`,
    dismissWhatsNew: "Dismiss what's new",
    whatsNewNotes: {
        "4.2": [
            "Moving a tab feels like picking it up: the list makes room where it will land.",
            "Esc puts it back. On a touchscreen, hold a row for a moment to pick it up.",
            "In light mode, site icons sit on a clean white tile.",
        ],
        "4.1": [
            "Tab Sandwich now comes in eight languages, following Chrome's own.",
            "Roomier forms, and a library that fits a narrow window.",
            "Spotted a clumsy word, or have an idea? Tell us, in Settings › About.",
        ],
        "4.0": [
            "Right-click any link to save it, right into a category.",
            "Keep your list open in a side panel, or browse it all on a full page.",
            "Search from the address bar with ts, and set reminders on any tab.",
        ],
        "3.3": [
            "Categories no longer age. Light the ☾ for the ones you read later, in Settings › Categories.",
            "Archive instead of delete, pin tabs to the top, and add a note on why you saved something.",
            "Search finds categories, saved windows and notes; new pages get a suggested category.",
        ],
        "3.2": [
            "Save every tab in a window at once, then close them in one click.",
            "A saved window stays together as one row, named like “Toasted Rye”.",
            "Select several tabs to move or delete them together.",
        ],
        "3.1": [
            "Sort your list by newest, oldest, title or site.",
            "A page you've already saved says so, with Show and Update.",
            "Everything works from the keyboard. The keys are in Settings › General.",
        ],
    } as Record<string, readonly string[]>,
    categoryForScreenReaders: (category: string) => `Category: ${category}`,
    pinTab: (title: string) => `Pin ${title}`,
    archiveTab: (title: string) => `Archive ${title}`,
    archiveTooltip: "Archive (Delete)",
    archivedToast: "Archived",
    restoreTab: (title: string) => `Restore ${title}`,
    restoreTooltip: "Back to your list",
    restoredToast: "Restored",
    deleteForeverTab: (title: string) => `Delete ${title} for good`,
    deleteForeverTooltip: "Delete for good (Delete)",
    cantMoveArchived: "Restore a tab to move it.",
    allArchivedTitle: "Everything's in the archive",
    allArchivedBody: "Archived tabs leave the list but stay saved, ready to restore.",
    showArchive: "Show the archive",
    searchArchive: "Search the archive",
    unpinTab: (title: string) => `Unpin ${title}`,
    pinTooltip: "Pin to the top (P)",
    unpinTooltip: "Unpin (P)",
    /** Read with a pinned row (the pin on screen shows it). */
    pinnedForScreenReaders: "Pinned",
    pinnedNote: (title: string) => `Pinned “${title}” to the top`,
    unpinnedNote: (title: string) => `Unpinned “${title}”`,
    /** Read before a search result's saved window name (the stack icon shows it on screen). */
    inSavedWindow: "Saved window:",
    savedDaysAgo: (days: number) => n(days, { one: `Saved ${days} day ago`, other: `Saved ${days} days ago` }),
    ageBadge: (days: number) => `${days}d`,
    // Choosing several tabs at once.
    selectTabs: "Select tabs",
    selectTooltip: "Select several tabs, to move or delete them together",
    selectedCount: (count: number) => (count === 0 ? "None selected" : `${count} selected`),
    selectAll: "Select all",
    selectAllTooltip: "Select every tab shown, including the tabs in saved windows",
    moveTo: "Move to…",
    moveToLabel: "Move the selected tabs to a category",
    deleteSelectedLabel: (count: number) => n(count, { one: `Delete ${count} selected tab for good`, other: `Delete ${count} selected tabs for good` }),
    archiveSelectedLabel: (count: number) => n(count, { one: `Archive ${count} selected tab`, other: `Archive ${count} selected tabs` }),
    restoreSelectedLabel: (count: number) => n(count, { one: `Restore ${count} selected tab`, other: `Restore ${count} selected tabs` }),
    restoreSelected: "Restore",
    stopSelecting: "Stop selecting",
    stopSelectingTooltip: "Stop selecting (Esc)",
    selectionBarLabel: "Selected tabs",
    selectWindow: (name: string) => `Select every tab in ${name}`,
    toggleWindow: "Open or close this saved window",
    movedTabs: (count: number, category: string) => n(count, { one: `Moved ${count} tab to ${category}`, other: `Moved ${count} tabs to ${category}` }),
    deletedTabs: (count: number) => n(count, { one: `Deleted ${count} tab`, other: `Deleted ${count} tabs` }),
    archivedTabs: (count: number) => n(count, { one: `Archived ${count} tab`, other: `Archived ${count} tabs` }),
    restoredTabs: (count: number) => n(count, { one: `Restored ${count} tab`, other: `Restored ${count} tabs` }),
    archiveAllWaiting: (count: number) => n(count, { one: `Archive all ${count} waiting tab`, other: `Archive all ${count} waiting tabs` }),
    cleanupTip: (count: number) => n(count, { one: `${count} kept tab not opened in 6 months`, other: `${count} kept tabs not opened in 6 months` }),
    cleanupArchive: "Archive them",
    cleanupNotNow: "Not now",
    archiveAllWaitingHint: "Still saved: restore any of them from Archived.",

    // Saved windows (groups) in the list.
    /**
     * A saved window's random, sandwich-style name ("Toasted Rye"): a name that belongs to no one
     * tab in it. `pick` chooses one of a list at random, and each language puts its own words
     * together, so its adjectives can agree with its nouns. Kept as made, whatever the language
     * later; its count and date are shown beside it, worked out live.
     */
    groupName: (pick: Picker) => `${pick(ADJECTIVES)} ${pick(NOUNS)}`,
    groupTabCount: (count: number) => n(count, { one: `${count} tab`, other: `${count} tabs` }),
    /** When a window was saved: "6 Oct", with the year once it isn't this year's. */
    groupSavedOn: (date: Date) =>
        new Intl.DateTimeFormat(tag, {
            day: "numeric",
            month: "short",
            year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
        }).format(date),
    groupMore: (count: number) => `+${count}`,
    groupActions: (name: string) => `Actions for ${name}`,
    groupActionsTooltip: "Open, rename, break apart or archive",
    openGroup: "Open all in a new window",
    openGroupAndRemove: "Open all and archive them",
    renameGroup: "Rename",
    groupNameLabel: "Saved window name",
    ungroup: "Break apart",
    // "Remove", not "Delete": it's about the list, and closes nothing in the browser.
    archiveGroup: "Archive",
    groupArchived: (count: number) => n(count, { one: `Archived ${count} tab`, other: `Archived ${count} tabs` }),
    groupBrokenApart: "Broken apart",
    groupOpened: (count: number) => n(count, { one: `Opened ${count} tab and archived it`, other: `Opened ${count} tabs and archived them` }),
    editTab: (title: string) => `Edit ${title}`,
    deleteTab: (title: string) => `Delete ${title}`,
    editTooltip: "Edit",
    deleteTooltip: "Delete",

    titleLabel: "Title",
    noteLabel: "Note",
    reminderLabel: "Reminder",
    reminderWithoutNotifications: "Reminder set. Without notifications, it will show under Waiting.",
    reminderNone: "No reminder",
    reminderTomorrow: "Remind me tomorrow",
    reminderNextWeek: (at: number) => `Remind me next week, ${reminderDate(at)}`,
    reminderKept: (at: number) => `Reminder: ${reminderDate(at)}`,
    /** On a row. (Reminders arrive in the morning, so "today" before then.) */
    reminderShort: (at: number, now: number) => ({ due: "Due", today: "Today", tomorrow: "Tomorrow", later: reminderDate(at) })[reminderDay(at, now)],
    reminderWhen: (at: number) => `Reminder: ${reminderDate(at)}, 9:00`,
    /** A notification: the tab's own title is its heading. */
    reminderMessage: (site: string) => `Your reminder from Tab Sandwich · ${site}`,
    remindersTitle: (count: number) => n(count, { one: `${count} saved tab to come back to`, other: `${count} saved tabs to come back to` }),
    remindersMessage: "Click to see them in your library.",
    notifications: "Reminder notifications",
    notificationsOnHint: "A notification at 9:00 when a reminder is due.",
    notificationsOffHint: "Off: a due reminder just shows under Waiting.",
    /** The toolbar icon's name while the badge says a link was already there. */
    alreadySavedIn: (category: string) => `Already saved in ${category}`,
    turnOn: "Turn on",
    turnOff: "Turn off",
    badgeLabel: "Waiting count",
    badgeHint: "Shows on the toolbar icon how many tabs are waiting, reminders due included.",
    badgeTitle: (count: number) => `Tab Sandwich: ${count} waiting`,
    notePlaceholder: "Why you saved it (optional)",
    addNote: "Add a note",
    suggestedLabel: (label: string) => `${label} (suggested from where you saved pages like it)`,
    suggestedTooltip: "Suggested from where you saved pages like this one",
    titlePlaceholder: "Title",
    categoryLabel: "Category",
    editUrlPlaceholder: "https://example.com",
    enterValidUrlSentence: "Enter a valid URL.",
    alreadySavedAs: (title: string) => `Already saved as “${title}”.`,
    archivedAs: (title: string) => `In your archive, as “${title}”.`,
    inYourArchive: "In your archive",
    restore: "Restore",
    restoreSavedTooltip: "Bring it back to your list",

    // Keyboard control of the list (stage 4 of v3.1).
    movedTo: (title: string, position: number, total: number) => `Moved “${title}” to position ${position} of ${total}`,
    movedOutOf: (name: string) => `Moved out of ${name}`,
    movedInto: (name: string) => `Moved into ${name}`,
    /** Read out after Alt+arrows steps a tab out of its saved window. */
    steppedOutOf: (title: string, name: string) => `Moved “${title}” out of ${name}`,
    cantMoveSorted: "Tabs can only be moved in your own order. Switch the sort to Your order first.",
    cantMoveSearching: "Clear the search to move tabs.",
    pinLine: (pinned: boolean): string =>
        pinned ? "Pinned tabs stay above the others. Press P to unpin it." : "Pinned tabs stay above the others. Press P to pin this one.",
    /** The same, after a drag that couldn't land there. */
    pinLineDrag: (pinned: boolean): string =>
        pinned ? "Pinned tabs stay above the others. Unpin it to move it lower." : "Pinned tabs stay above the others. Pin it to move it up there.",
    keyboardKeys: "Keys in the list",
    keyHelp: {
        search: "Jump to search",
        move: "Move through your saved tabs",
        open: "Open the tab",
        window: "Open or close a saved window",
        select: "Select or unselect, while selecting",
        edit: "Edit it",
        pin: "Pin it to the top, or unpin it",
        addressBar: "In the address bar: search your saved tabs",
        delete: "Delete it",
        undo: "Undo, while Undo is showing",
        reorder: "Move it up or down (in your own order)",
        back: "Back to search",
    },
    /** Key caps as printed on keyboards in this language (a Mac shows its symbols instead). */
    keyNames: { enter: "Enter", delete: "Delete", ctrl: "Ctrl", alt: "Alt", space: "Space", esc: "Esc" },
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
    themeHint: "System follows your computer's light or dark setting, even while Tab Sandwich is open.",
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
    tabCount: (count: number) => n(count, { one: `${count} tab`, other: `${count} tabs` }),
    /** The moon on a category's row: lit = its tabs age and show as waiting; dim = kept. */
    waitingToggle: (name: string) => `Waiting reminder for ${name}`,
    waitingOnTitle: (days: number) => n(days, { one: `Its tabs show as waiting after ${days} day`, other: `Its tabs show as waiting after ${days} days` }),
    waitingOffTitle: "Kept: its tabs never show as waiting",
    /** The days field's name. */
    waitingAfter: "Show as waiting after",
    /** The sentence the days field sits in, at the top of Categories: {} = the field. */
    waitingAfterDays: (days: number) => n(days, { one: "Show as waiting after {} day", other: "Show as waiting after {} days" }),
    /** Under the days field: the legend for every row's moon. */
    waitingAfterHint: "Only in categories with the moon lit; others are kept.",
    renameRefusal: {
        empty: "Name can't be empty.",
        gone: "Category no longer exists.",
        taken: "That name is already used by another category.",
    },
    removeRefusal: {
        reserved: '"Uncategorized" can\'t be removed.',
    },
    /** Removing a category its tabs still use: asked in the row itself, then Undo in the toast. */
    removeConfirmTitle: (name: string) => `Remove ${name}?`,
    removeConfirmDetail: (count: number, archived: number) => {
        if (archived === 0) return n(count, { one: "Its tab becomes Uncategorized", other: `Its ${count} tabs become Uncategorized` });
        if (archived === count) return n(count, { one: "Its archived tab becomes Uncategorized", other: `Its ${count} archived tabs become Uncategorized` });
        return `${count} tabs (${archived} archived) become Uncategorized`;
    },
    removeConfirm: "Remove",
    removedCategoryToast: (name: string) => `Removed ${name}`,
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
        n(tabs, {
            one: `This file contains ${tabs} tab. Merge adds anything new; Replace overwrites everything currently saved.`,
            other: `This file contains ${tabs} tabs. Merge adds anything new; Replace overwrites everything currently saved.`,
        }),
    merge: "Merge",
    replaceAll: "Replace all",
    exported: (tabs: number) => n(tabs, { one: `Exported ${tabs} tab.`, other: `Exported ${tabs} tabs.` }),
    nothingNew: "Nothing new — everything in this file is already saved.",
    imported: (tabs: number, categories: number) =>
        `Imported ${[
            tabs > 0 ? n(tabs, { one: `${tabs} tab`, other: `${tabs} tabs` }) : "",
            categories > 0 ? n(categories, { one: `${categories} category`, other: `${categories} categories` }) : "",
        ]
            .filter(Boolean)
            .join(" and ")}`,
    replacedAll: "Replaced all tabs and settings",
    notABackup: "That file doesn't look like a Tab Sandwich backup.",

    version: (v: string) => `Version ${v}`,
    localPromise: "Everything stays in this browser. No account, no server, no analytics. Your tabs leave the browser only when you export them.",
    privacyPolicy: "Privacy policy",
    sourceCode: "Source code",
    /** In About: {} = the link to the feedback form. */
    feedbackAsk: "Spotted a clumsy word, or have an idea? {}",
    feedbackLink: "Tell us",
    feedbackTooltip: "Opens a short form (Google Forms) with your language and Tab Sandwich's version filled in. Nothing is sent until you send it.",
};

export type Strings = typeof en;
