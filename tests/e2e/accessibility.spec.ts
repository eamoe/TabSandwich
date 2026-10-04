import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { openSettings, seedLibrary, tabList } from "./helpers";

/**
 * Accessibility rules not enforced yet, each with the release that fixes it. Kept as a named,
 * explained list so nothing gets quietly added to it just to make a run pass.
 */
const KNOWN_GAPS = [
    // Several colors are too faint (row icons, the Outdated pill, the age badge, pale tints).
    // The v3.0 redesign replaces the palette; this rule switches on as part of that release.
    "color-contrast",
];

async function scan(popup: Page) {
    const results = await new AxeBuilder({ page: popup }).disableRules(KNOWN_GAPS).analyze();
    // A readable summary on failure instead of a wall of JSON.
    return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
}

test.describe("Accessibility scan", () => {
    test.beforeEach(async ({ popup }) => {
        await seedLibrary(popup, [
            { title: "Q3 Roadmap", url: "https://notion.so/q3", category: "Work" },
            { title: "Old article", url: "https://medium.com/old", category: "Reading", daysAgo: 20 },
        ]);
    });

    test("main list", async ({ popup }) => {
        expect(await scan(popup)).toEqual([]);
    });

    test("manual entry open", async ({ popup }) => {
        await popup.getByRole("button", { name: "+ Add link manually" }).click();
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
        expect(await scan(popup)).toEqual([]);
    });

    test("undo toast showing", async ({ popup }) => {
        await popup.getByRole("button", { name: "Delete Q3 Roadmap" }).click();
        await expect(popup.getByRole("button", { name: "Undo" })).toBeVisible();
        expect(await scan(popup)).toEqual([]);
    });
});
