import type { Page } from "@playwright/test";
import { test, expect, LIBRARY_URL, WELCOME_URL, waitUntilReady } from "../e2e/fixtures";
import { openSiteTab, seedLibrary } from "../e2e/helpers";
import { en } from "../../src/ui/locales/en";
import { dictionaries } from "../../src/ui/strings";

/**
 * Tab Sandwich in each of its languages, as Chrome in that language shows it (Linux Chromium
 * takes Chrome's language from LANGUAGE, which only these Docker runs can set; see the fixture's
 * chromeLanguage). Every screen is opened by the names that language gives its controls, and
 * none may show a word of English: any text of en.ts that the language words differently is a
 * screen still reading from somewhere other than its dictionary. The pictures land in
 * test-results/languages/, for a person to look at; they aren't approved screenshots.
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

/** Neutral names, so a title can never look like English the app forgot to translate. */
const LIBRARY = [
    { title: "Alpha 2026", url: "https://alpha.example.com/a", category: "Work", pinned: true },
    { title: "Bravo 2026", url: "https://bravo.example.com/b", category: "Work", daysAgo: 3, note: "Zulu 2026" },
    { title: "Charlie 2026", url: "https://charlie.example.com/c", category: "Reading", daysAgo: 12 },
    { title: "Delta 2026", url: "https://delta.example.com/d", daysAgo: 9, remindInDays: 2 },
    { title: "Echo 2026", url: "https://echo.example.com/e", groupId: "w" },
    { title: "Foxtrot 2026", url: "https://foxtrot.example.com/f", groupId: "w" },
    { title: "Golf 2026", url: "https://golf.example.com/g", archivedDaysAgo: 1 },
];
const GROUPS = [{ id: "w", name: "Kilo 2026", collapsed: false }];

for (const language of Object.keys(dictionaries).filter((l) => l !== "en")) {
    const d = dictionaries[language]!;

    test.describe(`In ${language}`, () => {
        test.use({ chromeLanguage: language });

        const look = async (page: Page, state: string, found: string[]) => {
            await page.screenshot({ path: `test-results/languages/${language}-${state}.png` });
            const words = await wordsOn(page);
            for (const leak of englishLeaks(language)) if (words.some((w) => leak.test(w))) found.push(`${state}: ${leak.source}`);
            for (const word of words) if (/\b(saved|search|categor(y|ies)|selected|reminder|settings)\b/i.test(word)) found.push(`${state}: "${word}"`);
        };

        test("every screen speaks it, with no English left", async ({ context, popup }) => {
            test.setTimeout(90_000);
            const found: string[] = [];
            await popup.setViewportSize({ width: 380, height: 600 });
            await popup.emulateMedia({ reducedMotion: "reduce" });
            await openSiteTab(context, popup, "Lima 2026");
            // The language, with Chrome's own region if it has one (es-ES): dates follow that.
            await expect(popup.locator("html")).toHaveAttribute("lang", new RegExp(`^${language.replace("_", "-")}(-|$)`));

            // The popup, fresh, with nothing saved.
            await seedLibrary(popup, [], {});
            await look(popup, "empty", found);

            await seedLibrary(popup, LIBRARY, {}, { groups: GROUPS });
            await look(popup, "main", found);
            await popup.getByRole("button", { name: new RegExp(`^${d.outdated}`) }).click();
            await look(popup, "waiting", found);
            await popup.getByRole("button", { name: d.all, exact: true }).click();
            await popup.getByRole("button", { name: d.sortButton(d.sortOptions.custom) }).click();
            await look(popup, "sort", found);
            await popup.keyboard.press("Escape");
            await popup.getByRole("button", { name: d.editTab("Bravo 2026") }).click({ force: true });
            await look(popup, "edit", found);
            await popup.getByRole("button", { name: d.cancel, exact: true }).click();
            await popup.getByRole("button", { name: d.selectTabs }).click();
            await popup.getByRole("checkbox", { name: /Charlie 2026/ }).click({ force: true });
            await look(popup, "selecting", found);
            await popup.getByRole("button", { name: d.stopSelecting }).click();
            await popup.getByRole("button", { name: d.addLinkManually }).click();
            await look(popup, "add", found);
            await popup.keyboard.press("Escape");
            await popup.getByRole("button", { name: new RegExp(`^${d.archived}`) }).click();
            await look(popup, "archive", found);

            await popup.getByRole("button", { name: d.openSettings }).click();
            for (const tab of [d.tabGeneral, d.tabCategories, d.tabBackup, d.tabAbout]) {
                await popup.getByRole("tab", { name: tab }).click();
                await look(popup, `settings-${tab}`, found);
            }

            const library = await context.newPage();
            await library.setViewportSize({ width: 1280, height: 800 });
            await library.emulateMedia({ reducedMotion: "reduce" });
            await library.goto(LIBRARY_URL);
            await waitUntilReady(library);
            await expect(library).toHaveTitle(d.libraryPageTitle);
            await look(library, "library", found);
            await library.getByRole("button", { name: d.uncategorized }).first().click();
            await look(library, "library-uncategorized", found);

            const welcome = await context.newPage();
            await welcome.setViewportSize({ width: 1000, height: 640 });
            await welcome.goto(WELCOME_URL);
            await expect(welcome).toHaveTitle(d.welcomeTitle);
            await look(welcome, "welcome", found);

            expect(found).toEqual([]);
        });

        test("a fresh install's categories are in it", async ({ popup }) => {
            const settings = await popup.evaluate(async () => (await chrome.storage.local.get("tabSandwich.settings"))["tabSandwich.settings"]);
            expect(settings.categories).toEqual(Object.values(d.starterCategories));
            expect(settings.waitingCategories).toEqual([d.starterCategories.reading, "Uncategorized"]);
        });
    });
}
