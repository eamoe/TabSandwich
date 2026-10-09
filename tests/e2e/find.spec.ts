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
        await expect(tabList(popup).getByRole("heading", { name: "No saved tabs match “zzzz”" })).toBeVisible();
        await expect(tabList(popup)).toContainText("Try fewer letters");
        await popup.getByRole("button", { name: "Clear search" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Open Pull Requests", "Weekend Trip Itinerary", "The Pragmatic Programmer"]);
    });

    test("TC-257: typing a category's or saved window's name finds every tab in it", async ({ popup }) => {
        await seedLibrary(
            popup,
            [
                { title: "eamoe/projx", url: "https://github.com/eamoe/projx", category: "ProjX" },
                { title: "API reference", url: "https://docs.example.com/api", category: "ProjX" },
                { title: "Weekend Trip Itinerary", url: "https://airbnb.com/trips/1", category: "Personal", groupId: "w" },
                { title: "Flights", url: "https://flights.example.com/", category: "Personal", groupId: "w" },
                { title: "Unrelated", url: "https://unrelated.example.com/", category: "Work" },
            ],
            { categories: ["ProjX", "Work", "Personal", "Reading"] },
            { groups: [{ id: "w", name: "Toasted Rye" }] }
        );
        await search(popup).fill("projx");
        await expect.poll(() => rowTitles(popup)).toEqual(["eamoe/projx", "API reference"]);
        // A tab found by its category shows why: the matched letters of the name are highlighted.
        const docs = tabList(popup).locator("li[data-tab-id]").filter({ hasText: "API reference" });
        await expect(docs.locator("mark")).toHaveText(["ProjX"]);

        // The category plus a word narrows it down.
        await search(popup).fill("projx api");
        await expect.poll(() => rowTitles(popup)).toEqual(["API reference"]);

        // A saved window's name finds its tabs, each row naming the window (it isn't shown as one while searching).
        await search(popup).fill("rye");
        await expect.poll(() => rowTitles(popup)).toEqual(["Weekend Trip Itinerary", "Flights"]);
        const flights = tabList(popup).locator("li[data-tab-id]").filter({ hasText: "Flights" });
        await expect(flights).toContainText("Saved window: Toasted Rye");
        await expect(flights.locator("mark")).toHaveText(["Rye"]);

        // Names match where a word starts, not by scattered letters ("prsnl" is in no title or address either).
        await search(popup).fill("prsnl");
        await expect(tabList(popup).getByRole("heading", { name: "No saved tabs match “prsnl”" })).toBeVisible();
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
        await popup.getByRole("button", { name: "Waiting (1)" }).click();
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

    test("TC-115/TC-210: search only looks inside the selected category, and one click widens it", async ({ popup }) => {
        await popup.getByRole("button", { name: "Work", exact: true }).click();
        await search(popup).fill("itinerary");
        await expect(tabList(popup).getByRole("heading", { name: "No saved tabs match “itinerary”" })).toBeVisible();
        await expect(tabList(popup)).toContainText("Only tabs in Work were searched.");
        await popup.getByRole("button", { name: "Search all tabs" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Weekend Trip Itinerary"]);
        await expect(popup.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
        await expect(search(popup)).toHaveValue("itinerary");
    });
});
