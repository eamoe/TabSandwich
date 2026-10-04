import "./ui/tokens.css";
import "./ui/base.css";
import { h, render } from "preact";
import { migrateFromLocalStorageIfNeeded } from "./storage/migration";
import { upgradeStoredData } from "./storage/upgrade";
import { getSettings } from "./storage/chromeStorage";
import { refreshView } from "./render/viewController";
import { initSettings } from "./render/SettingsRenderer";
import { getElement } from "./dom/domHelper";
import { applyTheme } from "./ui/theme";
import { showErrorToast } from "./ui/toastStore";
import { App } from "./ui/main/App";

document.addEventListener("DOMContentLoaded", async () => {
    // Neither step may stop the popup from starting: whatever happens to them, the list still
    // renders from whatever is stored and every control still gets wired up below.
    try {
        await migrateFromLocalStorageIfNeeded();
    } catch {
        // Only fails if its one write is rejected; it simply retries on the next open.
    }
    const upgrade = await upgradeStoredData();
    if (upgrade.status === "failed") {
        // Nothing was changed (see upgradeStoredData), so the app keeps working on the data as it
        // was. The toast store keeps this until the toast is on screen to show it.
        showErrorToast("Couldn't update your saved data for this version. Nothing was changed.");
    }
    // Before anything renders, so an explicit Light/Dark choice never flashes the other theme.
    // "System" (the default) needs no script at all — tokens.css follows the OS on its own.
    applyTheme((await getSettings()).theme);
    // Settings (still the pre-v3.0 screen) is wired before the main screen renders, so every
    // control works by the time the app marks the page ready (see App: data-ready).
    await initSettings(refreshView);
    render(h(App, null), getElement<HTMLElement>("app"));
});
