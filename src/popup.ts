import "./ui/tokens.css";
import "./ui/base.css";
import { h, render } from "preact";
import { migrateFromLocalStorageIfNeeded } from "./storage/migration";
import { upgradeStoredData } from "./storage/upgrade";
import { getSettings } from "./storage/chromeStorage";
import { applyTheme } from "./ui/theme";
import { showErrorToast } from "./ui/toastStore";
import { strings } from "./ui/strings";
import { App } from "./ui/main/App";

document.addEventListener("DOMContentLoaded", async () => {
    // Neither step may stop the popup from starting: whatever happens to them, it still renders
    // from whatever is stored.
    try {
        await migrateFromLocalStorageIfNeeded();
    } catch {
        // Only fails if its one write is rejected; it simply retries on the next open.
    }
    const upgrade = await upgradeStoredData();
    if (upgrade.status === "failed") {
        // Nothing was changed (see upgradeStoredData), so the app keeps working on the data as it
        // was. The toast store keeps this until the toast is on screen to show it.
        showErrorToast(strings.upgradeFailed);
    }
    // Before anything renders, so an explicit Light/Dark choice never flashes the other theme.
    // "System" (the default) needs no script at all — tokens.css follows the OS on its own.
    applyTheme((await getSettings()).theme);
    render(h(App, null), document.getElementById("app")!);
});
