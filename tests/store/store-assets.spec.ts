import type { Page } from "@playwright/test";
import { test, expect, LIBRARY_URL, SIDE_PANEL_URL, waitUntilReady } from "../e2e/fixtures";
import { answerPermissionPrompt, seedLibrary, type SeedTab } from "../e2e/helpers";
import { englishOn } from "../e2e/englishLeft";
import { dictionaries } from "../../src/ui/strings";
import { SAMPLES, type Sample, type SampleTab } from "./samples";
import { BACKGROUNDS, CHROME, CHROME_ICON, chromeIcon, FONT, ICON, ICON_SMALL, MARK, SHADOW } from "./drawing";

const ICON_TILE = `<div style="width:112px;height:112px;border-radius:28px;flex-shrink:0;box-shadow:0 0 0 5px rgba(255,255,255,.18),0 20px 44px rgba(20,16,50,.35)">${ICON}</div>`;
const LOCK = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;

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

/** Paints `body` on the branded 1280×800 canvas, and saves it, once all its words fit on it. */
async function paint(page: Page, file: string, theme: "light" | "dark", style: string, body: string) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.setContent(`<!doctype html><html><body style="margin:0;width:1280px;height:800px;overflow:hidden;background:${BACKGROUNDS[theme]};font-family:${FONT};color:#fff;box-sizing:border-box;${style}">${body}</body></html>`);
    expect(await wordsOffCanvas(page), `${file}: words cut off or overlapping`).toEqual([]);
    await page.screenshot({ path: file });
}

/**
 * Words on the canvas that don't fit: past its edges (the pictures may run off the bottom,
 * words may not), wider than their box, or over the picture beside them. A longer language
 * would otherwise go out to the public cut off.
 */
async function wordsOffCanvas(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const out: string[] = [];
        const pictures = [...document.querySelectorAll("img")].map((img) => img.getBoundingClientRect());
        for (const el of document.body.querySelectorAll<HTMLElement>("h1, li, div, span")) {
            if (![...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())) continue;
            const box = el.getBoundingClientRect();
            const what = `"${el.textContent!.trim().slice(0, 40)}"`;
            if (box.left < 0 || box.right > 1280 || box.bottom > 800) out.push(`${what} runs off the canvas`);
            if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "hidden") out.push(`${what} is wider than its box`);
            if (pictures.some((p) => box.right > p.left && box.left < p.right && box.bottom > p.top && box.top < p.bottom) && !el.closest("[data-over-picture]")) out.push(`${what} overlaps a picture`);
        }
        return out;
    });
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
      <div data-over-picture style="position:absolute;left:${(1280 - WIDE_WIDTH) / 2}px;top:${WIDE_TOP}px;width:${WIDE_WIDTH}px;border-radius:14px 14px 0 0;overflow:hidden;box-shadow:${SHADOW};background:${CHROME.frame};color:${CHROME.text};font-size:13px">
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
            ${chromeIcon("tune", 16)}<span style="flex:1;font-size:14px">${host}<span style="color:${CHROME.muted}">${decodeURIComponent(pathname)}</span></span>${chromeIcon("star", 16)}
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


/** A text as a pattern, any space in it matching any (French puts a no-break space before units; a name reads it as a space). */
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s/g, "\\s");

/** The sample as the library stores it: categories by their names in the language. */
function seedTabs(sample: Sample, tabs: SampleTab[], reminder: "soon" | "due" | null): SeedTab[] {
    return tabs.map(({ category, remindSoon, remindDue, ...tab }) => ({
        ...tab,
        ...(category ? { category: sample.categories[category] } : {}),
        ...(reminder === "soon" && remindSoon ? { remindInDays: 3 } : {}),
        ...(reminder === "due" && remindDue ? { remindInDays: -1, reminded: true } : {}),
    }));
}

/**
 * The Store screenshots in each language, into store-assets/<language>/: the pictures' words,
 * the screens and the sample library all in it. A Mac draws them (the Store's visitors mostly see
 * system fonts like these); Chrome there takes its language from macOS, but its pages follow
 * Playwright's locale, which the fixture sets to it (chromeLanguage), and every screen is
 * checked for English left on it before its picture is taken.
 */
for (const [language, sample] of Object.entries(SAMPLES)) {
    test.describe(`In ${language}`, () => {
        test.use({ chromeLanguage: language });

        test(`Chrome Web Store screenshots, ${language}`, async ({ context, popup }) => {
            test.skip(!process.env.TS_STORE_SCREENSHOTS, "Run through `pnpm store:screenshots`.");
            test.setTimeout(300_000);
            const d = dictionaries[language]!;
            const dir = `store-assets/${language}`;
            const c = sample.categories;
            const settings = {
                categories: [c.work, c.reading, c.travel, c.recipes],
                categoryColors: { [c.work]: "blue", [c.reading]: "purple", [c.travel]: "teal", [c.recipes]: "coral" },
                waitingCategories: [c.reading, "Uncategorized"],
            };
            const library = (reminder: "soon" | "due" | null, extras = true) => seedTabs(sample, extras ? [...sample.tabs, ...sample.extras] : sample.tabs, reminder);
            /** Fails the picture for any English left on a screen, before it's taken. */
            const speaks = async (page: Page, what: string) => expect(await englishOn(page, language), `${language}, ${what}`).toEqual([]);

            // Visit each sample site once, so Chrome's own icon cache has its icon (as it would for a real user).
            const visitor = await context.newPage();
            for (const url of [...sample.tabs, ...sample.extras].map((t) => t.url).concat(sample.currentPage, sample.panelPage, sample.windowPages)) {
                const response = await visitor.goto(url, { waitUntil: "load", timeout: 30_000 }).catch(() => null);
                // A page that doesn't exist (a wrong title in samples.ts) would go out in a public picture.
                expect([404, 410], `${url} doesn't exist`).not.toContain(response?.status());
                await visitor.waitForTimeout(800);
            }
            await visitor.close();

            await popup.setViewportSize({ width: 380, height: 600 });
            const canvas = await context.newPage();
            const currentHost = new URL(sample.currentPage).host.replace(/^www\./, "");
            const shot = async (theme: "light" | "dark", prepare: () => Promise<void>, tabs: SeedTab[] = library(null, false)) => {
                await popup.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
                await seedLibrary(popup, tabs, settings);
                const opened = context.waitForEvent("page");
                await popup.evaluate((u) => chrome.tabs.create({ url: u, active: true }), sample.currentPage);
                await (await opened).waitForLoadState("load");
                await expect(popup.getByRole("region", { name: d.currentTab })).toContainText(currentHost);
                await popup.mouse.move(0, 599);
                await prepare();
                await popup.waitForTimeout(300);
                return popup.screenshot();
            };

            await composeHero(canvas, `${dir}/screenshot-1-main-list.png`, await shot("light", () => speaks(popup, "main list")), sample.hero.headline, sample.hero.points, sample.hero.promise);

            // The side panel in a browser window, beside the Wikipedia article it's describing (and
            // suggesting a category for): the panel and the page are each rendered on their own.
            {
                await popup.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
                await seedLibrary(popup, library(null, false), settings);
                const panel = await context.newPage();
                await panel.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
                await panel.setViewportSize(PANEL_SIZE);
                await panel.goto(SIDE_PANEL_URL);
                await waitUntilReady(panel);
                const opened = context.waitForEvent("page");
                await panel.evaluate((u) => chrome.tabs.create({ url: u, active: true }), sample.panelPage);
                const article = await opened;
                await article.setViewportSize(PAGE_SIZE);
                await article.waitForLoadState("load");
                // Wikipedia's banners (fundraising, news of its own) aren't the page, and change from day to day.
                await article.addStyleTag({ content: "#siteNotice, #centralNotice, .frb, .cn-fundraising { display: none !important; }" });
                await article.waitForTimeout(1500);
                await expect(panel.getByRole("region", { name: d.currentTab })).toContainText(new URL(sample.panelPage).host);
                await panel.mouse.move(0, PANEL_SIZE.height - 1);
                await panel.waitForTimeout(300);
                await speaks(panel, "side panel");
                await composePanel(canvas, `${dir}/screenshot-2-side-panel.png`, await article.screenshot(), await panel.screenshot(), sample.panelPage, await article.title(), sample.panel.headline, sample.panel.points, "light");
                await panel.close();
                await article.close();
            }

            // The full-page library, in dark: a search typed in, its matches lit, a reminder on a tab.
            {
                await popup.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
                await seedLibrary(popup, library("soon"), settings);
                const page = await context.newPage();
                await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
                await page.setViewportSize(LIBRARY_RENDER);
                await page.goto(LIBRARY_URL);
                await waitUntilReady(page);
                await page.getByLabel(d.searchLabel, { exact: true }).fill(sample.library.search);
                await page.mouse.move(LIBRARY_RENDER.width / 2, 5);
                await page.waitForTimeout(500);
                await speaks(page, "library");
                await composeWide(canvas, `${dir}/screenshot-3-library.png`, await page.screenshot(), sample.library.headline, sample.library.points, "dark");
                await page.close();
            }

            // A window full of tabs, saved in one click (Chrome's permission prompt answered "Allow"),
            // then opened as a saved window, with "Close N tabs" on offer.
            const saveAll = new RegExp(`^(${Array.from({ length: 60 }, (_, i) => escape(d.saveWindowAll(i + 2))).join("|")})$`);
            await compose(canvas, `${dir}/screenshot-4-whole-window.png`, await shot("light", async () => {
                for (const url of sample.windowPages) {
                    const opened = context.waitForEvent("page");
                    await popup.evaluate((u) => chrome.tabs.create({ url: u, active: false }), url);
                    await (await opened).waitForLoadState("load").catch(() => undefined);
                }
                await answerPermissionPrompt(context, popup, "grant");
                await popup.mouse.move(0, 599);
                await popup.getByRole("button", { name: saveAll }).click();
                await expect(popup.locator("button[data-group-name]").first()).toBeVisible();
                await popup.locator("button[data-group-name]").first().click();
                await popup.mouse.move(0, 599);
                await popup.waitForTimeout(2200);
                await speaks(popup, "whole window");
            }), sample.window.headline, sample.window.points, "light");
            // Close that window's tabs again, so the last shot shows the usual window.
            await popup.evaluate(async (urls) => {
                const open = await chrome.tabs.query({});
                await chrome.tabs.remove(open.filter((tab) => urls.some((u) => (tab.url ?? tab.pendingUrl ?? "").startsWith(u))).map((tab) => tab.id!));
            }, sample.windowPages);
            // And forget the permission again (the stand-in for Chrome's prompt keeps it in the page).
            await popup.evaluate(() => localStorage.removeItem("test.tabsPermission"));

            // Read later or keep: the Waiting filter (reading ages, the other categories are kept; the
            // travel tab's reminder has come), with the archive's pill beside it.
            await compose(canvas, `${dir}/screenshot-5-read-later.png`, await shot("dark", async () => {
                await popup.getByRole("button", { name: new RegExp(`^${escape(d.outdated)}`) }).click();
                await popup.mouse.move(0, 599);
                await speaks(popup, "read later");
            }, library("due")), sample.waiting.headline, sample.waiting.points, "dark");
        });
    });
}
