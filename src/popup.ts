import { migrateFromLocalStorageIfNeeded } from "./storage/migration";
import { refreshView } from "./render/viewController";
import { initHero } from "./render/HeroRenderer";
import { initSettings } from "./render/SettingsRenderer";
import { initSearch } from "./render/SearchRenderer";
import { initToast } from "./render/ToastRenderer";

document.addEventListener("DOMContentLoaded", async () => {
    await migrateFromLocalStorageIfNeeded();
    await refreshView();
    initHero(refreshView);
    // After the first render so focusing the search input never races the initial paint.
    initSearch(refreshView);
    initToast();
    await initSettings(refreshView);
});
