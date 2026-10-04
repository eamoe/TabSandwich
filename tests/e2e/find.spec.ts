import { test, expect } from "./fixtures";
import { rowTitles, seedLibrary, tabList } from "./helpers";

test.describe("Search and filters", () => {
    test.beforeEach(async ({ popup }) => {
        await seedLibrary(popup, [
            { title: "Open Pull Requests", url: "https://github.com/eamoe/TabSandwich/pulls", category: "Work" },
            { title: "Weekend Trip Itinerary", url: "https://airbnb.com/trips/1", category: "Personal" },
            { title: "The Pragmatic Programmer", url: "https://pragprog.com/book", category: "Reading", daysAgo: 30 },
        ]);
    });

    const search = (popup: import("@playwright/test").Page) => popup.getByRole("textbox", { name: "Search saved tabs" });

    test("TC-111/TC-112: fuzzy search matches letters from the site name", async ({ popup }) => {
        await search(popup).fill("gthb");
        await expect.poll(() => rowTitles(popup)).toEqual(["Open Pull Requests"]);
    });

    test("TC-110: matched title letters are highlighted", async ({ popup }) => {
        await search(popup).fill("itinerary");
        await expect.poll(() => rowTitles(popup)).toEqual(["Weekend Trip Itinerary"]);
        await expect(tabList(popup).locator("mark")).toHaveText(["Itinerary"]);
    });

    test("TC-114/TC-116: no results, then clearing restores the full list", async ({ popup }) => {
        await search(popup).fill("zzzz");
        await expect(tabList(popup)).toContainText("No matching tabs.");
        await popup.getByRole("button", { name: "Clear search" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Open Pull Requests", "Weekend Trip Itinerary", "The Pragmatic Programmer"]);
    });

    test("TC-031: a category pill shows only that category", async ({ popup }) => {
        await popup.getByRole("button", { name: "Personal", exact: true }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Weekend Trip Itinerary"]);
        await expect(popup.getByRole("button", { name: "Personal", exact: true })).toHaveAttribute("aria-pressed", "true");
        await popup.getByRole("button", { name: "All", exact: true }).click();
        await expect.poll(() => rowTitles(popup)).toHaveLength(3);
    });

    test("TC-060/TC-061: old tabs get an age badge and their own filter", async ({ popup }) => {
        await expect(tabList(popup).getByTitle("Saved 30 days ago")).toHaveText("30d");
        await popup.getByRole("button", { name: "Outdated (1)" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["The Pragmatic Programmer"]);
    });

    test("TC-189: a search, filter and place in the list survive a trip to Settings", async ({ popup }) => {
        await popup.getByRole("button", { name: "Work", exact: true }).click();
        await search(popup).fill("pull");
        await popup.getByRole("button", { name: "Open settings" }).click();
        await popup.getByRole("button", { name: "Back", exact: true }).click();
        await expect(search(popup)).toHaveValue("pull");
        await expect(popup.getByRole("button", { name: "Work", exact: true })).toHaveAttribute("aria-pressed", "true");
        await expect.poll(() => rowTitles(popup)).toEqual(["Open Pull Requests"]);
    });

    test("TC-115: search only looks inside the selected category", async ({ popup }) => {
        await popup.getByRole("button", { name: "Work", exact: true }).click();
        await search(popup).fill("itinerary");
        await expect(tabList(popup)).toContainText("No matching tabs.");
    });
});
