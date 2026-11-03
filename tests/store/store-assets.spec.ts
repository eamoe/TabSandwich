import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test, expect, LIBRARY_URL, SIDE_PANEL_URL, waitUntilReady } from "../e2e/fixtures";
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

// The icon, large, beside the name on the main screenshot: the tile only (the drawing's transparent margin cropped off).
const ICON = readFileSync("branding/icon.svg", "utf8")
    .replace('viewBox="0 0 128 128"', 'viewBox="16 16 96 96"')
    .replace(/ width="\d+" height="\d+"/, ' width="112" height="112" style="display:block"');
/** The icon as Chrome shows an extension's, small, in the side panel's header. */
const ICON_SMALL = ICON.replace(' width="112" height="112"', ' width="18" height="18"').replace('style="display:block"', 'style="display:block;border-radius:4px"');
const ICON_TILE = `<div style="width:112px;height:112px;border-radius:28px;flex-shrink:0;box-shadow:0 0 0 5px rgba(255,255,255,.18),0 20px 44px rgba(20,16,50,.35)">${ICON}</div>`;
const LOCK = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;

const BACKGROUNDS = {
    light: "radial-gradient(circle at 85% 15%, rgba(255,255,255,.18) 0 160px, transparent 161px), radial-gradient(circle at 70% 105%, rgba(255,194,75,.35) 0 120px, transparent 121px), linear-gradient(135deg, #7A71E0, #584FA3)",
    dark: "radial-gradient(circle at 85% 15%, rgba(255,255,255,.08) 0 160px, transparent 161px), radial-gradient(circle at 70% 105%, rgba(255,194,75,.18) 0 120px, transparent 121px), linear-gradient(135deg, #3B3488, #15122A)",
};

// The mark beside the name on the other screenshots: the icon without its tile, as in the popup header.
const MARK = readFileSync("branding/mark.svg", "utf8").replace(/ width="\d+" height="\d+"/, ' width="36" height="30"');

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif";
const SHADOW = "0 30px 80px rgba(0,0,0,.35),0 8px 20px rgba(0,0,0,.2)";
const png = (shot: Buffer) => `data:image/png;base64,${shot.toString("base64")}`;
const brandLine = `<div style="display:flex;align-items:center;gap:12px;font-size:22px;font-weight:700;opacity:.95;margin-bottom:28px">${MARK}Tab Sandwich</div>`;
/** What it does, as a short list: each point after a dot in the sandwich's yellow. */
const pointList = (points: string[], marginBottom = 0) => `
    <ul style="margin:0 0 ${marginBottom}px;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px">
      ${points.map((p) => `<li style="display:flex;align-items:flex-start;gap:14px;font-size:21px;line-height:1.4;opacity:.92"><span style="width:9px;height:9px;margin-top:10px;border-radius:50%;background:#FFC24B;flex-shrink:0"></span>${p}</li>`).join("")}
    </ul>`;
const copy = (headline: string, points: string[]) => `
    <h1 style="margin:0 0 28px;font-size:52px;line-height:1.08;font-weight:800;letter-spacing:-.02em;text-wrap:balance">${headline}</h1>
    ${pointList(points)}`;

/** Paints `body` on the branded 1280×800 canvas, and saves it. */
async function paint(page: Page, file: string, theme: "light" | "dark", style: string, body: string) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.setContent(`<!doctype html><html><body style="margin:0;width:1280px;height:800px;overflow:hidden;background:${BACKGROUNDS[theme]};font-family:${FONT};color:#fff;box-sizing:border-box;${style}">${body}</body></html>`);
    await page.screenshot({ path: `${OUT}/${file}` });
}

/** A popup screenshot beside a headline and its points, in screenshot 1's style. */
async function compose(page: Page, file: string, popupPng: Buffer, headline: string, lines: string[], theme: "light" | "dark") {
    await paint(page, file, theme, "display:flex;align-items:center;gap:72px;padding:0 96px", `
      <div style="flex:1;min-width:0">${brandLine}${copy(headline, lines)}</div>
      <img src="${png(popupPng)}" width="380" height="600" style="border-radius:18px;box-shadow:${SHADOW};flex-shrink:0">`);
}

/**
 * The first, main screenshot: the icon and the name, large, as one lockup; the headline below it,
 * then what it does as a short list, and the privacy promise as a badge; the popup beside them.
 */
async function composeHero(page: Page, file: string, popupPng: Buffer, headline: string, points: string[], promise: string) {
    await paint(page, file, "light", "display:flex;align-items:center;gap:64px;padding:0 88px 0 96px", `
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:28px;margin-bottom:52px">${ICON_TILE}<div style="font-size:68px;line-height:1;font-weight:800;letter-spacing:-.03em">Tab Sandwich</div></div>
        <h1 style="margin:0 0 26px;font-size:40px;line-height:1.12;font-weight:700;letter-spacing:-.015em;text-wrap:balance;max-width:560px">${headline}</h1>
        ${pointList(points, 36)}
        <div style="display:inline-flex;align-items:center;gap:10px;padding:10px 18px;border-radius:999px;background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 1px rgba(255,255,255,.22);font-size:17px;font-weight:600">${LOCK}${promise}</div>
      </div>
      <img src="${png(popupPng)}" width="380" height="600" style="border-radius:18px;box-shadow:${SHADOW};flex-shrink:0">`);
}

/** A headline across the top, its lines to the right; what it's about goes below, from WIDE_TOP down. */
const wideHeader = (headline: string, lines: string[]) => `
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:48px">
        <div>${brandLine.replace("margin-bottom:28px", "margin-bottom:18px")}<h1 style="margin:0;font-size:46px;line-height:1.08;font-weight:800;letter-spacing:-.02em;text-wrap:balance">${headline}</h1></div>
        <div style="white-space:nowrap;padding-bottom:6px">${pointList(lines)}</div>
      </div>`;
const WIDE_TOP = 276;
const WIDE_WIDTH = 1120;

/** Chrome's own icons, redrawn plainly (stroke, 24-unit grid) for the window around the side panel. */
const CHROME_ICON = {
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    forward: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    reload: '<path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"/>',
    tune: '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>',
    star: '<path d="M12 4l2.4 5 5.6.7-4.1 3.8 1.1 5.5L12 16.3 7 19l1.1-5.5L4 9.7l5.6-.7z"/>',
    panel: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M14 5v14"/>',
    // Material's "extension" piece, as Chrome's extensions button shows it, outlined.
    puzzle: '<path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4c-1.1 0-2 .9-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20c0 1.1.9 2 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17c1.1 0 2-.9 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/>',
    more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    pin: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const chromeIcon = (name: keyof typeof CHROME_ICON, size = 18, color = "#474A50") =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;display:block">${CHROME_ICON[name]}</svg>`;
const CHROME = { frame: "#DEE3EA", toolbar: "#FFFFFF", omnibox: "#EDF1F6", line: "#D3D8E0", text: "#1F1F1F", muted: "#5F6368" };
const TAB_STRIP = 38;
const TOOLBAR = 42;
const PANEL_HEADER = 38;

/**
 * The side panel as Chrome shows it: a Chrome window, running off the canvas's bottom edge, with
 * someone's page in it and the panel along its right side, under its own header. The page and the
 * panel are rendered apart and put side by side; the window around them is drawn here, plainly
 * (tab strip, toolbar, address bar), with no browser's logo.
 */
async function composePanel(page: Page, file: string, pagePng: Buffer, panelPng: Buffer, url: string, tabTitle: string, headline: string, lines: string[], theme: "light" | "dark") {
    const { host, pathname } = new URL(url);
    const dot = (color: string) => `<span style="width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0"></span>`;
    const button = (name: keyof typeof CHROME_ICON) => `<span style="width:32px;height:32px;display:grid;place-items:center">${chromeIcon(name)}</span>`;
    const siteMark = `<span style="width:16px;height:16px;border-radius:3px;display:grid;place-items:center;font:700 13px/1 Georgia,serif;color:#000;background:#fff;box-shadow:inset 0 0 0 1px #C8CCD2">W</span>`;
    await paint(page, file, theme, "position:relative;padding:64px 80px 0", `${wideHeader(headline, lines)}
      <div style="position:absolute;left:${(1280 - WIDE_WIDTH) / 2}px;top:${WIDE_TOP}px;width:${WIDE_WIDTH}px;border-radius:14px 14px 0 0;overflow:hidden;box-shadow:${SHADOW};background:${CHROME.frame};color:${CHROME.text};font-size:13px">
        <div style="height:${TAB_STRIP}px;display:flex;align-items:flex-end;gap:8px;padding:0 12px 0 16px">
          <div style="display:flex;gap:8px;align-self:center">${dot("#FF5F57")}${dot("#FEBC2E")}${dot("#28C840")}</div>
          <div style="margin-left:18px;width:236px;height:30px;border-radius:10px 10px 0 0;background:${CHROME.toolbar};display:flex;align-items:center;gap:9px;padding:0 10px 0 12px">
            ${siteMark}<span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tabTitle}</span>${chromeIcon("close", 14, CHROME.muted)}
          </div>
          <span style="align-self:center;font-size:20px;line-height:1;color:${CHROME.muted};padding:0 6px">+</span>
        </div>
        <div style="height:${TOOLBAR}px;display:flex;align-items:center;gap:2px;padding:0 8px;background:${CHROME.toolbar};border-bottom:1px solid ${CHROME.line}">
          ${button("back")}${button("forward")}${button("reload")}
          <div style="flex:1;height:32px;margin:0 8px;border-radius:16px;background:${CHROME.omnibox};display:flex;align-items:center;gap:10px;padding:0 12px 0 10px">
            ${chromeIcon("tune", 16)}<span style="flex:1;font-size:14px">${host}<span style="color:${CHROME.muted}">${pathname}</span></span>${chromeIcon("star", 16)}
          </div>
          ${button("panel")}<span style="width:32px;height:32px;display:grid;place-items:center">${chromeIcon("puzzle", 17)}</span><span style="width:24px;height:24px;margin:0 6px;border-radius:50%;background:#B9A6E8"></span>${button("more")}
        </div>
        <div style="display:flex;background:${CHROME.toolbar}">
          <img src="${png(pagePng)}" width="${PAGE_SIZE.width}" height="${PAGE_SIZE.height}" style="display:block">
          <div style="border-left:1px solid ${CHROME.line}">
            <div style="height:${PANEL_HEADER - 1}px;display:flex;align-items:center;gap:8px;padding:0 8px 0 12px;border-bottom:1px solid ${CHROME.line}">
              ${ICON_SMALL}<span style="font-weight:600">Tab Sandwich</span>
              <span style="flex:1"></span>${chromeIcon("pin", 16, CHROME.muted)}<span style="width:6px"></span>${chromeIcon("close", 16, CHROME.muted)}
            </div>
            <img src="${png(panelPng)}" width="${PANEL_SIZE.width}" height="${PANEL_SIZE.height}" style="display:block">
          </div>
        </div>
      </div>`);
}

/** The full-page library: the headline above it, the page running off the canvas's bottom edge. */
async function composeWide(page: Page, file: string, libraryPng: Buffer, headline: string, lines: string[], theme: "light" | "dark") {
    await paint(page, file, theme, "position:relative;padding:64px 80px 0", `${wideHeader(headline, lines)}
      <img src="${png(libraryPng)}" width="${LIBRARY_SIZE.width}" height="${LIBRARY_SIZE.height}" style="position:absolute;left:${(1280 - LIBRARY_SIZE.width) / 2}px;top:${WIDE_TOP}px;border-radius:14px 14px 0 0;box-shadow:${SHADOW}">`);
}

const PAGE_SIZE = { width: WIDE_WIDTH - 360 - 1, height: 800 - WIDE_TOP - TAB_STRIP - TOOLBAR };
const PANEL_SIZE = { width: 360, height: PAGE_SIZE.height - PANEL_HEADER };
const LIBRARY_SIZE = { width: WIDE_WIDTH, height: 600 };
/** Rendered larger, then shown at LIBRARY_SIZE: at 1120 px wide its title column cuts most titles short. */
const LIBRARY_RENDER = { width: 1280, height: 686 };

/** The page beside the side panel: someone else's site, plainly not part of Tab Sandwich, and not yet saved. */
const PANEL_PAGE = "https://en.wikipedia.org/wiki/Club_sandwich";

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
    for (const { url } of [...LIBRARY, ...WAITING_EXTRAS, { url: CURRENT_PAGE }, { url: PANEL_PAGE }, ...WINDOW_PAGES.map((url) => ({ url }))]) {
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

    await composeHero(canvas, "screenshot-1-main-list.png", await shot("light", async () => {}), "Save the tab you're on,<br>in one click", [
        "Pick a category as you save — it suggests one.",
        "Pin favorites, add a note, archive the rest.",
    ], "Stored only in your browser. No account, no tracking.");

    // The side panel in a browser window, beside the Wikipedia article it's describing (and
    // suggesting a category for): the panel and the page are each rendered on their own.
    {
        await popup.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
        await seedLibrary(popup, LIBRARY, SETTINGS);
        const panel = await context.newPage();
        await panel.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
        await panel.setViewportSize(PANEL_SIZE);
        await panel.goto(SIDE_PANEL_URL);
        await waitUntilReady(panel);
        const opened = context.waitForEvent("page");
        await panel.evaluate((u) => chrome.tabs.create({ url: u, active: true }), PANEL_PAGE);
        const article = await opened;
        await article.setViewportSize(PAGE_SIZE);
        await article.waitForLoadState("load");
        await article.waitForTimeout(1500);
        await expect(panel.getByRole("region", { name: "Current tab" })).toContainText("en.wikipedia.org");
        await panel.mouse.move(0, PANEL_SIZE.height - 1);
        await panel.waitForTimeout(300);
        await composePanel(canvas, "screenshot-2-side-panel.png", await article.screenshot(), await panel.screenshot(), PANEL_PAGE, await article.title(), "Keep your list open beside the page", [
            "All of Tab Sandwich, next to what you're reading.",
            "Right-click a link to save it, and it shows up here."
        ], "light");
        await panel.close();
        await article.close();
    }

    // The full-page library, in dark: everything in one sortable table, a reminder on a tab.
    {
        await popup.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
        const withReminder = [...LIBRARY, ...WAITING_EXTRAS].map((t) => (t.title === "Hacker News" ? { ...t, remindInDays: 3 } : t)) as typeof LIBRARY;
        await seedLibrary(popup, withReminder, SETTINGS);
        const library = await context.newPage();
        await library.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
        await library.setViewportSize(LIBRARY_RENDER);
        await library.goto(LIBRARY_URL);
        await waitUntilReady(library);
        await library.mouse.move(LIBRARY_RENDER.width / 2, 5);
        await library.waitForTimeout(500);
        await composeWide(canvas, "screenshot-3-library.png", await library.screenshot(), "Your whole collection, on one page", [
            "Search, sort by any column, edit many at once.",
            "Set a reminder, and a tab comes back on the day."
        ], "dark");
        await library.close();
    }

    // A window full of tabs, saved in one click (Chrome's permission prompt answered "Allow"),
    // then opened as a saved window, with "Close N tabs" on offer.
    await compose(canvas, "screenshot-4-whole-window.png", await shot("light", async () => {
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
    }), "Forty tabs open?<br>Save them all at once", [
        "One click saves the whole window, skipping what's already saved.",
        "It stays together in your list. Close the tabs, or keep them open."
    ], "light");
    // Close that window's tabs again, so the last shot shows the usual window.
    await popup.evaluate(async (urls) => {
        const open = await chrome.tabs.query({});
        await chrome.tabs.remove(open.filter((tab) => urls.some((u) => (tab.url ?? tab.pendingUrl ?? "").startsWith(u))).map((tab) => tab.id!));
    }, WINDOW_PAGES);
    // And forget the permission again (the stand-in for Chrome's prompt keeps it in the page).
    await popup.evaluate(() => localStorage.removeItem("test.tabsPermission"));

    // Read later or keep: the Waiting filter (Reading ages, the other categories are kept; the
    // Travel tab's reminder has come), with the archive's pill beside it.
    const waiting = [...LIBRARY, ...WAITING_EXTRAS].map((t) => (t.title.startsWith("Lisbon") ? { ...t, remindInDays: -1, reminded: true } : t)) as typeof LIBRARY;
    await compose(canvas, "screenshot-5-read-later.png", await shot("dark", async () => {
        await popup.getByRole("button", { name: /^Waiting/ }).click();
        await popup.mouse.move(0, 599);
    }, waiting), "Read it later,<br>or keep it for good", [
        "Saved to read? After a week, it shows as Waiting.",
        "A reminder brings it back on the day you pick.",
        "Everything else is kept, and never nags.",
        "Done with a tab? Archive it — out of the way, never lost."
    ], "dark");
});
