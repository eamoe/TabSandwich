import type { Page } from "@playwright/test";
import { test, expect, LIBRARY_URL, POPUP_URL, waitUntilReady } from "./fixtures";
import { clickMenu, openFromMenu, openSettings, openSiteTab, seedLibrary, storedSettings, storedTabs, worker } from "./helpers";

const LIBRARY = [
    { title: "Alpha", url: "https://alpha.example.com/", category: "Work", daysAgo: 1 },
    { title: "Bravo", url: "https://bravo.example.com/", category: "Reading", daysAgo: 30, note: "for the Thursday meeting" },
    { title: "Charlie", url: "https://charlie.example.com/", category: "Work", daysAgo: 3, groupId: "w" },
    { title: "Delta", url: "https://delta.example.com/", daysAgo: 2, groupId: "w" },
    { title: "Echo", url: "https://echo.example.com/", category: "Work", daysAgo: 4, archivedDaysAgo: 1 },
];
const GROUPS = [{ id: "w", name: "Toasted Rye" }];

const open = async (popup: Page) => {
    await popup.setViewportSize({ width: 1280, height: 800 });
    await popup.goto(LIBRARY_URL);
    await waitUntilReady(popup);
};
const table = (page: Page) => page.getByRole("table", { name: "Saved tabs" });
const titles = (page: Page) => table(page).locator("tbody tr[data-tab-id] td:nth-child(2) button").evaluateAll((els) => els.map((e) => e.textContent));
const side = (page: Page) => page.getByRole("navigation", { name: "Filter your library" });
const rowOf = (page: Page, title: string) => table(page).getByRole("row").filter({ hasText: title });

test.describe("The library", () => {
    test.beforeEach(async ({ popup }) => {
        await seedLibrary(popup, LIBRARY, {}, { groups: GROUPS });
        await open(popup);
    });

    test("TC-295: the sidebar filters by what's there, with counts; the archive only on its own", async ({ popup }) => {
        await expect.poll(() => titles(popup)).toEqual(["Alpha", "Delta", "Charlie", "Bravo"]);
        await expect(side(popup).getByRole("button", { name: /^All tabs/ })).toContainText("4");
        await side(popup).getByRole("button", { name: /^Work/ }).click();
        await expect.poll(() => titles(popup)).toEqual(["Alpha", "Charlie"]);
        await expect(popup.getByRole("heading", { level: 2, name: "Work" })).toBeVisible();
        await side(popup).getByRole("button", { name: /^Toasted Rye/ }).click();
        await expect.poll(() => titles(popup)).toEqual(["Delta", "Charlie"]);
        await side(popup).getByRole("button", { name: /^Archived/ }).click();
        await expect.poll(() => titles(popup)).toEqual(["Echo"]);
        await side(popup).getByRole("button", { name: /^Waiting/ }).click();
        await expect.poll(() => titles(popup)).toEqual(["Bravo"]);
    });

    test("TC-296: category names show whole", async ({ popup }) => {
        await seedLibrary(popup, [
            { title: "Loose", url: "https://loose.example.com/" },
            { title: "Longest name", url: "https://long.example.com/", category: "Entertainment 2" },
        ], { categories: ["Entertainment 2"] });
        await open(popup);
        for (const name of ["Uncategorized", "Entertainment 2"]) {
            const cell = table(popup).getByRole("cell", { name, exact: true }).locator("span[title]");
            expect(await cell.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        }
    });

    test("TC-296: columns sort both ways, and / searches titles, notes and categories", async ({ popup }) => {
        await table(popup).getByRole("button", { name: "Title" }).click();
        await expect.poll(() => titles(popup)).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
        await expect(table(popup).getByRole("columnheader", { name: "Title" })).toHaveAttribute("aria-sort", "ascending");
        await table(popup).getByRole("button", { name: "Title" }).click();
        await expect.poll(() => titles(popup)).toEqual(["Delta", "Charlie", "Bravo", "Alpha"]);

        await table(popup).getByRole("button", { name: "Category" }).focus();
        await popup.keyboard.press("/");
        await expect(popup.getByRole("textbox", { name: "Search saved tabs" })).toBeFocused();
        await popup.keyboard.type("thursday");
        await expect.poll(() => titles(popup)).toEqual(["Bravo"]);
        await expect(popup.getByText("1 tab", { exact: true })).toBeVisible();
        await popup.getByRole("textbox", { name: "Search saved tabs" }).fill("nothing like this");
        await expect(popup.getByText("No saved tabs match")).toBeVisible();
    });

    test("TC-297: picking several moves or archives them in one step, with Undo", async ({ popup }) => {
        await rowOf(popup, "Alpha").getByRole("checkbox").click();
        // Shift picks everything up to here.
        await rowOf(popup, "Bravo").getByRole("checkbox").click({ modifiers: ["Shift"] });
        await popup.getByRole("navigation", { name: /select/i }).getByRole("combobox").selectOption("Reading");
        await expect.poll(async () => (await storedTabs(popup)).filter((t) => t.category === "Reading").map((t) => t.title).sort()).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(async () => (await storedTabs(popup)).find((t) => t.title === "Alpha")?.category).toBe("Work");

        await table(popup).getByRole("checkbox", { name: "Select all shown" }).click();
        await popup.getByRole("navigation", { name: /select/i }).getByRole("button", { name: /^Archive/ }).click();
        await expect.poll(() => titles(popup)).toEqual([]);
        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(() => titles(popup)).toEqual(["Alpha", "Delta", "Charlie", "Bravo"]);
    });

    test("TC-297: a row's own buttons edit, pin, archive; the archive restores and deletes for good", async ({ popup }) => {
        await rowOf(popup, "Alpha").hover();
        await popup.getByRole("button", { name: "Edit Alpha" }).click();
        await expect(popup).toHaveURL(/#edit\//);
        await expect(table(popup)).toBeVisible();
        await popup.getByLabel("Title", { exact: true }).fill("Alpha, renamed");
        await popup.getByRole("button", { name: "Save", exact: true }).click();
        await expect(rowOf(popup, "Alpha, renamed")).toBeVisible();
        await expect(popup).toHaveURL(LIBRARY_URL);

        // The answer shows where you pressed: the same button, lit, and still there with the pointer gone.
        await popup.getByRole("button", { name: "Pin Delta" }).click();
        const unpin = popup.getByRole("button", { name: "Unpin Delta" });
        await expect(unpin).toHaveAttribute("aria-pressed", "true");
        await popup.mouse.move(640, 5);
        await expect(unpin).toHaveCSS("opacity", "1");
        await expect(rowOf(popup, "Delta").getByRole("button", { name: "Edit Delta" })).toHaveCSS("opacity", "0");

        await popup.getByRole("button", { name: "Archive Bravo" }).click();
        await expect(rowOf(popup, "Bravo")).toHaveCount(0);
        await side(popup).getByRole("button", { name: /^Archived/ }).click();
        await popup.getByRole("button", { name: "Restore Bravo" }).click();
        await expect(rowOf(popup, "Bravo")).toHaveCount(0);
        await popup.getByRole("button", { name: "Delete Echo for good" }).click();
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).not.toContain("Echo");
    });

    test("TC-298: a title opens the tab and counts it", async ({ context, popup }) => {
        const opened = context.waitForEvent("page");
        await rowOf(popup, "Alpha").getByRole("button", { name: "Alpha", exact: true }).click();
        await opened;
        await expect(rowOf(popup, "Alpha")).toContainText("Today");

    });

    test("TC-300: adding and editing open beside the list, which stays put: Cancel, Escape and a reload all behave", async ({ popup }) => {
        await side(popup).getByRole("button", { name: /^Work/ }).click();
        const add = popup.getByRole("button", { name: "Add link manually" });
        await add.click();
        await expect(popup).toHaveURL(/#add$/);
        await expect(table(popup)).toBeVisible();
        await popup.getByRole("button", { name: "Cancel" }).click();
        await expect(popup.getByRole("complementary")).toHaveCount(0);
        await expect(add).toBeFocused();
        await expect(popup.getByRole("heading", { level: 2, name: "Work" })).toBeVisible();

        await add.click();
        await popup.getByLabel("URL").fill("https://foxtrot.example.com/");
        await popup.getByRole("button", { name: "Add", exact: true }).click();
        await expect(rowOf(popup, "foxtrot.example.com")).toBeVisible();
        await expect(popup.getByRole("heading", { level: 2, name: "All tabs" })).toBeVisible();

        await rowOf(popup, "Alpha").hover();
        await popup.getByRole("button", { name: "Edit Alpha" }).click();
        await expect(popup.getByLabel("Title", { exact: true })).toHaveValue("Alpha");
        await popup.reload();
        await waitUntilReady(popup);
        await expect(popup.getByLabel("Title", { exact: true })).toHaveValue("Alpha");
        await expect(popup.getByRole("complementary")).toContainText("Not opened from Tab Sandwich yet");
        // Editing another row swaps the panel; the way back still leads to the list.
        await popup.getByRole("button", { name: "Edit Bravo" }).focus();
        await popup.keyboard.press("Enter");
        await expect(popup.getByLabel("Title", { exact: true })).toHaveValue("Bravo");
        await popup.keyboard.press("Escape");
        await expect(popup.getByRole("complementary")).toHaveCount(0);
        await expect(popup).toHaveURL(LIBRARY_URL);
    });

    test("TC-300: the address of a tab that's gone just shows the list", async ({ popup }) => {
        await popup.goto(`${LIBRARY_URL}#edit/nothing-here`);
        await popup.reload();
        await waitUntilReady(popup);
        await expect(table(popup)).toBeVisible();
    });

    test("TC-300: Settings is a section of the page, with its own address, and your place in the list waits", async ({ popup }) => {
        await side(popup).getByRole("button", { name: /^Work/ }).click();
        await popup.getByRole("button", { name: "Open settings" }).click();
        const settings = popup.getByRole("main", { name: "Settings" });
        await expect(settings).toBeVisible();
        await expect(popup).toHaveURL(/#settings$/);
        await expect(table(popup)).toBeHidden();
        await expect(side(popup)).toBeVisible();
        // Going to the library from the library would do nothing, so it isn't offered.
        await expect(settings.getByRole("button", { name: "Open library" })).toBeHidden();

        await settings.getByRole("button", { name: "Dark", exact: true }).click();
        await expect(popup.locator("html")).toHaveAttribute("data-theme", "dark");
        await expect.poll(async () => (await storedSettings(popup)).theme).toBe("dark");

        // Back leaves as it came, focus back on the gear, and the filter waited.
        await settings.getByRole("button", { name: "Back" }).click();
        await expect(table(popup)).toBeVisible();
        await expect(popup.getByRole("heading", { level: 2, name: "Work" })).toBeVisible();
        await expect(popup.getByRole("button", { name: "Open settings" })).toBeFocused();

        // The browser's own Back and Forward, and a reload, agree.
        await popup.goForward();
        await expect(settings).toBeVisible();
        await popup.reload();
        await waitUntilReady(popup);
        await expect(settings).toBeVisible();
        // Anything in the sidebar leads out too.
        await side(popup).getByRole("button", { name: /^Waiting/ }).click();
        await expect(table(popup)).toBeVisible();
        await expect(popup).toHaveURL(LIBRARY_URL);
    });

    test("TC-300: a panel closes with a click outside it, or Escape from anywhere, and the list stays where it was left", async ({ popup }) => {
        await seedLibrary(popup, Array.from({ length: 80 }, (_, i) => ({ title: `Saved ${i}`, url: `https://page${i}.example.com/` })));
        await waitUntilReady(popup);
        const panel = popup.getByRole("complementary");
        const add = popup.getByRole("button", { name: "Add link manually" });

        await add.click();
        await expect(panel).toBeVisible();
        // Inside it, nothing closes.
        await panel.getByRole("heading").click();
        await expect(panel).toBeVisible();
        const box = table(popup).locator("xpath=..");
        await box.evaluate((el) => el.scrollTo({ top: 900 }));
        await popup.getByRole("heading", { level: 2, name: "All tabs" }).click();
        await expect(panel).toHaveCount(0);
        await expect(popup).toHaveURL(LIBRARY_URL);
        expect(await box.evaluate((el) => el.scrollTop)).toBe(900);

        // + opens and closes it; it doesn't close it only to reopen it.
        await add.click();
        await expect(panel).toBeVisible();
        await add.click();
        await expect(panel).toHaveCount(0);

        // Escape, with the focus out in the list.
        await add.click();
        await expect(panel).toBeVisible();
        await box.focus();
        await popup.getByRole("checkbox", { name: "Select all shown" }).focus();
        await popup.keyboard.press("Escape");
        await expect(panel).toHaveCount(0);
    });

    test("TC-300: searching from Settings goes to the results", async ({ popup }) => {
        await popup.getByRole("button", { name: "Open settings" }).click();
        await popup.getByRole("textbox", { name: "Search saved tabs" }).fill("thursday");
        await expect.poll(() => titles(popup)).toEqual(["Bravo"]);
    });

    test("TC-300: coming back from Settings finds the list where you left it", async ({ popup }) => {
        await seedLibrary(popup, Array.from({ length: 80 }, (_, i) => ({ title: `Saved ${i}`, url: `https://page${i}.example.com/` })));
        await waitUntilReady(popup);
        const box = table(popup).locator("xpath=..");
        await box.evaluate((el) => el.scrollTo({ top: 1200 }));
        await popup.getByRole("button", { name: "Open settings" }).click();
        await expect(table(popup)).toBeHidden();
        await popup.goBack();
        await expect(table(popup)).toBeVisible();
        await expect.poll(() => box.evaluate((el) => el.scrollTop)).toBe(1200);
    });

    test("TC-295: a right-click save appears without a refresh", async ({ context, popup }) => {
        await openSiteTab(context, popup, "Something to read");
        await clickMenu(context, popup, "Reading", { linkUrl: "https://link.example.com/", selectionText: "A saved link" });
        await expect(rowOf(popup, "A saved link")).toBeVisible();
    });
});

test("TC-299: the library stays quick with 1,000 tabs", async ({ popup }) => {
    const tabs = Array.from({ length: 1000 }, (_, i) => ({ title: `Saved page number ${String(i).padStart(4, "0")}`, url: `https://site${i % 40}.example.com/${i}`, daysAgo: i % 90 }));
    await seedLibrary(popup, tabs);
    await open(popup);
    await expect(popup.getByText("1000 tabs", { exact: true })).toBeVisible();
    // Only what's in view is drawn.
    expect(await table(popup).locator("tbody tr[data-tab-id]").count()).toBeLessThan(50);

    const box = table(popup).locator("xpath=..");
    await box.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await table(popup).getByRole("button", { name: "Title" }).click();
    await box.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect(rowOf(popup, "Saved page number 0999")).toBeVisible();

    const took = await popup.evaluate(async () => {
        const input = document.getElementById("library-search") as HTMLInputElement;
        const started = performance.now();
        input.value = "number 0500";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        while (document.querySelectorAll("tbody tr[data-tab-id]").length !== 1) await new Promise(requestAnimationFrame);
        return performance.now() - started;
    });
    expect(took).toBeLessThan(250);
});

test.describe("Getting to the library", () => {
    test("TC-298: the header and Settings both go there, without opening a second one", async ({ context, popup }) => {
        // Wherever a long list is scrolled, the header's button stays in view.
        await seedLibrary(popup, Array.from({ length: 300 }, (_, i) => ({ title: `Saved ${i}`, url: `https://page${i}.example.com/` })));
        await popup.reload();
        await waitUntilReady(popup);
        await popup.locator("#main-view").evaluate((list) => list.scrollTo({ top: list.scrollHeight }));
        await expect(popup.getByRole("button", { name: "Open in" })).toBeInViewport();
        const opened = context.waitForEvent("page");
        await openFromMenu(popup, "Open library");
        await waitUntilReady(await opened);
        await openSettings(popup, "General");
        await popup.getByRole("button", { name: "Open library" }).click();
        await popup.waitForTimeout(300);
        expect(context.pages().filter((p) => p.url() === LIBRARY_URL)).toHaveLength(1);
        expect(popup.url()).toBe(POPUP_URL);
    });

    test("TC-298: the toolbar icon's own menu does too", async ({ context }) => {
        const sw = await worker(context);
        const opened = context.waitForEvent("page");
        await sw.evaluate(() => (chrome.contextMenus.onClicked as unknown as { dispatch: (...args: unknown[]) => void }).dispatch({ menuItemId: "library", editable: false, pageUrl: "" }, undefined));
        await waitUntilReady(await opened);
        expect(context.pages().filter((p) => p.url() === LIBRARY_URL)).toHaveLength(1);
    });
});
