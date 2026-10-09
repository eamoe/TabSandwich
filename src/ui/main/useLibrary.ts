import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { SavedTab, Settings, TabGroup } from "../../types";
import { getCleanupTipHiddenUntil, getGroups, getOpenTrackingSince, getSettings, getStorageUsage, getTabs } from "../../storage/chromeStorage";

export interface Library {
    tabs: SavedTab[];
    settings: Settings;
    /** Saved windows; a tab joins one through its groupId. */
    groups: TabGroup[];
    /** Share of Chrome's storage allowance in use, 0–100. */
    storagePct: number;
    /** Since when opens from Tab Sandwich have been counted. */
    openTrackingSince: number;
    /** The cleanup tip stays away until then ("Not now"). */
    cleanupTipHiddenUntil: number;
}

/**
 * Loads everything the popup shows (both screens read from it), and reloads on demand after
 * any change. Each load gets a number and only the newest may update the screen: loads are
 * several async reads, and a slow older one must never paint over a newer one.
 */
export function useLibrary(): { library: Library | null; reload: () => Promise<void> } {
    const [library, setLibrary] = useState<Library | null>(null);
    const latest = useRef(0);

    const reload = useCallback(async () => {
        const ticket = ++latest.current;
        const [tabs, settings, groups, usage, openTrackingSince, cleanupTipHiddenUntil] = await Promise.all([
            getTabs(),
            getSettings(),
            getGroups(),
            getStorageUsage(),
            getOpenTrackingSince(),
            getCleanupTipHiddenUntil(),
        ]);
        if (ticket !== latest.current) return;
        const storagePct = usage.quotaBytes > 0 ? Math.min((usage.bytesInUse / usage.quotaBytes) * 100, 100) : 0;
        setLibrary({ tabs, settings, groups, storagePct, openTrackingSince, cleanupTipHiddenUntil });
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    return { library, reload };
}
