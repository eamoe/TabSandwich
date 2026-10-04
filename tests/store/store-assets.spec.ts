import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test } from "../e2e/fixtures";
import { expect } from "../e2e/fixtures";
import { openSettings, seedLibrary } from "../e2e/helpers";

const OUT = "store-assets";

const LIBRARY = [
    { title: "GitHub: Let's build from here", url: "https://github.com/", category: "Work" },
    { title: "MDN Web Docs", url: "https://developer.mozilla.org/en-US/", category: "Work", daysAgo: 2 },
    { title: "Figma: The Collaborative Interface Design Tool", url: "https://www.figma.com/", category: "Work", daysAgo: 12 },
    { title: "Sandwich - Wikipedia", url: "https://en.wikipedia.org/wiki/Sandwich", category: "Reading", daysAgo: 9 },
    { title: "Hacker News", url: "https://news.ycombinator.com/", category: "Reading" },
    { title: "BBC News - Home", url: "https://www.bbc.com/news", category: "Reading", daysAgo: 4 },
    { title: "Lisbon – Travel guide at Wikivoyage", url: "https://en.wikivoyage.org/wiki/Lisbon", category: "Travel", daysAgo: 15 },
    { title: "BBC Food – Recipes", url: "https://www.bbc.co.uk/food", category: "Recipes", daysAgo: 2 },
    { title: "Stack Overflow", url: "https://stackoverflow.com/", daysAgo: 1 },
];
const SETTINGS = {
    categories: ["Work", "Reading", "Travel", "Recipes"],
    categoryColors: { Work: "blue", Reading: "purple", Travel: "teal", Recipes: "coral" },
};

// The 3D logo (the main screenshot shows it, as the previous Store listing did).
const LOGO = `data:image/png;base64,${readFileSync("store-assets/3d-branded-logo.png").toString("base64")}`;

const BACKGROUNDS = {
    light: "radial-gradient(circle at 85% 15%, rgba(255,255,255,.18) 0 160px, transparent 161px), radial-gradient(circle at 70% 105%, rgba(255,194,75,.35) 0 120px, transparent 121px), linear-gradient(135deg, #7A71E0, #584FA3)",
    dark: "radial-gradient(circle at 85% 15%, rgba(255,255,255,.08) 0 160px, transparent 161px), radial-gradient(circle at 70% 105%, rgba(255,194,75,.18) 0 120px, transparent 121px), linear-gradient(135deg, #3B3488, #15122A)",
};

const MARK = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="4" rx="2"/><rect x="3" y="11" width="18" height="4" rx="2"/><rect x="2" y="17" width="20" height="4" rx="2"/></svg>`;

/**
 * The 3D logo as a rounded tile: the image has its own light backdrop, so it's framed as a card
 * in that same color (read from the image) instead of sitting on the purple as a hard rectangle.
 * Cropped to the sandwich, which leaves out the generator's corner mark.
 */
const LOGO_TILE = `<div id="logo-tile" style="width:220px;height:220px;border-radius:44px;margin-bottom:30px;box-shadow:0 24px 50px rgba(20,16,50,.35);background:url(${LOGO}) -${120 * (220 / 780)}px -${110 * (220 / 780)}px / ${1024 * (220 / 780)}px no-repeat"></div>`;

/** Places a popup screenshot on a branded 1280×800 canvas with a headline, and saves it. */
async function compose(page: Page, file: string, popupPng: Buffer, headline: string, lines: string[], theme: "light" | "dark", withLogo = false) {
    await page.setViewportSize({ width: 1280, height: 800 });
    const img = `data:image/png;base64,${popupPng.toString("base64")}`;
    const brand = withLogo
        ? `${LOGO_TILE}<div style="font-size:22px;font-weight:700;opacity:.95;margin-bottom:14px">Tab Sandwich</div>`
        : `<div style="display:flex;align-items:center;gap:12px;font-size:22px;font-weight:700;opacity:.95;margin-bottom:28px">${MARK}Tab Sandwich</div>`;
    await page.setContent(`<!doctype html><html><body style="margin:0;width:1280px;height:800px;overflow:hidden;background:${BACKGROUNDS[theme]};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;color:#fff;display:flex;align-items:center;gap:72px;padding:0 96px;box-sizing:border-box">
      <div style="flex:1;min-width:0">
        ${brand}
        <h1 style="margin:0 0 24px;font-size:${withLogo ? 46 : 52}px;line-height:1.08;font-weight:800;letter-spacing:-.02em">${headline}</h1>
        ${lines.map((l) => `<p style="margin:0 0 12px;font-size:21px;line-height:1.4;opacity:.88">${l}</p>`).join("")}
      </div>
      <img src="${img}" width="380" height="600" style="border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.35),0 8px 20px rgba(0,0,0,.2);flex-shrink:0">
    </body></html>`);
    if (withLogo) {
        // The tile takes the logo's own backdrop color, read from the image, so its edges disappear.
        await page.evaluate(async (src) => {
            const logo = new Image();
            logo.src = src;
            await logo.decode();
            const canvas = document.createElement("canvas");
            canvas.width = logo.width;
            canvas.height = logo.height;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(logo, 0, 0);
            const [r, g, b] = ctx.getImageData(150, 512, 1, 1).data;
            document.getElementById("logo-tile")!.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
        }, LOGO);
    }
    await page.screenshot({ path: `${OUT}/${file}` });
}

/** The page the save card shows: a real article, opened as the active tab in the popup's window. */
const CURRENT_PAGE = "https://www.smashingmagazine.com/articles/";

test("Chrome Web Store screenshots", async ({ context, popup }) => {
    test.skip(!process.env.TS_STORE_SCREENSHOTS, "Run through `pnpm store:screenshots`.");
    // Visit each sample site once, so Chrome's own icon cache has its icon (as it would for a real user).
    const visitor = await context.newPage();
    for (const { url } of [...LIBRARY, { url: CURRENT_PAGE }]) {
        await visitor.goto(url, { waitUntil: "load", timeout: 30_000 }).catch(() => undefined);
        await visitor.waitForTimeout(800);
    }
    await visitor.close();

    await popup.setViewportSize({ width: 380, height: 600 });
    const canvas = await context.newPage();
    const shot = async (theme: "light" | "dark", prepare: () => Promise<void>) => {
        await popup.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await seedLibrary(popup, LIBRARY, SETTINGS);
        const opened = context.waitForEvent("page");
        await popup.evaluate((u) => chrome.tabs.create({ url: u, active: true }), CURRENT_PAGE);
        await (await opened).waitForLoadState("load");
        await expect(popup.getByRole("region", { name: "Current tab" })).toContainText("smashingmagazine.com");
        await popup.mouse.move(0, 599);
        await prepare();
        await popup.waitForTimeout(300);
        return popup.screenshot();
    };

    await compose(canvas, "screenshot-1-main-list.png", await shot("light", async () => {}), "Save the tab you're on, in one click", [
        "Pick a category as you save — no editing afterwards.",
        "Colorful categories make your list easy to scan."
    ], "light", true);

    await compose(canvas, "screenshot-2-dark-mode.png", await shot("dark", async () => {}), "Easy on the eyes, day or night", [
        "Follows your computer's light or dark mode,",
        "or pick one in Settings."
    ], "dark");

    await compose(canvas, "screenshot-3-search.png", await shot("light", async () => {
        await popup.getByRole("textbox", { name: "Search saved tabs" }).fill("news");
    }), "Find any saved tab in a keystroke", ["Search matches titles and sites as you type.", "Press Enter to open the top result."], "light");

    await compose(canvas, "screenshot-4-categories.png", await shot("light", async () => {
        await openSettings(popup, "Categories");
        await popup.getByRole("button", { name: "Color for Reading" }).click();
    }), "Organize your way", ["Add, rename, reorder and recolor categories.", "Settings stay calm and simple."], "light");

    await compose(canvas, "screenshot-5-private.png", await shot("dark", async () => {
        await openSettings(popup, "About");
    }), "Your tabs stay in your browser", ["No account, no server, no tracking.", "Back up to a file whenever you like."], "dark");
});
