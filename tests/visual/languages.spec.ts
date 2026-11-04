import type { BrowserContext, Page } from "@playwright/test";
import { test, expect, LIBRARY_URL, SIDE_PANEL_URL, WELCOME_URL, waitUntilReady } from "../e2e/fixtures";
import { answerPermissionPrompt, openSiteTab, seedLibrary, type SeedTab } from "../e2e/helpers";
import { en, type Strings } from "../../src/ui/locales/en";
import { dictionaries } from "../../src/ui/strings";

/**
 * Tab Sandwich in each of its languages, as Chrome in that language shows it (Linux Chromium
 * takes Chrome's language from LANGUAGE, which only these Docker runs can set; see the fixture's
 * chromeLanguage). Every screen is opened by the names that language gives its controls, and on
 * each one:
 * - none may show a word of English: any text of en.ts that the language words differently is a
 *   screen still reading from somewhere other than its dictionary;
 * - everything must fit: no text cut off or spilling out of its box, no hint or choice wider than
 *   its field (English is checked too, as the control: it must fit as well).
 * The pictures land in test-results/languages/, for a person to look at; they aren't approved screenshots.
 */

/** English texts long enough to be unmistakable, which the language words differently. */
function englishLeaks(language: string): RegExp[] {
    const mine = new Set(texts(dictionaries[language]));
    // The starter names are also the seeded library's own (English) category names: data, not text.
    const seeded = new Set(texts(en.starterCategories));
    return texts(en)
        .filter((text) => text.length >= 6 && !mine.has(text) && !seeded.has(text) && !text.includes("Tab Sandwich") && !text.startsWith("https://"))
        // As a whole word or phrase: "Export" isn't a leak inside "Exportieren".
        .map((text) => new RegExp(`(^|[^\\p{L}])${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "u"));
}

function texts(value: unknown): string[] {
    if (typeof value === "string") return [value];
    if (!value || typeof value !== "object") return [];
    return Object.values(value).flatMap(texts);
}

/** Everything a person can see or a screen reader can say on the page right now. */
async function wordsOn(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const out: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) out.push(walker.currentNode.textContent ?? "");
        for (const el of document.querySelectorAll("[aria-label], [title], [placeholder]"))
            for (const name of ["aria-label", "title", "placeholder"]) out.push(el.getAttribute(name) ?? "");
        for (const option of document.querySelectorAll("option")) out.push(option.textContent ?? "");
        return out.map((t) => t.trim()).filter(Boolean);
    });
}

/**
 * Whatever on the page doesn't fit, each as what to fix: text wider or taller than its box (cut
 * off, or spilling over its neighbours), a field's hint or a select's choice wider than the room
 * inside it (neither shows in the field's own size), and a page wider than its window. It's
 * measured as a Mac would draw it (a little wider), and a hint or a choice with each number
 * as "000", since a library runs to hundreds. The app's
 * own words must always fit; names and sites (`data`) may be cut with "…" for room, as by design,
 * as long as some of each still shows. Text hidden on purpose (for screen readers only) and
 * screens not on show (the main screen behind Settings) don't count.
 */
async function misfits(page: Page, data: string[]): Promise<string[]> {
    return page.evaluate((data) => {
        const out: string[] = [];
        const SLACK = 1;
        const names = new Set(data);
        /** Of a name or site cut for room, at least this much shows (some five letters). */
        const NAME_ROOM = 40;
        const ctx = document.createElement("canvas").getContext("2d")!;
        const widthOf = (text: string, el: Element) => {
            const s = getComputedStyle(el);
            ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
            ctx.letterSpacing = s.letterSpacing === "normal" ? "0px" : s.letterSpacing;
            return Math.ceil(ctx.measureText(text.replace(/\d+/g, "000")).width);
        };
        const inside = (el: HTMLElement) => {
            const s = getComputedStyle(el);
            return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
        };
        const label = (el: Element) => {
            const text = (el instanceof HTMLInputElement ? el.placeholder : el instanceof HTMLSelectElement ? el.selectedOptions[0]?.text : el.textContent) || el.getAttribute("aria-label") || "";
            return `${el.tagName.toLowerCase()} "${text.trim().replace(/\s+/g, " ").slice(0, 60)}"`;
        };

        // These runs draw text in Linux's font; a Mac's is wider at the same size: some 2–8% in
        // regular text, 7–22% in medium and bold (measured). So while it's measured, every letter
        // gets that much more room, and what only just fits here is caught before it's cut off there.
        const all = [...document.body.querySelectorAll<HTMLElement>("*")];
        const before = all.map((el) => el.style.getPropertyValue("letter-spacing"));
        const weights = all.map((el) => Number(getComputedStyle(el).fontWeight));
        all.forEach((el, i) => el.style.setProperty("letter-spacing", weights[i]! >= 500 ? "0.06em" : "0.03em", "important"));

        if (document.documentElement.scrollWidth > innerWidth + SLACK) out.push(`the page is ${document.documentElement.scrollWidth}px wide in a ${innerWidth}px window`);

        const hiddenOnPurpose = new Set<Element>();
        for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
            if (el.parentElement && hiddenOnPurpose.has(el.parentElement)) { hiddenOnPurpose.add(el); continue; }
            const s = getComputedStyle(el);
            if (s.clip !== "auto" || s.clipPath !== "none") { hiddenOnPurpose.add(el); continue; }
            if (["OPTION", "SCRIPT", "STYLE", "svg"].includes(el.tagName) || el instanceof SVGElement) continue;
            if (!el.checkVisibility({ visibilityProperty: true })) continue;

            if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.placeholder && !el.value) {
                const need = widthOf(el.placeholder, el);
                if (need > inside(el) + SLACK) out.push(`${label(el)}: its hint needs ${need}px, has ${inside(el)}px`);
                continue;
            }
            if (el instanceof HTMLSelectElement) {
                const choice = el.selectedOptions[0]?.text ?? "";
                // A category picker's choice is a name, cut like one for room.
                if (names.has(choice) && inside(el) >= NAME_ROOM) continue;
                const need = widthOf(choice, el);
                if (need > inside(el) + SLACK) out.push(`${label(el)}: its choice needs ${need}px, has ${inside(el)}px`);
                continue;
            }
            const text = el.textContent?.trim().replace(/\s+/g, " ") ?? "";
            if (s.display === "inline" || s.display === "contents" || !text) continue;
            if (names.has(text) && el.clientWidth >= NAME_ROOM) continue;
            if (!/auto|scroll/.test(s.overflowX) && el.scrollWidth > el.clientWidth + SLACK)
                out.push(`${label(el)}: needs ${el.scrollWidth}px wide, has ${el.clientWidth}px`);
            // Downwards, only where it's cut off: a box may hold things below the fold (a screen reader's text).
            if (/hidden|clip/.test(s.overflowY) && el.scrollHeight > el.clientHeight + SLACK)
                out.push(`${label(el)}: needs ${el.scrollHeight}px tall, has ${el.clientHeight}px`);
        }
        all.forEach((el, i) => (before[i] ? el.style.setProperty("letter-spacing", before[i]!) : el.style.removeProperty("letter-spacing")));
        return out;
    }, data);
}

/** Neutral names, so a title can never look like English the app forgot to translate. */
const LIBRARY: SeedTab[] = [
    { title: "Alpha 2026", url: "https://alpha.example.com/a", category: "Work", pinned: true },
    { title: "Bravo 2026", url: "https://bravo.example.com/b", category: "Work", daysAgo: 3, note: "Zulu 2026" },
    { title: "Charlie 2026", url: "https://charlie.example.com/c", category: "Reading", daysAgo: 12 },
    { title: "Delta 2026", url: "https://delta.example.com/d", daysAgo: 9, remindInDays: 2 },
    { title: "Echo 2026", url: "https://echo.example.com/e", groupId: "w" },
    { title: "Foxtrot 2026", url: "https://foxtrot.example.com/f", groupId: "w" },
    { title: "Golf 2026", url: "https://golf.example.com/g", archivedDaysAgo: 1 },
    // Enough of them that a selection's count runs to two digits, in the list and in the archive.
    ...Array.from({ length: 11 }, (_, i): SeedTab => ({ title: `Papa ${i + 1}`, url: `https://papa${i + 1}.example.com/p`, category: "Personal", daysAgo: 1 })),
    ...Array.from({ length: 11 }, (_, i): SeedTab => ({ title: `Romeo ${i + 1}`, url: `https://romeo${i + 1}.example.com/r`, category: "Personal", archivedDaysAgo: 2 })),
];
const GROUPS = [{ id: "w", name: "Kilo 2026", collapsed: false }];
/** Kept tabs not opened for most of a year, which the cleanup tip offers to archive. */
const STALE: SeedTab[] = [
    { title: "Hotel 2026", url: "https://hotel.example.com/h", category: "Work", daysAgo: 300 },
    { title: "India 2026", url: "https://india.example.com/i", category: "Work", daysAgo: 300 },
];
/** Every name and site the tests put on screen: data, never translated, so it may be cut for room. */
const DATA = [
    ...[...LIBRARY, ...STALE].flatMap((t) => [t.title, new URL(t.url).hostname, t.note ?? "", t.category ?? ""]),
    ...GROUPS.map((g) => g.name),
    "Lima 2026", "Mike 2026", "example.test", "Unseen", "unseen.example.org",
].filter(Boolean);
const BACKUP = { name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ tabs: [{ title: "A", url: "https://a.example.com" }] })) };

for (const language of Object.keys(dictionaries)) {
    const d: Strings = dictionaries[language]!;

    test.describe(`In ${language}`, () => {
        test.use({ chromeLanguage: language });
        const leaks = language === "en" ? [] : englishLeaks(language);

        /** Pictures this state, and fails it (going on to the next) for any English on it and anything that doesn't fit. */
        const look = async (page: Page, state: string) => {
            await page.screenshot({ path: `test-results/languages/${language}-${state}.png` });
            const found = await misfits(page, DATA);
            if (language !== "en") {
                const words = await wordsOn(page);
                for (const leak of leaks) if (words.some((w) => leak.test(w))) found.push(`English ${leak.source}`);
                for (const word of words) if (/\b(saved|search|categor(y|ies)|selected|reminder|settings)\b/i.test(word)) found.push(`English "${word}"`);
            }
            expect.soft(found, `${language}, ${state}`).toEqual([]);
        };

        const popupAt = async (context: BrowserContext, popup: Page) => {
            await popup.setViewportSize({ width: 380, height: 600 });
            await popup.emulateMedia({ reducedMotion: "reduce" });
            return openSiteTab(context, popup, "Lima 2026");
        };

        test("the popup speaks it, and everything fits", async ({ context, popup }) => {
            test.setTimeout(120_000);
            await popupAt(context, popup);
            // The language, with Chrome's own region if it has one (es-ES): dates follow that.
            await expect(popup.locator("html")).toHaveAttribute("lang", new RegExp(`^${language.replace("_", "-")}(-|$)`));

            await seedLibrary(popup, [], {});
            await look(popup, "empty");
            await seedLibrary(popup, LIBRARY, {}, { groups: GROUPS, seenVersion: "3.0.0" });
            await look(popup, "whats-new");
            await seedLibrary(popup, [...LIBRARY, ...STALE], {}, { groups: GROUPS, trackingSinceDaysAgo: 365 });
            await look(popup, "cleanup");

            await seedLibrary(popup, LIBRARY, {}, { groups: GROUPS });
            await look(popup, "main");
            await popup.getByRole("button", { name: d.openIn }).click();
            await look(popup, "open-in");
            await popup.keyboard.press("Escape");
            await popup.getByRole("button", { name: d.groupActions("Kilo 2026") }).click();
            await look(popup, "window-menu");
            await popup.keyboard.press("Escape");
            await popup.getByRole("button", { name: new RegExp(`^${d.outdated}`) }).click();
            await look(popup, "waiting");
            await popup.getByRole("button", { name: d.all, exact: true }).click();
            await popup.getByRole("button", { name: d.sortButton(d.sortOptions.custom) }).click();
            await look(popup, "sort");
            await popup.keyboard.press("Escape");
            await popup.getByRole("button", { name: "Work", exact: true }).click();
            await popup.getByRole("textbox", { name: d.searchLabel }).fill("Zzyzx");
            await look(popup, "no-matches");
            await popup.getByRole("button", { name: d.clearSearch }).click();
            await popup.getByRole("button", { name: d.all, exact: true }).click();
            // The one with a reminder, whose choice is the longest.
            await popup.getByRole("button", { name: d.editTab("Delta 2026") }).click({ force: true });
            await look(popup, "edit");
            await popup.getByRole("button", { name: d.cancel, exact: true }).click();
            await popup.getByRole("button", { name: d.selectTabs }).click();
            await popup.getByRole("button", { name: d.selectAll, exact: true }).click();
            await look(popup, "selecting");
            await popup.getByRole("button", { name: d.stopSelecting }).click();
            await popup.getByRole("button", { name: d.addLinkManually }).click();
            await look(popup, "add");
            await popup.getByRole("button", { name: d.cancel, exact: true }).click();
            // Closed, and the list settled where it was, before a row's button is pressed.
            await expect(popup.getByRole("textbox", { name: d.urlLabel })).toBeHidden();
            await popup.getByRole("listitem").filter({ hasText: "Charlie 2026" }).hover();
            await popup.getByRole("button", { name: d.archiveTab("Charlie 2026") }).click();
            await expect(popup.getByRole("button", { name: d.undo, exact: true })).toBeVisible();
            await look(popup, "toast");
            await popup.getByRole("button", { name: new RegExp(`^${d.archived}`) }).click();
            await look(popup, "archive");
            await popup.getByRole("button", { name: d.selectTabs }).click();
            await popup.getByRole("button", { name: d.selectAll, exact: true }).click();
            await look(popup, "selecting-archive");
        });

        test("the save card speaks it, and everything fits", async ({ context, popup }) => {
            test.setTimeout(90_000);
            const url = await popupAt(context, popup);
            await seedLibrary(popup, [...LIBRARY, { title: "Lima 2026", url, category: "Work", daysAgo: 12 }], {}, { groups: GROUPS });
            await look(popup, "already-saved");
            await seedLibrary(popup, [...LIBRARY, { title: "Lima 2026", url, category: "Work", archivedDaysAgo: 2 }], {}, { groups: GROUPS });
            await look(popup, "already-archived");

            await seedLibrary(popup, LIBRARY, {}, { groups: GROUPS });
            await answerPermissionPrompt(context, popup, "grant");
            await openSiteTab(context, popup, "Mike 2026");
            await openSiteTab(context, popup, "Lima 2026");
            await popup.getByRole("button", { name: d.addNote }).click();
            await look(popup, "save-window");
            await popup.getByTitle(d.saveWindowTooltip).click();
            await expect(popup.getByTitle(d.closeTabsTooltip)).toBeVisible();
            await look(popup, "window-saved");
        });

        test("Settings speaks it, and everything fits", async ({ context, popup }) => {
            test.setTimeout(90_000);
            await popupAt(context, popup);
            await seedLibrary(popup, LIBRARY, {}, { groups: GROUPS });
            await popup.getByRole("button", { name: d.openSettings }).click();
            for (const tab of [d.tabGeneral, d.tabCategories, d.tabBackup, d.tabAbout]) {
                await popup.getByRole("tab", { name: tab }).click();
                await look(popup, `settings-${tab}`);
            }
            await popup.getByRole("tab", { name: d.tabCategories }).click();
            await popup.getByRole("button", { name: d.colorFor("Reading") }).click();
            await look(popup, "settings-colors");
            await popup.getByRole("button", { name: d.removeCategory("Work") }).click();
            await expect(popup.getByRole("button", { name: d.removeConfirm, exact: true })).toBeVisible();
            await look(popup, "settings-remove");
            await popup.getByRole("tab", { name: d.tabBackup }).click();
            await popup.locator("#import-file-input").setInputFiles(BACKUP);
            await expect(popup.getByRole("button", { name: d.merge })).toBeVisible();
            await look(popup, "settings-import");
        });

        test("the side panel speaks it, and everything fits", async ({ context, popup }) => {
            await popup.emulateMedia({ reducedMotion: "reduce" });
            await seedLibrary(popup, LIBRARY, {}, { groups: GROUPS });
            await popup.setViewportSize({ width: 360, height: 800 });
            await popup.goto(SIDE_PANEL_URL);
            await waitUntilReady(popup);
            await openSiteTab(context, popup, "Lima 2026");
            await look(popup, "side-panel");
            await popup.getByRole("button", { name: new RegExp(`^${d.archived}`) }).click();
            await look(popup, "side-panel-archive");
            // A page the panel may not see yet, before Chrome has asked.
            const url = "https://unseen.example.org/article";
            await context.route(url, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Unseen</title>" }));
            const opened = context.waitForEvent("page");
            await popup.evaluate((u) => chrome.tabs.create({ url: u, active: true }), url);
            await (await opened).waitForLoadState();
            await expect(popup.getByRole("region", { name: d.currentTab })).toContainText(d.panelPageTitle);
            await look(popup, "side-panel-unseen");
        });

        test("the library speaks it, and everything fits", async ({ context, popup }) => {
            test.setTimeout(90_000);
            await seedLibrary(popup, [...LIBRARY, ...STALE], {}, { groups: GROUPS, trackingSinceDaysAgo: 365 });
            const library = await context.newPage();
            await library.setViewportSize({ width: 1280, height: 800 });
            await library.emulateMedia({ reducedMotion: "reduce" });
            await library.goto(LIBRARY_URL);
            await waitUntilReady(library);
            await expect(library).toHaveTitle(d.libraryPageTitle);
            await look(library, "library");
            // Narrower windows: the sidebar beside the table down to 760px, above it below that.
            for (const width of [1024, 800, 700]) {
                await library.setViewportSize({ width, height: 700 });
                await look(library, `library-${width}`);
            }
            await library.setViewportSize({ width: 1280, height: 800 });
            await library.getByRole("checkbox", { name: d.selectAllShown }).click();
            await look(library, "library-picked");
            await library.getByRole("checkbox", { name: d.selectAllShown }).click();
            await library.getByRole("button", { name: d.uncategorized }).first().click();
            await look(library, "library-uncategorized");
            await library.getByRole("button", { name: d.addLinkManually }).click();
            await look(library, "library-add");
            await library.keyboard.press("Escape");
            await library.getByRole("button", { name: d.openSettings }).click();
            await look(library, "library-settings");

            const welcome = await context.newPage();
            await welcome.setViewportSize({ width: 1000, height: 640 });
            await welcome.goto(WELCOME_URL);
            await expect(welcome).toHaveTitle(d.welcomeTitle);
            await look(welcome, "welcome");
        });

        test("a fresh install's categories are in it", async ({ popup }) => {
            const settings = await popup.evaluate(async () => (await chrome.storage.local.get("tabSandwich.settings"))["tabSandwich.settings"]);
            expect(settings.categories).toEqual(Object.values(d.starterCategories));
            expect(settings.waitingCategories).toEqual([d.starterCategories.reading, "Uncategorized"]);
        });
    });
}
