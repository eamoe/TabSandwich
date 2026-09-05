import { migrateFromLocalStorageIfNeeded } from "./storage/migration";
import { refreshView } from "./render/viewController";
import { initHero } from "./render/HeroRenderer";
import { initSettings } from "./render/SettingsRenderer";
import { initSearch } from "./render/SearchRenderer";

document.addEventListener("DOMContentLoaded", async () => {
    await migrateFromLocalStorageIfNeeded();
    await refreshView();
    initHero(refreshView);
    // After the first render so focusing the search input never races the initial paint.
    initSearch(refreshView);
    await initSettings(refreshView);
});
