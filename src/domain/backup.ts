import { SavedTab, Settings, SortOrder, TabGroup, ThemeChoice } from "../types";
import { DEFAULT_SETTINGS } from "../storage/chromeStorage";
import { normalizeUrl, urlsMatch } from "../util/url";
import { CATEGORY_COLOR_PALETTE, UNCATEGORIZED } from "./CategoryRepository";

/** 2 since v3.2: adds saved windows (`groups`, and `groupId` on their tabs). Version 1 files still import. */
export const BACKUP_FORMAT_VERSION = 2;

export interface BackupFile {
    version: number;
    exportedAt: string;
    tabs: SavedTab[];
    settings: Settings;
    groups: TabGroup[];
}

export function buildBackupFile(tabs: SavedTab[], settings: Settings, groups: TabGroup[] = []): BackupFile {
    return { version: BACKUP_FORMAT_VERSION, exportedAt: new Date().toISOString(), tabs, settings, groups };
}

export function backupFileName(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `tab-sandwich-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/** `groupId` here is the id the file used — only for matching tabs to the file's groups; never kept. */
type ImportedTab = Pick<SavedTab, "title" | "url" | "category" | "savedAt" | "groupId">;

export interface ParsedImport {
    tabs: ImportedTab[];
    settingsFields: Partial<Settings>;
    /** The file's saved windows, with the file's ids. */
    groups: TabGroup[];
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
    return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isThemeChoice(x: unknown): x is ThemeChoice {
    return x === "system" || x === "light" || x === "dark";
}

function isSortOrder(x: unknown): x is SortOrder {
    return x === "custom" || x === "newest" || x === "oldest" || x === "title" || x === "site";
}

/** Rejects the entry (not just a field) on any type mismatch — a foreign JSON file should fail loudly, not get silently reinterpreted. */
function readImportedTab(raw: unknown): ImportedTab | null {
    if (!isPlainObject(raw)) return null;
    if (typeof raw.title !== "string" || !raw.title.trim()) return null;
    if (typeof raw.url !== "string") return null;
    const url = normalizeUrl(raw.url);
    if (!url) return null;
    return {
        title: raw.title,
        url,
        category: typeof raw.category === "string" ? raw.category : undefined,
        savedAt: typeof raw.savedAt === "number" && Number.isFinite(raw.savedAt) ? raw.savedAt : Date.now(),
        groupId: typeof raw.groupId === "string" ? raw.groupId : undefined,
    };
}

/** Lenient, like settings: a malformed group is left out, and its tabs import ungrouped. */
function readImportedGroups(raw: unknown): TabGroup[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((g): TabGroup[] =>
        isPlainObject(g) && typeof g.id === "string" && typeof g.name === "string" && g.name.trim()
            ? [
                  {
                      id: g.id,
                      name: g.name,
                      createdAt: typeof g.createdAt === "number" && Number.isFinite(g.createdAt) ? g.createdAt : Date.now(),
                      collapsed: typeof g.collapsed === "boolean" ? g.collapsed : true,
                  },
              ]
            : []
    );
}

/**
 * Hand-rolled shape validation (no schema library — this project has none). Any malformed
 * tab entry rejects the whole file rather than silently dropping it: for a personal backup
 * tool, a loud "this isn't a valid backup" beats a partial, unexplained import. `settings`
 * is deliberately lenient — a missing or malformed field there just falls back to defaults
 * later, since the tabs are the payload that actually matters.
 */
export function parseBackupFile(raw: string): ParsedImport | null {
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!isPlainObject(data) || !Array.isArray(data.tabs)) return null;

    const tabs: ImportedTab[] = [];
    for (const entry of data.tabs) {
        const tab = readImportedTab(entry);
        if (!tab) return null;
        tabs.push(tab);
    }

    const settingsFields: Partial<Settings> = {};
    if (isPlainObject(data.settings)) {
        const s = data.settings;
        if (typeof s.outdatedEnabled === "boolean") settingsFields.outdatedEnabled = s.outdatedEnabled;
        if (typeof s.outdatedDays === "number" && s.outdatedDays >= 1 && s.outdatedDays <= 365) {
            settingsFields.outdatedDays = s.outdatedDays;
        }
        if (Array.isArray(s.categories) && s.categories.every((c) => typeof c === "string")) {
            settingsFields.categories = s.categories as string[];
        }
        if (isPlainObject(s.categoryColors)) {
            const colors: Record<string, string> = {};
            for (const [key, value] of Object.entries(s.categoryColors)) {
                if (typeof value === "string" && value in CATEGORY_COLOR_PALETTE) colors[key] = value;
            }
            settingsFields.categoryColors = colors;
        }
        if (isThemeChoice(s.theme)) settingsFields.theme = s.theme;
        if (isSortOrder(s.sort)) settingsFields.sort = s.sort;
    }

    return { tabs, settingsFields, groups: readImportedGroups(data.groups) };
}

/**
 * Ids are always regenerated, never trusted from the file — guards against colliding with
 * existing ids and against duplicate ids within the file itself. Groups get new ids too, and
 * their tabs follow them; a group none of the given tabs belong to is left out, and a tab
 * naming a group the file doesn't have imports ungrouped.
 */
function assignFreshIds(tabs: ImportedTab[], fileGroups: TabGroup[]): { tabs: SavedTab[]; groups: TabGroup[] } {
    const newIds = new Map<string, string>();
    const groups: TabGroup[] = [];
    for (const group of fileGroups) {
        if (newIds.has(group.id) || !tabs.some((t) => t.groupId === group.id)) continue;
        const fresh = { ...group, id: crypto.randomUUID() };
        newIds.set(group.id, fresh.id);
        groups.push(fresh);
    }
    return {
        tabs: tabs.map(({ groupId, ...tab }) => {
            const newGroupId = groupId === undefined ? undefined : newIds.get(groupId);
            return newGroupId ? { ...tab, id: crypto.randomUUID(), groupId: newGroupId } : { ...tab, id: crypto.randomUUID() };
        }),
        groups,
    };
}

/**
 * Adds categories from two sources: the imported file's own category list (a category can be
 * worth restoring even if none of the tabs being added currently use it — e.g. re-merging a
 * backup after deleting both a category and every tab that used it locally), and any category
 * an imported tab references that the list above missed (covers older/foreign files with tabs
 * but no settings.categories). Never touches a category that already exists locally — merging
 * shouldn't silently overwrite a color you've since changed for something you kept.
 */
function unionCategories(
    settings: Settings,
    importedCategories: string[] | undefined,
    importedColors: Record<string, string> | undefined,
    tabs: Array<{ category?: string }>
): Settings {
    const categories = [...settings.categories];
    const categoryColors = { ...settings.categoryColors };
    const paletteKeys = Object.keys(CATEGORY_COLOR_PALETTE);

    const addCategory = (name: string, preferredColorKey?: string) => {
        if (!name || name === UNCATEGORIZED || categories.includes(name)) return;
        categories.push(name);
        categoryColors[name] =
            preferredColorKey && preferredColorKey in CATEGORY_COLOR_PALETTE
                ? preferredColorKey
                : paletteKeys[Object.keys(categoryColors).length % paletteKeys.length];
    };

    for (const name of importedCategories ?? []) {
        addCategory(name, importedColors?.[name]);
    }
    for (const { category } of tabs) {
        if (category) addCategory(category);
    }

    return { ...settings, categories, categoryColors };
}

export interface ApplyImportResult {
    tabs: SavedTab[];
    settings: Settings;
    groups: TabGroup[];
    /** Tabs actually added — for merge this excludes duplicates skipped via urlsMatch. */
    addedCount: number;
    /**
     * Categories actually added — tracked separately from addedCount because a merge can
     * restore a category (from the file's own settings.categories) with zero new tabs to
     * show for it, e.g. every tab that used it locally was already deleted. A caller that
     * only checked addedCount === 0 to decide "nothing changed, skip the write" would silently
     * drop that restored category on the floor.
     */
    addedCategoryCount: number;
}

/** Additive: keeps every existing tab and setting, adds only what's genuinely new (by URL). */
export function mergeImport(
    existingTabs: SavedTab[],
    existingSettings: Settings,
    imported: ParsedImport,
    existingGroups: TabGroup[] = []
): ApplyImportResult {
    const toAdd: ImportedTab[] = [];
    for (const tab of imported.tabs) {
        const isDuplicate =
            existingTabs.some((e) => urlsMatch(e.url, tab.url)) || toAdd.some((a) => urlsMatch(a.url, tab.url));
        if (!isDuplicate) toAdd.push(tab);
    }
    // A saved window comes along only with the tabs of it that are actually new.
    const { tabs: newTabs, groups: newGroups } = assignFreshIds(toAdd, imported.groups);
    const settings = unionCategories(
        existingSettings,
        imported.settingsFields.categories,
        imported.settingsFields.categoryColors,
        newTabs
    );
    return {
        tabs: [...newTabs, ...existingTabs],
        settings,
        groups: [...newGroups, ...existingGroups],
        addedCount: newTabs.length,
        addedCategoryCount: settings.categories.length - existingSettings.categories.length,
    };
}

/** Destructive: the imported file becomes the entire saved state. Missing settings fields fall back to defaults, same as a fresh install. */
export function replaceImport(imported: ParsedImport): ApplyImportResult {
    const deduped: ImportedTab[] = [];
    for (const tab of imported.tabs) {
        if (!deduped.some((d) => urlsMatch(d.url, tab.url))) deduped.push(tab);
    }
    const { tabs, groups } = assignFreshIds(deduped, imported.groups);
    const baseSettings: Settings = { ...DEFAULT_SETTINGS, ...imported.settingsFields };
    // baseSettings.categories already came from the file wholesale — this backfill only
    // covers a tab referencing a category the file's own settings.categories list missed.
    const settings = unionCategories(baseSettings, undefined, undefined, tabs);
    return {
        tabs,
        settings,
        groups,
        addedCount: tabs.length,
        addedCategoryCount: settings.categories.length - baseSettings.categories.length,
    };
}
