import { migrateFromLocalStorageIfNeeded } from "./storage/migration";
import { refreshView } from "./render/viewController";
import { initHero } from "./render/HeroRenderer";
import { initSettings } from "./render/SettingsRenderer";

document.addEventListener("DOMContentLoaded", async () => {
    await migrateFromLocalStorageIfNeeded();
    await refreshView();
    initHero(refreshView);
    await initSettings(refreshView);
});
