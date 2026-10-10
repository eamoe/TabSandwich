import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test } from "../e2e/fixtures";
import { expect } from "../e2e/fixtures";
import { answerPermissionPrompt, seedLibrary } from "../e2e/helpers";

const OUT = "store-assets";

const LIBRARY = [
    { title: "GitHub: Let's build from here", url: "https://github.com/", category: "Work", pinned: true },
    { title: "MDN Web Docs", url: "https://developer.mozilla.org/en-US/", category: "Work", daysAgo: 2 },
    { title: "Figma: The Collaborative Interface Design Tool", url: "https://www.figma.com/", category: "Work", daysAgo: 12 },
    { title: "Sandwich - Wikipedia", url: "https://en.wikipedia.org/wiki/Sandwich", category: "Reading", daysAgo: 9 },
    { title: "Hacker News", url: "https://news.ycombinator.com/", category: "Reading" },
    { title: "BBC News - Home", url: "https://www.bbc.com/news", category: "Reading", daysAgo: 4 },
    { title: "Lisbon – Travel guide at Wikivoyage", url: "https://en.wikivoyage.org/wiki/Lisbon", category: "Travel", daysAgo: 15, note: "for the May trip: day 2 is Belém" },
    { title: "BBC Food – Recipes", url: "https://www.bbc.co.uk/food", category: "Recipes", daysAgo: 2 },
    { title: "Stack Overflow", url: "https://stackoverflow.com/", daysAgo: 1 },
];
/** Added for the Read later shot: more reading that's been waiting, and a few tabs already archived. */
const WAITING_EXTRAS = [
    { title: "web.dev: Learn CSS", url: "https://web.dev/learn/css", category: "Reading", daysAgo: 34 },
    { title: "CSS-Tricks: A Complete Guide to Grid", url: "https://css-tricks.com/snippets/css/complete-guide-grid/", category: "Reading", daysAgo: 18 },
    { title: "A List Apart", url: "https://alistapart.com/", category: "Reading", daysAgo: 23 },
    { title: "Google Flights", url: "https://www.google.com/travel/flights", category: "Travel", daysAgo: 40, archivedDaysAgo: 6 },
    { title: "The Verge", url: "https://www.theverge.com/", category: "Reading", daysAgo: 30, archivedDaysAgo: 2 },
];
const SETTINGS = {
    categories: ["Work", "Reading", "Travel", "Recipes"],
    categoryColors: { Work: "blue", Reading: "purple", Travel: "teal", Recipes: "coral" },
};

// The icon, large, on the main screenshot: the tile only (the drawing's transparent margin cropped off).
const ICON = readFileSync("branding/icon.svg", "utf8")
    .replace('viewBox="0 0 128 128"', 'viewBox="16 16 96 96"')
    .replace(/ width="\d+" height="\d+"/, ' width="180" height="180" style="display:block"');
const ICON_TILE = `<div style="width:180px;height:180px;border-radius:45px;margin-bottom:30px;box-shadow:0 0 0 6px rgba(255,255,255,.18),0 24px 50px rgba(20,16,50,.35)">${ICON}</div>`;

const BACKGROUNDS = {
    light: "radial-gradient(circle at 85% 15%, rgba(255,255,255,.18) 0 160px, transparent 161px), radial-gradient(circle at 70% 105%, rgba(255,194,75,.35) 0 120px, transparent 121px), linear-gradient(135deg, #7A71E0, #584FA3)",
    dark: "radial-gradient(circle at 85% 15%, rgba(255,255,255,.08) 0 160px, transparent 161px), radial-gradient(circle at 70% 105%, rgba(255,194,75,.18) 0 120px, transparent 121px), linear-gradient(135deg, #3B3488, #15122A)",
};

// The mark beside the name on the other screenshots: the icon without its tile, as in the popup header.
const MARK = readFileSync("branding/mark.svg", "utf8").replace(/ width="\d+" height="\d+"/, ' width="36" height="30"');

/** Places a popup screenshot on a branded 1280×800 canvas with a headline, and saves it. */
async function compose(page: Page, file: string, popupPng: Buffer, headline: string, lines: string[], theme: "light" | "dark", withIcon = false) {
    await page.setViewportSize({ width: 1280, height: 800 });
    const img = `data:image/png;base64,${popupPng.toString("base64")}`;
    const brand = withIcon
        ? `${ICON_TILE}<div style="font-size:22px;font-weight:700;opacity:.95;margin-bottom:14px">Tab Sandwich</div>`
        : `<div style="display:flex;align-items:center;gap:12px;font-size:22px;font-weight:700;opacity:.95;margin-bottom:28px">${MARK}Tab Sandwich</div>`;
    await page.setContent(`<!doctype html><html><body style="margin:0;width:1280px;height:800px;overflow:hidden;background:${BACKGROUNDS[theme]};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;color:#fff;display:flex;align-items:center;gap:72px;padding:0 96px;box-sizing:border-box">
      <div style="flex:1;min-width:0">
        ${brand}
        <h1 style="margin:0 0 24px;font-size:${withIcon ? 46 : 52}px;line-height:1.08;font-weight:800;letter-spacing:-.02em;text-wrap:balance">${headline}</h1>
        ${lines.map((l) => `<p style="margin:0 0 12px;font-size:21px;line-height:1.4;opacity:.88">${l}</p>`).join("")}
      </div>
      <img src="${img}" width="380" height="600" style="border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.35),0 8px 20px rgba(0,0,0,.2);flex-shrink:0">
    </body></html>`);
    await page.screenshot({ path: `${OUT}/${file}` });
}

/** The page the save card shows: a real article, opened as the active tab in the popup's window. */
const CURRENT_PAGE = "https://www.smashingmagazine.com/articles/";

/** A window of open tabs, for "save the whole window" (the article above is the one you're on). */
const WINDOW_PAGES = [
    "https://vite.dev/",
    "https://preactjs.com/",
    "https://playwright.dev/",
    "https://www.typescriptlang.org/",
    "https://developer.chrome.com/docs/extensions",
];

test("Chrome Web Store screenshots", async ({ context, popup }) => {
    test.skip(!process.env.TS_STORE_SCREENSHOTS, "Run through `pnpm store:screenshots`.");
    // Visit each sample site once, so Chrome's own icon cache has its icon (as it would for a real user).
    const visitor = await context.newPage();
    for (const { url } of [...LIBRARY, ...WAITING_EXTRAS, { url: CURRENT_PAGE }, ...WINDOW_PAGES.map((url) => ({ url }))]) {
        await visitor.goto(url, { waitUntil: "load", timeout: 30_000 }).catch(() => undefined);
        await visitor.waitForTimeout(800);
    }
    await visitor.close();

    await popup.setViewportSize({ width: 380, height: 600 });
    const canvas = await context.newPage();
    const shot = async (theme: "light" | "dark", prepare: () => Promise<void>, library: typeof LIBRARY = LIBRARY) => {
        await popup.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await seedLibrary(popup, library, SETTINGS);
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
        "Pick a category as you save — it suggests one.",
        "Pin favorites, add a note, archive the rest.",
        "Stored only in your browser. No account, no tracking."
    ], "light", true);

    // A window full of tabs, saved in one click (Chrome's permission prompt answered "Allow"),
    // then opened as a saved window, with "Close N tabs" on offer.
    await compose(canvas, "screenshot-2-whole-window.png", await shot("light", async () => {
        for (const url of WINDOW_PAGES) {
            const opened = context.waitForEvent("page");
            await popup.evaluate((u) => chrome.tabs.create({ url: u, active: false }), url);
            await (await opened).waitForLoadState("load").catch(() => undefined);
        }
        await answerPermissionPrompt(context, popup, "grant");
        await popup.mouse.move(0, 599);
        await popup.getByRole("button", { name: /^Save all \d+ tabs in this window$/ }).click();
        await expect(popup.getByRole("status").filter({ hasText: /^Saved \d+ tabs/ })).toBeVisible();
        await popup.locator("button[data-group-name]").first().click();
        await popup.mouse.move(0, 599);
        await popup.waitForTimeout(2200);
    }), "Forty tabs open? Save them all at once", [
        "One click saves the whole window, skipping what's already saved.",
        "It stays together in your list. Close the tabs, or keep them open."
    ], "light");
    // Close that window's tabs again, so the later shots show the usual window.
    await popup.evaluate(async (urls) => {
        const open = await chrome.tabs.query({});
        await chrome.tabs.remove(open.filter((tab) => urls.some((u) => (tab.url ?? tab.pendingUrl ?? "").startsWith(u))).map((tab) => tab.id!));
    }, WINDOW_PAGES);
    // And forget the permission again (the stand-in for Chrome's prompt keeps it in the page).
    await popup.evaluate(() => localStorage.removeItem("test.tabsPermission"));

    await compose(canvas, "screenshot-3-dark-mode.png", await shot("dark", async () => {}), "Easy on the eyes, day or night", [
        "Follows your computer's light or dark mode,",
        "or pick one in Settings."
    ], "dark");

    await compose(canvas, "screenshot-4-search.png", await shot("light", async () => {
        await popup.getByRole("textbox", { name: "Search saved tabs" }).fill("news");
    }), "Find any saved tab in a keystroke", ["Search matches titles, sites, categories and notes.", "Sort, select many, and never touch the mouse."], "light");

    // Read later or keep: the Waiting filter (Reading ages, the other categories are kept), with
    // the archive's pill beside it.
    await compose(canvas, "screenshot-5-read-later.png", await shot("dark", async () => {
        await popup.getByRole("button", { name: /^Waiting/ }).click();
        await popup.mouse.move(0, 599);
    }, [...LIBRARY, ...WAITING_EXTRAS] as typeof LIBRARY), "Read it later, or keep it for good", [
        "Saved to read? It shows as Waiting after a week.",
        "Everything else is kept. Done with a tab? Archive it — out of the way, never lost."
    ], "dark");
});
