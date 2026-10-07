import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { openSettings, openSiteTab, seedLibrary, tabList } from "./helpers";

/**
 * Accessibility rules not enforced yet, each with the release that fixes it. Kept as a named,
 * explained list so nothing gets quietly added to it just to make a run pass. Empty since the
 * v3.0 redesign: every screen passes every rule, color contrast included, in both themes.
 */
const KNOWN_GAPS: string[] = [];

async function scan(popup: Page) {
    // Let entrance animations finish first: a half-faded element would be judged on colors it
    // only has for a fraction of a second.
    await popup.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
    const builder = new AxeBuilder({ page: popup });
    if (KNOWN_GAPS.length) builder.disableRules(KNOWN_GAPS);
    const results = await builder.analyze();
    // A readable summary on failure instead of a wall of JSON.
    return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
}

// Every screen is scanned in both themes: "passes in both light and dark" is a v3.0 promise,
// and checking it from the start catches a regression the moment a screen lands.
for (const colorScheme of ["light", "dark"] as const) {
    test.describe(`Accessibility scan (${colorScheme})`, () => {
        test.beforeEach(async ({ popup }) => {
            await popup.emulateMedia({ colorScheme });
            await seedLibrary(popup, [
                { title: "Q3 Roadmap", url: "https://notion.so/q3", category: "Work" },
                { title: "Old article", url: "https://medium.com/old", category: "Reading", daysAgo: 20 },
            ]);
        });

        test("main list", async ({ popup }) => {
            expect(await scan(popup)).toEqual([]);
        });

        test("first run: nothing saved yet", async ({ popup }) => {
            await seedLibrary(popup, []);
            await expect(popup.getByRole("heading", { name: "Nothing saved yet" })).toBeVisible();
            expect(await scan(popup)).toEqual([]);
        });

        test("a search with no results inside a filter", async ({ popup }) => {
            await popup.getByRole("button", { name: "Work", exact: true }).click();
            await popup.getByRole("textbox", { name: "Search saved tabs" }).fill("zzzz");
            await expect(popup.getByRole("button", { name: "Search all tabs" })).toBeVisible();
            expect(await scan(popup)).toEqual([]);
        });

        test("what's new showing", async ({ popup }) => {
            await seedLibrary(popup, [{ title: "Q3 Roadmap", url: "https://notion.so/q3", category: "Work" }], {}, { seenVersion: "3.0.0" });
            await expect(popup.getByRole("region", { name: "New in 3.1" })).toBeVisible();
            expect(await scan(popup)).toEqual([]);
        });

        test("the save card on a page that's already saved", async ({ context, popup }) => {
            const url = await openSiteTab(context, popup, "Example Article");
            await seedLibrary(popup, [{ title: "Example Article", url, category: "Work", daysAgo: 3 }]);
            await expect(popup.getByRole("button", { name: "Update" })).toBeVisible();
            expect(await scan(popup)).toEqual([]);
        });

        test("adding a link that's already saved", async ({ popup }) => {
            await popup.getByRole("button", { name: "Add link manually" }).click();
            await popup.getByLabel("URL").fill("https://notion.so/q3");
            await popup.getByRole("button", { name: "Add", exact: true }).click();
            await expect(popup.getByRole("button", { name: "Open", exact: true })).toBeVisible();
            expect(await scan(popup)).toEqual([]);
        });

        test("sort menu open", async ({ popup }) => {
            await popup.getByRole("button", { name: /^Sort:/ }).click();
            await expect(popup.getByRole("menu")).toBeVisible();
            expect(await scan(popup)).toEqual([]);
        });

        test("a saved window, closed and open, with its menu", async ({ popup }) => {
            const tabs = [
                { title: "Q3 Roadmap", url: "https://notion.so/q3", category: "Work", groupId: "w" },
                { title: "Old article", url: "https://medium.com/old", category: "Reading", daysAgo: 20, groupId: "w" },
                { title: "Loose", url: "https://loose.example.com/" },
            ];
            await seedLibrary(popup, tabs, {}, { groups: [{ id: "w", name: "Toasted Rye" }] });
            expect(await scan(popup)).toEqual([]);
            await popup.getByRole("button", { name: /^Toasted Rye/ }).click();
            await expect(popup.getByRole("list", { name: "Toasted Rye" })).toBeVisible();
            await popup.getByRole("button", { name: /^Actions for/ }).click();
            await expect(popup.getByRole("menu")).toBeVisible();
            expect(await scan(popup)).toEqual([]);
        });

        test("renaming a saved window", async ({ popup }) => {
            await seedLibrary(
                popup,
                [
                    { title: "A", url: "https://a.example.com/", groupId: "w" },
                    { title: "B", url: "https://b.example.com/", groupId: "w" },
                ],
                {},
                { groups: [{ id: "w", name: "Research" }] }
            );
            await popup.getByRole("button", { name: "Actions for Research" }).click();
            await popup.getByRole("menuitem", { name: "Rename" }).click();
            await expect(popup.getByRole("textbox", { name: "Saved window name" })).toBeFocused();
            expect(await scan(popup)).toEqual([]);
        });

        test("manual entry open", async ({ popup }) => {
            await popup.getByRole("button", { name: "Add link manually" }).click();
            await expect(popup.getByLabel("URL")).toBeVisible();
            expect(await scan(popup)).toEqual([]);
        });

        test("a row in edit mode", async ({ popup }) => {
            await popup.getByRole("button", { name: "Edit Q3 Roadmap" }).click();
            await expect(tabList(popup).getByLabel("Title", { exact: true })).toBeVisible();
            expect(await scan(popup)).toEqual([]);
        });

        for (const tab of ["General", "Categories", "Backup", "About"] as const) {
            test(`settings: ${tab}`, async ({ popup }) => {
                await openSettings(popup, tab);
                expect(await scan(popup)).toEqual([]);
            });
        }

        test("settings: a category's color picker open", async ({ popup }) => {
            await openSettings(popup, "Categories");
            await popup.getByRole("button", { name: "Color for Work" }).click();
            await expect(popup.getByRole("group", { name: "Color for Work" })).toBeVisible();
            expect(await scan(popup)).toEqual([]);
        });

        test("settings: import choice showing", async ({ popup }) => {
            await openSettings(popup, "Backup");
            await popup.locator("#import-file-input").setInputFiles({
                name: "backup.json",
                mimeType: "application/json",
                buffer: Buffer.from(JSON.stringify({ tabs: [{ title: "A", url: "https://a.example.com" }] })),
            });
            await expect(popup.getByRole("button", { name: "Merge" })).toBeVisible();
            expect(await scan(popup)).toEqual([]);
        });

        test("undo toast showing", async ({ popup }) => {
            await popup.getByRole("button", { name: "Delete Q3 Roadmap" }).click();
            await expect(popup.getByRole("button", { name: "Undo" })).toBeVisible();
            expect(await scan(popup)).toEqual([]);
        });
    });
}
