import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { rowTitles, seedLibrary, storedTabs, tabList, windowRow } from "./helpers";

/** Alpha, Bravo, the saved window "Research" (Gamma, Delta), Echo. */
async function seed(popup: Page, { collapsed = true }: { collapsed?: boolean } = {}) {
    await seedLibrary(
        popup,
        [
            { title: "Alpha", url: "https://alpha.example.com/", category: "Work" },
            { title: "Bravo", url: "https://bravo.example.com/", category: "Work" },
            { title: "Gamma", url: "https://gamma.example.com/", groupId: "g" },
            { title: "Delta", url: "https://delta.example.com/", groupId: "g" },
            { title: "Echo", url: "https://echo.example.com/", category: "Reading" },
        ],
        {},
        { groups: [{ id: "g", name: "Research", collapsed }] }
    );
}

const box = (popup: Page, title: string) => tabList(popup).getByRole("checkbox", { name: title, exact: true });
const bar = (popup: Page) => popup.getByRole("navigation", { name: "Selected tabs" });
const start = (popup: Page) => popup.getByRole("button", { name: "Select tabs" }).click();
const height = (popup: Page) => popup.evaluate(() => Math.round(document.getElementById("main-view")!.getBoundingClientRect().bottom));

test.describe("Choosing several tabs", () => {
    test("TC-249: Select turns rows into checkboxes; ✕ or Escape stops; the popup never changes size", async ({ popup }) => {
        await seed(popup);
        await popup.waitForTimeout(500);
        const before = await height(popup);
        await start(popup);
        expect(await height(popup)).toBe(before);
        // The bar takes the filter row's place, and focus moves to its ✕.
        await expect(popup.getByRole("navigation", { name: "Filter and sort saved tabs" })).toHaveCount(0);
        await expect(bar(popup)).toContainText("None selected");
        await expect(popup.getByRole("button", { name: "Stop selecting" })).toBeFocused();

        // Clicking the row picks it; clicking its checkbox picture does too; neither opens the tab.
        const tabsBefore = await popup.evaluate(async () => (await chrome.tabs.query({})).length);
        await box(popup, "Alpha").click();
        // (Clicked by position, as a person does: the picture itself lets the click through to the row.)
        const picture = await tabList(popup).locator("li[data-tab-id]").filter({ hasText: "Bravo" }).locator("span[aria-hidden] > span").boundingBox();
        await popup.mouse.click(picture!.x + picture!.width / 2, picture!.y + picture!.height / 2);
        await expect(box(popup, "Alpha")).toHaveAttribute("aria-checked", "true");
        await expect(box(popup, "Bravo")).toHaveAttribute("aria-checked", "true");
        await expect(bar(popup)).toContainText("2 selected");
        expect(await popup.evaluate(async () => (await chrome.tabs.query({})).length)).toBe(tabsBefore);
        // A row's own edit and delete step aside meanwhile.
        await expect(popup.getByRole("button", { name: "Edit Alpha" })).toHaveCount(0);

        await popup.getByRole("button", { name: "Stop selecting" }).click();
        await expect(popup.getByRole("navigation", { name: "Filter and sort saved tabs" })).toBeVisible();
        await expect(popup.getByRole("button", { name: "Select tabs" })).toBeFocused();
        expect(await height(popup)).toBe(before);
        // Picks don't survive stopping.
        await start(popup);
        await expect(bar(popup)).toContainText("None selected");
        await popup.keyboard.press("Escape");
        await expect(bar(popup)).toHaveCount(0);
        expect(popup.isClosed()).toBe(false);
    });

    test("TC-250: Shift-click picks a range", async ({ popup }) => {
        await seed(popup, { collapsed: false });
        await start(popup);
        await box(popup, "Alpha").click();
        await box(popup, "Delta").click({ modifiers: ["Shift"] });
        for (const title of ["Alpha", "Bravo", "Gamma", "Delta"]) await expect(box(popup, title)).toHaveAttribute("aria-checked", "true");
        await expect(box(popup, "Echo")).toHaveAttribute("aria-checked", "false");
        // Shift-click on a picked one unpicks the range from the last one picked back to it.
        await box(popup, "Bravo").click({ modifiers: ["Shift"] });
        for (const title of ["Bravo", "Gamma", "Delta"]) await expect(box(popup, title)).toHaveAttribute("aria-checked", "false");
        await expect(bar(popup)).toContainText("1 selected");
    });

    test("TC-251: a saved window's row picks all its tabs, shows when only some are, and still opens", async ({ popup }) => {
        await seed(popup);
        await start(popup);
        const window = tabList(popup).getByRole("checkbox", { name: /^Research/ });
        await window.click();
        await expect(window).toHaveAttribute("aria-checked", "true");
        await expect(bar(popup)).toContainText("2 selected");
        // The chevron opens it, showing its tabs picked; unpicking one makes the window "some".
        await popup.getByRole("button", { name: "Open or close this saved window" }).click();
        await expect(box(popup, "Gamma")).toHaveAttribute("aria-checked", "true");
        await box(popup, "Gamma").click();
        await expect(window).toHaveAttribute("aria-checked", "mixed");
        // From "some", the window's row picks them all again.
        await window.click();
        await expect(window).toHaveAttribute("aria-checked", "true");
        await window.click();
        await expect(window).toHaveAttribute("aria-checked", "false");
    });

    test("TC-252: Select all picks every tab shown, closed windows included; a new filter starts over", async ({ popup }) => {
        await seed(popup);
        await start(popup);
        await bar(popup).getByRole("button", { name: "Select all" }).click();
        await expect(bar(popup)).toContainText("5 selected");
        await popup.getByRole("button", { name: "Stop selecting" }).click();

        await popup.getByRole("button", { name: "Work", exact: true }).click();
        await start(popup);
        await bar(popup).getByRole("button", { name: "Select all" }).click();
        await expect(bar(popup)).toContainText("2 selected");
    });

    test("TC-253: Move to a category moves every picked tab in one step, with one Undo", async ({ popup }) => {
        await seed(popup);
        await start(popup);
        await box(popup, "Alpha").click();
        await box(popup, "Echo").click();
        await tabList(popup).getByRole("checkbox", { name: /^Research/ }).click();
        await popup.getByLabel("Move the selected tabs to a category").selectOption("Personal");
        await expect(popup.getByText("Moved 4 tabs to Personal")).toBeVisible();
        await expect(bar(popup)).toHaveCount(0);
        const categories = async () => Object.fromEntries((await storedTabs(popup)).map((t) => [t.title, t.category]));
        expect(await categories()).toEqual({ Alpha: "Personal", Bravo: "Work", Gamma: "Personal", Delta: "Personal", Echo: "Personal" });

        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(categories).toEqual({ Alpha: "Work", Bravo: "Work", Gamma: undefined, Delta: undefined, Echo: "Reading" });
    });

    test("TC-254: Archive takes every picked tab out of the list in one step, with one Undo", async ({ popup }) => {
        await seed(popup);
        await start(popup);
        await box(popup, "Bravo").click();
        await tabList(popup).getByRole("checkbox", { name: /^Research/ }).click();
        await bar(popup).getByRole("button", { name: "Archive 3 selected tabs" }).click();
        await expect(popup.getByText("Archived 3 tabs")).toBeVisible();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Echo"]);
        expect(await storedTabs(popup)).toHaveLength(5);

        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Bravo", "▸ Research", "Echo"]);
        await expect(windowRow(popup, "Research")).toBeVisible();
    });

    test("TC-269: in the archive, the bar restores or deletes for good", async ({ popup }) => {
        await seed(popup);
        await start(popup);
        await bar(popup).getByRole("button", { name: "Select all" }).click();
        await bar(popup).getByRole("button", { name: "Archive 5 selected tabs" }).click();
        await popup.getByRole("button", { name: "Archived (5)" }).click();
        await start(popup);
        // No moving to a category here: restore or delete for good.
        await expect(popup.getByLabel("Move the selected tabs to a category")).toHaveCount(0);
        await box(popup, "Alpha").click();
        await box(popup, "Bravo").click();
        await bar(popup).getByRole("button", { name: "Delete 2 selected tabs for good" }).click();
        await expect(popup.getByText("Deleted 2 tabs")).toBeVisible();
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(["Gamma", "Delta", "Echo"]);
        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(async () => (await storedTabs(popup)).length).toBe(5);

        await start(popup);
        await bar(popup).getByRole("button", { name: "Select all" }).click();
        await bar(popup).getByRole("button", { name: "Restore 5 selected tabs" }).click();
        await expect(popup.getByText("Restored 5 tabs")).toBeVisible();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Bravo", "▸ Research", "Echo"]);
    });

    test("TC-255: from the keyboard: arrows move, Space picks, a row's E and Delete stay quiet", async ({ popup }) => {
        await seed(popup);
        await start(popup);
        await bar(popup).getByRole("button", { name: "Stop selecting" }).press("Tab");
        await box(popup, "Alpha").focus();
        await popup.keyboard.press("Space");
        await expect(box(popup, "Alpha")).toHaveAttribute("aria-checked", "true");
        await popup.keyboard.press("ArrowDown");
        await expect(box(popup, "Bravo")).toBeFocused();
        await popup.keyboard.press("Space");
        await expect(bar(popup)).toContainText("2 selected");
        await popup.keyboard.press("Delete");
        await popup.keyboard.press("e");
        expect(await storedTabs(popup)).toHaveLength(5);
        await expect(popup.getByRole("textbox", { name: "Title" })).toHaveCount(0);
        // → and ← still open and close a window.
        await popup.keyboard.press("ArrowDown");
        await popup.keyboard.press("ArrowRight");
        await expect(box(popup, "Gamma")).toBeVisible();
    });

    test("TC-249: the bar's buttons wait for something to be picked", async ({ popup }) => {
        await seed(popup);
        await start(popup);
        await expect(popup.getByLabel("Move the selected tabs to a category")).toBeDisabled();
        await expect(bar(popup).getByRole("button", { name: /^Archive/ })).toBeDisabled();
    });
});
