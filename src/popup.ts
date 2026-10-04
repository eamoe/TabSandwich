import { migrateFromLocalStorageIfNeeded } from "./storage/migration";
import { upgradeStoredData } from "./storage/upgrade";
import { refreshView } from "./render/viewController";
import { initHero } from "./render/HeroRenderer";
import { initSettings } from "./render/SettingsRenderer";
import { initSearch } from "./render/SearchRenderer";
import { initToast, showErrorToast } from "./render/ToastRenderer";

document.addEventListener("DOMContentLoaded", async () => {
    // First, so an upgrade problem below can be reported.
    initToast();
    // Neither step may stop the popup from starting: whatever happens to them, the list still
    // renders from whatever is stored and every control still gets wired up below.
    try {
        await migrateFromLocalStorageIfNeeded();
    } catch {
        // Only fails if its one write is rejected; it simply retries on the next open.
    }
    const upgrade = await upgradeStoredData();
    if (upgrade.status === "failed") {
        // Nothing was changed (see upgradeStoredData), so the app keeps working on the data as it was.
        showErrorToast("Couldn't update your saved data for this version. Nothing was changed.");
    }
    await refreshView();
    initHero(refreshView);
    // After the first render so focusing the search input never races the initial paint.
    initSearch(refreshView);
    await initSettings(refreshView);
    // Every control is wired up from here on. The robot tests wait for this before clicking
    // anything, since buttons are on screen a moment before their handlers are attached.
    document.body.dataset.ready = "true";
});
