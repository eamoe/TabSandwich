import "./ui/tokens.css";
import "./ui/base.css";
import { h, render } from "preact";
import { migrateFromLocalStorageIfNeeded } from "./storage/migration";
import { upgradeStoredData } from "./storage/upgrade";
import { getLastSeenVersion, getSettings, getTabs, isStorageEmpty, setLastSeenVersion } from "./storage/chromeStorage";
import { whatsNewToShow } from "./domain/whatsNew";
import { applyTheme } from "./ui/theme";
import { showErrorToast } from "./ui/toastStore";
import { strings } from "./ui/strings";
import { App } from "./ui/main/App";

document.addEventListener("DOMContentLoaded", async () => {
    // A fresh install: nothing stored when the popup first opens (asked before the steps below,
    // which write even into empty storage), and no old-version data for the migration to bring in.
    const storageWasEmpty = await isStorageEmpty();
    // Neither step may stop the popup from starting: whatever happens to them, it still renders
    // from whatever is stored.
    try {
        await migrateFromLocalStorageIfNeeded();
    } catch {
        // Only fails if its one write is rejected; it simply retries on the next open.
    }
    const freshInstall = storageWasEmpty && (await getTabs()).length === 0;
    const upgrade = await upgradeStoredData();
    if (upgrade.status === "failed") {
        // Nothing was changed (see upgradeStoredData), so the app keeps working on the data as it
        // was. The toast store keeps this until the toast is on screen to show it.
        showErrorToast(strings.upgradeFailed);
    }
    // Before anything renders, so an explicit Light/Dark choice never flashes the other theme.
    // "System" (the default) needs no script at all — tokens.css follows the OS on its own.
    applyTheme((await getSettings()).theme);
    render(h(App, { whatsNew: await whatsNewOnOpen(freshInstall) }), document.getElementById("app")!);
});

/**
 * The release whose "What's new" note to show, if any. A fresh install records the current
 * version straight away, so its first update (not this open) is the first to show a note.
 * Never stops the popup from starting.
 */
async function whatsNewOnOpen(freshInstall: boolean): Promise<string | null> {
    try {
        const current = chrome.runtime.getManifest().version;
        if (freshInstall) await setLastSeenVersion(current);
        return whatsNewToShow({ current, lastSeen: await getLastSeenVersion(), freshInstall, notes: Object.keys(strings.whatsNewNotes) });
    } catch {
        return null;
    }
}
