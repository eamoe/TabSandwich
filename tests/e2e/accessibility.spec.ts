import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { openSettings, seedLibrary, tabList } from "./helpers";

/**
 * Accessibility rules not enforced yet on a screen, each with the release that fixes it. Kept
 * as a named, explained list so nothing gets quietly added to it just to make a run pass.
 */
const KNOWN_GAPS = {
    // The main screen is the v3.0 design and passes every rule, color contrast included.
    main: [] as string[],
    // Settings is still the pre-v3.0 design, whose colors are too faint in places. It is
    // rebuilt in v3.0, and this exemption goes with it.
    settings: ["color-contrast"],
};

async function scan(popup: Page, screen: keyof typeof KNOWN_GAPS = "main") {
    // Let entrance animations finish first: a half-faded element would be judged on colors it
    // only has for a fraction of a second.
    await popup.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
    const builder = new AxeBuilder({ page: popup });
    if (KNOWN_GAPS[screen].length) builder.disableRules(KNOWN_GAPS[screen]);
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

        test("settings", async ({ popup }) => {
            await openSettings(popup);
            expect(await scan(popup, "settings")).toEqual([]);
        });

        test("undo toast showing", async ({ popup }) => {
            await popup.getByRole("button", { name: "Delete Q3 Roadmap" }).click();
            await expect(popup.getByRole("button", { name: "Undo" })).toBeVisible();
            expect(await scan(popup)).toEqual([]);
        });
    });
}
