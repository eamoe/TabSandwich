import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { SavedTab, Settings } from "../../types";
import { getSettings, getStorageUsage, getTabs } from "../../storage/chromeStorage";
import { onLibraryChanged } from "../libraryEvents";

export interface Library {
    tabs: SavedTab[];
    settings: Settings;
    /** Share of Chrome's storage allowance in use, 0–100. */
    storagePct: number;
}

/**
 * Loads everything the main screen shows, and reloads on demand or whenever Settings reports a
 * change. Each load gets a number and only the newest may update the screen: loads are
 * several async reads, and a slow older one must never paint over a newer one.
 */
export function useLibrary(): { library: Library | null; reload: () => Promise<void> } {
    const [library, setLibrary] = useState<Library | null>(null);
    const latest = useRef(0);

    const reload = useCallback(async () => {
        const ticket = ++latest.current;
        const [tabs, settings, usage] = await Promise.all([getTabs(), getSettings(), getStorageUsage()]);
        if (ticket !== latest.current) return;
        const storagePct = usage.quotaBytes > 0 ? Math.min((usage.bytesInUse / usage.quotaBytes) * 100, 100) : 0;
        setLibrary({ tabs, settings, storagePct });
    }, []);

    useEffect(() => {
        void reload();
        return onLibraryChanged(() => void reload());
    }, [reload]);

    return { library, reload };
}
