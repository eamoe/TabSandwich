import { test, expect } from "./fixtures";
import { row, rowTitles, seedLibrary, storedSettings, storedTabs } from "./helpers";

// Your own order is the order below; each sort would put them differently.
const LIBRARY = [
    { title: "Bravo", url: "https://zulu.example.com/", category: "Work", daysAgo: 3 },
    { title: "alpha", url: "https://yankee.example.com/", category: "Reading", daysAgo: 1 },
    { title: "Delta", url: "https://xray.example.com/", category: "Work", daysAgo: 9 },
    { title: "Charlie", url: "https://whiskey.example.com/", daysAgo: 5 },
];
const OWN_ORDER = ["Bravo", "alpha", "Delta", "Charlie"];

const sortButton = (popup: import("@playwright/test").Page) => popup.getByRole("button", { name: /^Sort:/ });

async function chooseSort(popup: import("@playwright/test").Page, option: string) {
    await sortButton(popup).click();
    await popup.getByRole("menuitemradio", { name: option }).click();
}

test.describe("Sorting", () => {
    test.beforeEach(async ({ popup }) => {
        await seedLibrary(popup, LIBRARY);
    });

    test("TC-202: each sort orders the list, and the button says which one is on", async ({ popup }) => {
        await expect(sortButton(popup)).toHaveAccessibleName("Sort: Your order");
        await chooseSort(popup, "Newest first");
        await expect.poll(() => rowTitles(popup)).toEqual(["alpha", "Bravo", "Charlie", "Delta"]);
        await expect(sortButton(popup)).toHaveAccessibleName("Sort: Newest first");
        await expect(sortButton(popup)).toHaveText("Newest");
        await chooseSort(popup, "Oldest first");
        await expect.poll(() => rowTitles(popup)).toEqual(["Delta", "Charlie", "Bravo", "alpha"]);
        await chooseSort(popup, "Title (A–Z)");
        await expect.poll(() => rowTitles(popup)).toEqual(["alpha", "Bravo", "Charlie", "Delta"]);
        await chooseSort(popup, "Site (A–Z)");
        await expect.poll(() => rowTitles(popup)).toEqual(["Charlie", "Delta", "alpha", "Bravo"]);
    });

    test("TC-203: the chosen sort is remembered the next time the popup opens", async ({ popup }) => {
        await chooseSort(popup, "Oldest first");
        await expect.poll(async () => (await storedSettings(popup)).sort).toBe("oldest");
        await popup.reload();
        await expect(sortButton(popup)).toHaveAccessibleName("Sort: Oldest first");
        await expect.poll(() => rowTitles(popup)).toEqual(["Delta", "Charlie", "Bravo", "alpha"]);
    });

    test("TC-204: going back to your order restores it exactly — sorting never rewrites it", async ({ popup }) => {
        await chooseSort(popup, "Title (A–Z)");
        await expect.poll(() => rowTitles(popup)).toEqual(["alpha", "Bravo", "Charlie", "Delta"]);
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(OWN_ORDER);
        await chooseSort(popup, "Your order");
        await expect.poll(() => rowTitles(popup)).toEqual(OWN_ORDER);
        await expect(sortButton(popup)).toHaveText("");
    });

    test("TC-205: rows can only be dragged in your own order", async ({ popup }) => {
        await expect(row(popup, "Bravo")).toHaveAttribute("draggable", "true");
        await chooseSort(popup, "Newest first");
        await expect(row(popup, "Bravo")).not.toHaveAttribute("draggable", "true");
        await chooseSort(popup, "Your order");
        await expect(row(popup, "Bravo")).toHaveAttribute("draggable", "true");
    });

    test("TC-206: the sort menu works from the keyboard", async ({ popup }) => {
        await sortButton(popup).focus();
        await popup.keyboard.press("Enter");
        // Opens on the current choice; arrows move, Enter picks, focus goes back to the button.
        await expect(popup.getByRole("menuitemradio", { name: "Your order" })).toBeFocused();
        await popup.keyboard.press("ArrowDown");
        await expect(popup.getByRole("menuitemradio", { name: "Newest first" })).toBeFocused();
        await popup.keyboard.press("Enter");
        await expect(popup.getByRole("menu")).toBeHidden();
        await expect(sortButton(popup)).toBeFocused();
        await expect(sortButton(popup)).toHaveAccessibleName("Sort: Newest first");
        // Escape closes without changing anything.
        await popup.keyboard.press("Enter");
        await popup.keyboard.press("ArrowDown");
        await popup.keyboard.press("Escape");
        await expect(popup.getByRole("menu")).toBeHidden();
        await expect(sortButton(popup)).toBeFocused();
        await expect(sortButton(popup)).toHaveAccessibleName("Sort: Newest first");
    });

    test("TC-207: a sort applies inside a category filter too", async ({ popup }) => {
        await popup.getByRole("button", { name: "Work" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Bravo", "Delta"]);
        await chooseSort(popup, "Oldest first");
        await expect.poll(() => rowTitles(popup)).toEqual(["Delta", "Bravo"]);
    });

    test("TC-208: clicking outside the menu closes it", async ({ popup }) => {
        await sortButton(popup).click();
        await expect(popup.getByRole("menu")).toBeVisible();
        await popup.mouse.click(5, 595);
        await expect(popup.getByRole("menu")).toBeHidden();
    });
});
