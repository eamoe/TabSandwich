import { migrateFromLocalStorageIfNeeded } from "./storage/migration.js";
import { refreshView } from "./render/viewController.js";
import { initHero } from "./render/HeroRenderer.js";
import { initSettings } from "./render/SettingsRenderer.js";
document.addEventListener("DOMContentLoaded", async () => {
    await migrateFromLocalStorageIfNeeded();
    await refreshView();
    initHero(refreshView);
    await initSettings(refreshView);
});
