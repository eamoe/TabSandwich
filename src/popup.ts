import { getTabs } from "./storage/chromeStorage";
import { migrateFromLocalStorageIfNeeded } from "./storage/migration";
import { renderList } from "./render/ListRenderer";
import { renderHeroStats, initHero } from "./render/HeroRenderer";

document.addEventListener("DOMContentLoaded", async () => {
    await migrateFromLocalStorageIfNeeded();
    const tabs = await getTabs();
    renderList(tabs);
    await renderHeroStats(tabs);
    initHero();
});
