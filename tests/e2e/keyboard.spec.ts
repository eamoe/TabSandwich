import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { openSiteTab, row, rowTitles, seedLibrary, storedTabs, tabList } from "./helpers";

const LIBRARY = [
    { title: "Alpha", url: "https://alpha.example.com/", category: "Work" },
    { title: "Bravo", url: "https://bravo.example.com/", category: "Reading" },
    { title: "Charlie", url: "https://charlie.example.com/", category: "Work" },
];
const titleOf = (popup: Page, title: string) => row(popup, title).getByRole("button", { name: title, exact: true });
const search = (popup: Page) => popup.getByRole("textbox", { name: "Search saved tabs" });
/** What the list last said to screen readers. */
const announced = (popup: Page) => tabList(popup).locator("xpath=following-sibling::p[@role='status']");

test.describe("Keyboard control", () => {
    test.beforeEach(async ({ popup }) => {
        await seedLibrary(popup, LIBRARY);
    });

    test("TC-220: arrow keys move through the list, and the list is one stop for Tab", async ({ popup }) => {
        await search(popup).press("ArrowDown");
        await expect(titleOf(popup, "Alpha")).toBeFocused();
        await popup.keyboard.press("ArrowDown");
        await expect(titleOf(popup, "Bravo")).toBeFocused();
        await popup.keyboard.press("End");
        await expect(titleOf(popup, "Charlie")).toBeFocused();
        await popup.keyboard.press("ArrowDown");
        await expect(titleOf(popup, "Charlie")).toBeFocused();
        await popup.keyboard.press("Home");
        await expect(titleOf(popup, "Alpha")).toBeFocused();
        // Only the current row's buttons are in the Tab order: title, Edit, Archive, Pin, then out.
        await popup.keyboard.press("ArrowDown");
        await popup.keyboard.press("Tab");
        await expect(popup.getByRole("button", { name: "Edit Bravo" })).toBeFocused();
        await popup.keyboard.press("Tab");
        await expect(popup.getByRole("button", { name: "Archive Bravo" })).toBeFocused();
        await popup.keyboard.press("Tab");
        await expect(popup.getByRole("button", { name: "Pin Bravo" })).toBeFocused();
        await popup.keyboard.press("Tab");
        await expect(tabList(popup).locator(":focus")).toHaveCount(0);
    });

    test("TC-221: Enter opens, E edits, Escape cancels the edit and returns to the row", async ({ popup }) => {
        await search(popup).press("ArrowDown");
        // Opens a new tab (the tests are offline, so ask Chrome how many tabs there are rather
        // than waiting for the page itself).
        const tabCount = () => popup.evaluate(async () => (await chrome.tabs.query({})).length);
        const before = await tabCount();
        await popup.keyboard.press("Enter");
        await expect.poll(tabCount).toBe(before + 1);
        await titleOf(popup, "Alpha").focus();
        await popup.keyboard.press("e");
        const field = tabList(popup).getByLabel("Title", { exact: true });
        await expect(field).toBeFocused();
        await popup.keyboard.press("Escape");
        await expect(titleOf(popup, "Alpha")).toBeFocused();
        // Saving with Enter also lands back on the row.
        await popup.keyboard.press("e");
        await field.fill("Alpha renamed");
        await popup.keyboard.press("Enter");
        await expect(titleOf(popup, "Alpha renamed")).toBeFocused();
    });

    test("TC-222: Delete archives the row, focus moves on, and Ctrl+Z (⌘Z) brings it back", async ({ popup }) => {
        await titleOf(popup, "Bravo").focus();
        await popup.keyboard.press("Delete");
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Charlie"]);
        await expect(titleOf(popup, "Charlie")).toBeFocused();
        await popup.keyboard.press("ControlOrMeta+z");
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Bravo", "Charlie"]);
        // The Mac "delete" key is Backspace; it works too. The last row hands focus back up.
        await titleOf(popup, "Charlie").focus();
        await popup.keyboard.press("Backspace");
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Bravo"]);
        await expect(titleOf(popup, "Bravo")).toBeFocused();
    });

    test("TC-223: Alt+arrows move a tab, saying where it went, only in your own order", async ({ popup }) => {
        await titleOf(popup, "Alpha").focus();
        await popup.keyboard.press("Alt+ArrowDown");
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Bravo", "Alpha", "Charlie"]);
        await expect(titleOf(popup, "Alpha")).toBeFocused();
        await expect(announced(popup)).toHaveText("Moved “Alpha” to position 2 of 3");
        await popup.keyboard.press("Alt+ArrowUp");
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Bravo", "Charlie"]);
        await expect(announced(popup)).toContainText("Moved “Alpha” to position 1 of 3");
        // Under a category filter it moves past the next visible tab.
        await popup.getByRole("button", { name: "Work", exact: true }).click();
        await titleOf(popup, "Alpha").focus();
        await popup.keyboard.press("Alt+ArrowDown");
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Bravo", "Charlie", "Alpha"]);
        // Sorted: refused, with the reason.
        await popup.getByRole("button", { name: /^Sort:/ }).click();
        await popup.getByRole("menuitemradio", { name: "Title (A–Z)" }).click();
        await titleOf(popup, "Alpha").focus();
        await popup.keyboard.press("Alt+ArrowDown");
        await expect(announced(popup)).toContainText("Tabs can only be moved in your own order");
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(["Bravo", "Charlie", "Alpha"]);
    });

    test("TC-224: / jumps to search from anywhere, Escape on a row goes back to it", async ({ popup }) => {
        await titleOf(popup, "Bravo").focus();
        await popup.keyboard.press("/");
        await expect(search(popup)).toBeFocused();
        await expect(search(popup)).toHaveValue("");
        await search(popup).press("ArrowDown");
        await popup.keyboard.press("Escape");
        await expect(search(popup)).toBeFocused();
    });

    test("TC-225: keys typed in a field stay in the field", async ({ popup }) => {
        await titleOf(popup, "Alpha").focus();
        await popup.keyboard.press("e");
        const field = tabList(popup).getByLabel("Title", { exact: true });
        await field.fill("");
        await popup.keyboard.type("e/");
        await popup.keyboard.press("Backspace");
        await expect(field).toHaveValue("e");
        await expect(search(popup)).not.toBeFocused();
        expect(await storedTabs(popup)).toHaveLength(3);
    });
});

test("TC-226: save, categorize, find, open, edit, delete, undo and reorder without a mouse", async ({ context, popup }) => {
    await seedLibrary(popup, LIBRARY);
    await openSiteTab(context, popup, "Example Article");
    // Save into a category: the picker takes typed letters, Tab reaches Save.
    await popup.getByLabel("Save to category").focus();
    await popup.keyboard.type("Reading");
    await popup.keyboard.press("Tab");
    await expect(popup.getByRole("button", { name: "Save Tab" })).toBeFocused();
    await popup.keyboard.press("Enter");
    await expect.poll(async () => (await storedTabs(popup))[0]).toMatchObject({ title: "Example Article", category: "Reading" });
    // Find it and open it.
    await titleOf(popup, "Alpha").focus();
    await popup.keyboard.press("/");
    await popup.keyboard.type("example");
    await popup.keyboard.press("ArrowDown");
    await expect(titleOf(popup, "Example Article")).toBeFocused();
    const opened = context.waitForEvent("page");
    await popup.keyboard.press("Enter");
    await opened;
    // Edit it.
    await titleOf(popup, "Example Article").focus();
    await popup.keyboard.press("e");
    await popup.keyboard.press("ControlOrMeta+a");
    await popup.keyboard.type("Example, edited");
    await popup.keyboard.press("Enter");
    await expect(titleOf(popup, "Example, edited")).toBeFocused();
    // Delete and undo.
    await popup.keyboard.press("Delete");
    await expect(row(popup, "Example, edited")).toHaveCount(0);
    await popup.keyboard.press("ControlOrMeta+z");
    await expect(row(popup, "Example, edited")).toHaveCount(1);
    // Back to the full list, and reorder.
    await popup.keyboard.press("/");
    await popup.keyboard.press("ControlOrMeta+a");
    await popup.keyboard.press("Backspace");
    await popup.keyboard.press("ArrowDown");
    await expect(titleOf(popup, "Example, edited")).toBeFocused();
    await popup.keyboard.press("Alt+ArrowDown");
    await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Alpha", "Example, edited", "Bravo", "Charlie"]);
});
