import { getTabs } from "./storage/chromeStorage";
import { renderList } from "./render/ListRenderer";
import { renderHeroStats, initHero } from "./render/HeroRenderer";

document.addEventListener("DOMContentLoaded", async () => {
    const tabs = await getTabs();
    renderList(tabs);
    await renderHeroStats(tabs);
    initHero();
});
