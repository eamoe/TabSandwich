import { test, expect } from "../e2e/fixtures";
import { openSettings, openSiteTab, seedLibrary } from "../e2e/helpers";

/**
 * One approved picture per screen and state, in light and dark (see playwright.visual.config.ts).
 * Fixed data, a fixed 380×600 window and the pointer parked off the rows keep every run identical.
 */
const LIBRARY = [
    { title: "Pull requests · eamoe/TabSandwich", url: "https://github.com/eamoe/TabSandwich/pulls", category: "Work" },
    { title: "Q3 Roadmap", url: "https://docs.google.com/document/d/q3", category: "Work", daysAgo: 2 },
    { title: "Manifest file format | Chrome Extensions", url: "https://developer.chrome.com/docs/extensions/manifest", category: "Work", daysAgo: 12 },
    { title: "Principles of calm technology", url: "https://calmtech.com/principles", category: "Reading", daysAgo: 9 },
    { title: "Local-first software", url: "https://inkandswitch.com/local-first", category: "Reading", daysAgo: 4 },
    { title: "Lisbon in 3 days: an itinerary", url: "https://lonelyplanet.com/lisbon", category: "Travel", daysAgo: 15 },
    { title: "Pastéis de nata at home", url: "https://bbcgoodfood.com/nata", category: "Recipes", daysAgo: 2 },
    { title: "Standing desk comparison", url: "https://rtings.com/desk", daysAgo: 1 },
    { title: "Hacker News", url: "https://news.ycombinator.com/" },
];
const SETTINGS = {
    categories: ["Work", "Reading", "Travel", "Recipes"],
    categoryColors: { Work: "blue", Reading: "purple", Travel: "teal", Recipes: "coral" },
};

for (const colorScheme of ["light", "dark"] as const) {
    test.describe(`Screens (${colorScheme})`, () => {
        test.beforeEach(async ({ context, popup }) => {
            await popup.setViewportSize({ width: 380, height: 600 });
            await popup.emulateMedia({ colorScheme, reducedMotion: "reduce" });
            await seedLibrary(popup, LIBRARY, SETTINGS);
            await openSiteTab(context, popup, "Designing calm interfaces");
            await popup.mouse.move(0, 599);
        });

        test("main list", async ({ popup }) => {
            await expect(popup).toHaveScreenshot(`main-${colorScheme}.png`);
        });

        test("editing a row", async ({ popup }) => {
            await popup.getByRole("button", { name: "Edit Q3 Roadmap" }).click();
            await expect(popup).toHaveScreenshot(`edit-${colorScheme}.png`);
        });

        test("adding a link by hand", async ({ popup }) => {
            await popup.getByRole("button", { name: "Add link manually" }).click();
            await expect(popup).toHaveScreenshot(`manual-${colorScheme}.png`);
        });

        test("a category filter", async ({ popup }) => {
            await popup.getByRole("button", { name: "Reading", exact: true }).click();
            await popup.mouse.move(0, 599);
            await expect(popup).toHaveScreenshot(`filter-${colorScheme}.png`);
        });

        test("the sort menu open", async ({ popup }) => {
            await popup.getByRole("button", { name: /^Sort:/ }).click();
            await expect(popup.getByRole("menu")).toBeVisible();
            await expect(popup).toHaveScreenshot(`sort-menu-${colorScheme}.png`);
        });

        test("sorted newest first", async ({ popup }) => {
            await popup.getByRole("button", { name: /^Sort:/ }).click();
            await popup.getByRole("menuitemradio", { name: "Newest first" }).click();
            await expect(popup.getByRole("button", { name: "Sort: Newest first" })).toBeVisible();
            await popup.mouse.move(0, 599);
            await expect(popup).toHaveScreenshot(`sorted-${colorScheme}.png`);
        });

        test("a search with no results inside a filter", async ({ popup }) => {
            await popup.getByRole("button", { name: "Work", exact: true }).click();
            await popup.getByRole("textbox", { name: "Search saved tabs" }).fill("sourdough");
            await popup.mouse.move(0, 599);
            await expect(popup).toHaveScreenshot(`no-matches-${colorScheme}.png`);
        });

        test("what's new after an update", async ({ popup }) => {
            await seedLibrary(popup, LIBRARY, SETTINGS, { seenVersion: "3.0.0" });
            await popup.mouse.move(0, 599);
            await expect(popup.getByRole("region", { name: /^New in / })).toBeVisible();
            // The note's wording changes every release; that's not a visual change.
            await expect(popup).toHaveScreenshot(`whats-new-${colorScheme}.png`, { mask: [popup.getByRole("region", { name: /^New in / }).getByRole("list")] });
        });

        test("settings: general", async ({ popup }) => {
            await openSettings(popup);
            await expect(popup).toHaveScreenshot(`settings-general-${colorScheme}.png`);
        });

        test("settings: categories with the color strip open", async ({ popup }) => {
            await openSettings(popup, "Categories");
            await popup.getByRole("button", { name: "Color for Reading" }).click();
            await expect(popup).toHaveScreenshot(`settings-categories-${colorScheme}.png`);
        });

        test("settings: import choice", async ({ popup }) => {
            await openSettings(popup, "Backup");
            await popup.locator("#import-file-input").setInputFiles({
                name: "backup.json",
                mimeType: "application/json",
                buffer: Buffer.from(JSON.stringify({ tabs: [{ title: "A", url: "https://a.example.com" }] })),
            });
            await expect(popup.getByRole("button", { name: "Merge" })).toBeVisible();
            await expect(popup).toHaveScreenshot(`settings-backup-${colorScheme}.png`);
        });

        test("settings: about", async ({ popup }) => {
            await openSettings(popup, "About");
            // The version changes every release; that's not a visual change.
            await expect(popup).toHaveScreenshot(`settings-about-${colorScheme}.png`, { mask: [popup.getByText(/^Version /)] });
        });
    });
}

for (const colorScheme of ["light", "dark"] as const) {
    test(`first run: nothing saved yet (${colorScheme})`, async ({ popup }) => {
        await popup.setViewportSize({ width: 380, height: 600 });
        await popup.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await seedLibrary(popup, []);
        await expect(popup.getByRole("heading", { name: "Nothing saved yet" })).toBeVisible();
        await expect(popup).toHaveScreenshot(`empty-${colorScheme}.png`);
    });
}
