import type { Page } from "@playwright/test";
import { test, expect, TEST_SITE } from "./fixtures";
import { answerPermissionPrompt, openSiteTab, rowTitles, seedLibrary, storedTabs, tabList, windowRow } from "./helpers";

/** Alpha, then the saved window "Research" (Gamma, Delta, Epsilon), then Omega. */
async function seedWindow(popup: Page, { collapsed = true }: { collapsed?: boolean } = {}) {
    await seedLibrary(
        popup,
        [
            { title: "Alpha", url: "https://alpha.example.com/" },
            { title: "Gamma", url: "https://gamma.example.com/", groupId: "g", category: "Work" },
            { title: "Delta", url: "https://delta.example.com/", groupId: "g", category: "Work" },
            { title: "Epsilon", url: "https://epsilon.example.com/", groupId: "g" },
            { title: "Omega", url: "https://omega.example.com/", category: "Work" },
        ],
        {},
        { groups: [{ id: "g", name: "Research", collapsed }] }
    );
}

const storedGroups = (popup: Page) =>
    popup.evaluate(async () => (await chrome.storage.local.get("tabSandwich.groups"))["tabSandwich.groups"] as Array<{ name: string; collapsed: boolean }>);
const titleOf = (popup: Page, title: string) => tabList(popup).locator("[data-row-title]").filter({ hasText: new RegExp(`^${title}$`) });
const actions = (popup: Page, name: string) => popup.getByRole("button", { name: `Actions for ${name}` });

test.describe("Saved windows", () => {
    test("TC-234: a saved window is one row that opens to show its tabs, and stays as you left it", async ({ popup }) => {
        await seedWindow(popup);
        expect(await rowTitles(popup)).toEqual(["Alpha", "▸ Research", "Omega"]);
        await expect(windowRow(popup, "Research")).toHaveAttribute("aria-expanded", "false");
        await expect(windowRow(popup, "Research")).toContainText("3 tabs");

        await windowRow(popup, "Research").click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "▾ Research", "Gamma", "Delta", "Epsilon", "Omega"]);
        await expect(tabList(popup).getByRole("list", { name: "Research" }).getByRole("listitem")).toHaveCount(3);

        // Remembered between opens.
        await popup.reload();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "▾ Research", "Gamma", "Delta", "Epsilon", "Omega"]);
        expect((await storedGroups(popup))[0].collapsed).toBe(false);
    });

    test("TC-229: saving a whole window saves it as one closed saved window, which flashes", async ({ context, popup }) => {
        await answerPermissionPrompt(context, popup, "grant");
        await openSiteTab(context, popup, "Alpha");
        await openSiteTab(context, popup, "Beta");
        await popup.getByRole("button", { name: /^Save all \d+ tabs in this window$/ }).click();
        await expect(popup.getByRole("status").filter({ hasText: "Saved 2 tabs" })).toBeVisible();
        const [name] = (await storedGroups(popup)).map((g) => g.name);
        // Named at random, sandwich-style; its count and date are shown beside the name.
        expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
        await expect(windowRow(popup, name)).toContainText("2 tabs");
        await expect(windowRow(popup, name)).toHaveAttribute("aria-expanded", "false");
        await windowRow(popup, name).click();
        await expect.poll(() => rowTitles(popup)).toEqual([`▾ ${name}`, "Alpha", "Beta"]);
    });

    test("TC-235: filtering or searching shows every tab as its own row, including ones in a closed window", async ({ popup }) => {
        await seedWindow(popup);
        await popup.getByRole("textbox", { name: "Search saved tabs" }).fill("delta");
        await expect.poll(() => rowTitles(popup)).toEqual(["Delta"]);
        await popup.getByRole("textbox", { name: "Search saved tabs" }).fill("");
        await popup.getByRole("button", { name: "Work", exact: true }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Gamma", "Delta", "Omega"]);
        await popup.getByRole("button", { name: "All", exact: true }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "▸ Research", "Omega"]);
    });

    test("TC-236: rename a saved window in place: Enter keeps it, Escape doesn't", async ({ popup }) => {
        await seedWindow(popup);
        await actions(popup, "Research").click();
        await popup.getByRole("menuitem", { name: "Rename" }).click();
        const field = popup.getByRole("textbox", { name: "Saved window name" });
        await expect(field).toBeFocused();
        await field.fill("Reading list");
        await popup.keyboard.press("Enter");
        await expect(windowRow(popup, "Reading list")).toBeVisible();
        expect((await storedGroups(popup))[0].name).toBe("Reading list");

        await actions(popup, "Reading list").click();
        await popup.getByRole("menuitem", { name: "Rename" }).click();
        await popup.getByRole("textbox", { name: "Saved window name" }).fill("Never mind");
        await popup.keyboard.press("Escape");
        await expect(windowRow(popup, "Reading list")).toBeVisible();
        expect((await storedGroups(popup))[0].name).toBe("Reading list");
    });

    test("TC-237: break a saved window apart, and Undo", async ({ popup }) => {
        await seedWindow(popup);
        await actions(popup, "Research").click();
        await popup.getByRole("menuitem", { name: "Break apart" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Gamma", "Delta", "Epsilon", "Omega"]);
        expect(await storedGroups(popup)).toEqual([]);
        expect(await storedTabs(popup)).toHaveLength(5);

        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "▸ Research", "Omega"]);
    });

    test("TC-238: delete a saved window with its tabs, and Undo", async ({ popup }) => {
        await seedWindow(popup);
        await actions(popup, "Research").click();
        await popup.getByRole("menuitem", { name: "Delete window and its tabs" }).click();
        await expect(popup.getByText("Deleted 3 tabs")).toBeVisible();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Omega"]);
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(["Alpha", "Omega"]);

        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "▸ Research", "Omega"]);
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(["Alpha", "Gamma", "Delta", "Epsilon", "Omega"]);
    });

    test("TC-239: open a saved window's tabs in a new window, keeping them or removing them", async ({ popup }) => {
        await seedWindow(popup);
        // Tab counts, not addresses: these sites are outside what the test copy of the extension may read.
        const windows = () => popup.evaluate(async () => (await chrome.windows.getAll()).length);
        const newestWindowTabs = () => popup.evaluate(async () => (await chrome.windows.getAll({ populate: true })).at(-1)?.tabs?.length);
        const before = await windows();

        await actions(popup, "Research").click();
        await popup.getByRole("menuitem", { name: "Open all in a new window" }).click();
        await expect.poll(windows).toBe(before + 1);
        await expect.poll(newestWindowTabs).toBe(3);
        expect(await storedTabs(popup)).toHaveLength(5);

        await actions(popup, "Research").click();
        await popup.getByRole("menuitem", { name: "Open all and remove from list" }).click();
        await expect.poll(windows).toBe(before + 2);
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Omega"]);
        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "▸ Research", "Omega"]);
    });

    test("TC-240: the ⋯ menu works from the keyboard", async ({ popup }) => {
        await seedWindow(popup);
        await actions(popup, "Research").focus();
        await popup.keyboard.press("Enter");
        await expect(popup.getByRole("menuitem", { name: "Open all in a new window" })).toBeFocused();
        await popup.keyboard.press("End");
        await expect(popup.getByRole("menuitem", { name: "Delete window and its tabs" })).toBeFocused();
        await popup.keyboard.press("ArrowDown");
        await expect(popup.getByRole("menuitem", { name: "Open all in a new window" })).toBeFocused();
        await popup.keyboard.press("Escape");
        await expect(popup.getByRole("menu")).toHaveCount(0);
        await expect(actions(popup, "Research")).toBeFocused();
    });

    test("TC-241: the list's keys work on saved windows too", async ({ popup }) => {
        await seedWindow(popup);
        await titleOf(popup, "Alpha").focus();
        await popup.keyboard.press("ArrowDown");
        await expect(windowRow(popup, "Research")).toBeFocused();
        // → opens it, and again goes into it; ← from a tab goes back up, and again closes it.
        await popup.keyboard.press("ArrowRight");
        await expect(windowRow(popup, "Research")).toHaveAttribute("aria-expanded", "true");
        await popup.keyboard.press("ArrowRight");
        await expect(titleOf(popup, "Gamma")).toBeFocused();
        await popup.keyboard.press("ArrowLeft");
        await expect(windowRow(popup, "Research")).toBeFocused();
        await popup.keyboard.press("ArrowLeft");
        await expect(windowRow(popup, "Research")).toHaveAttribute("aria-expanded", "false");
        // Enter toggles too, like any button.
        await popup.keyboard.press("Enter");
        await expect(windowRow(popup, "Research")).toHaveAttribute("aria-expanded", "true");
        await popup.keyboard.press("Enter");
        await expect(windowRow(popup, "Research")).toHaveAttribute("aria-expanded", "false");
        // Down past a closed window skips its tabs.
        await popup.keyboard.press("ArrowDown");
        await expect(titleOf(popup, "Omega")).toBeFocused();

        // Delete on the window's row deletes the window, with Undo; focus moves on.
        await windowRow(popup, "Research").focus();
        await popup.keyboard.press("Delete");
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Omega"]);
        await expect(titleOf(popup, "Omega")).toBeFocused();
        await popup.keyboard.press("ControlOrMeta+z");
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "▸ Research", "Omega"]);
    });

    test("TC-242: moving tabs keeps a saved window together", async ({ popup }) => {
        await seedWindow(popup, { collapsed: false });
        const order = async () => (await storedTabs(popup)).map((t) => t.title);

        // A loose tab steps past the whole window at once, both ways.
        await titleOf(popup, "Alpha").focus();
        await popup.keyboard.press("Alt+ArrowDown");
        await expect.poll(order).toEqual(["Gamma", "Delta", "Epsilon", "Alpha", "Omega"]);
        await expect.poll(() => rowTitles(popup)).toEqual(["▾ Research", "Gamma", "Delta", "Epsilon", "Alpha", "Omega"]);
        await popup.keyboard.press("Alt+ArrowUp");
        await expect.poll(order).toEqual(["Alpha", "Gamma", "Delta", "Epsilon", "Omega"]);

        // A tab in the window moves within it, and stops at its edge.
        await titleOf(popup, "Gamma").focus();
        await popup.keyboard.press("Alt+ArrowDown");
        await expect.poll(order).toEqual(["Alpha", "Delta", "Gamma", "Epsilon", "Omega"]);
        await expect(popup.getByRole("status").filter({ hasText: "Moved “Gamma” to position 2 of 3" })).toBeAttached();
        await popup.keyboard.press("Alt+ArrowDown");
        await popup.keyboard.press("Alt+ArrowDown");
        await expect.poll(order).toEqual(["Alpha", "Delta", "Epsilon", "Gamma", "Omega"]);
    });

    test("TC-243: Show on a page saved inside a closed window opens the window to point at it", async ({ context, popup }) => {
        await seedLibrary(
            popup,
            [
                { title: "Other", url: "https://other.example.com/", groupId: "g" },
                { title: "Example Article", url: `${TEST_SITE}/Example%20Article`, groupId: "g" },
            ],
            {},
            { groups: [{ id: "g", name: "Research" }] }
        );
        await openSiteTab(context, popup, "Example Article");
        await popup.getByRole("button", { name: "Show" }).click();
        await expect(windowRow(popup, "Research")).toHaveAttribute("aria-expanded", "true");
        await expect(titleOf(popup, "Example Article")).toBeVisible();
    });

    test("TC-244: a window down to its last tab shows that tab as an ordinary row", async ({ popup }) => {
        await seedLibrary(
            popup,
            [
                { title: "Only one left", url: "https://one.example.com/", groupId: "g" },
                { title: "Loose", url: "https://loose.example.com/" },
            ],
            {},
            { groups: [{ id: "g", name: "Research" }] }
        );
        expect(await rowTitles(popup)).toEqual(["Only one left", "Loose"]);
    });
});
