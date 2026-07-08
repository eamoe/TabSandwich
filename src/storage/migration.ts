import { SavedTab } from "../types";
import { hasStoredTabs, setTabs } from "./chromeStorage";

const LEGACY_STORAGE_KEY = "links";

interface LegacyItem {
    url?: string;
    description?: string;
}

function readLegacyItems(): LegacyItem[] {
    try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        // Invalid/corrupt legacy data is treated as "nothing to migrate" — never throws.
        return [];
    }
}

/** Migrated entries share one savedAt (the previous version never recorded one); index keeps ids unique within the batch. */
function mapLegacyItem(item: LegacyItem, savedAt: number, index: number): SavedTab | null {
    if (!item || typeof item.url !== "string" || !item.url) return null;

    let hostname: string;
    try {
        hostname = new URL(item.url).hostname;
    } catch {
        return null; // an unparsable legacy URL can't be carried forward
    }

    return {
        id: `legacy-${savedAt}-${index}`,
        title: item.description?.trim() || hostname,
        url: item.url,
        savedAt,
    };
}

/**
 * One-time upgrade path (FR-017). Safe to call on every popup startup: no-ops as soon as
 * `tabSandwich.tabs` already exists, per the migration-completed signal documented in research.md.
 */
export async function migrateFromLocalStorageIfNeeded(): Promise<void> {
    if (await hasStoredTabs()) return;

    const legacyItems = readLegacyItems();
    const savedAt = Date.now();
    const migrated = legacyItems
        .map((item, index) => mapLegacyItem(item, savedAt, index))
        .filter((tab): tab is SavedTab => tab !== null);

    // Written even when empty (fresh install) so tabSandwich.tabs exists and this never re-runs.
    await setTabs(migrated);
}
