import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { row, rowTitles, seedLibrary, storedTabs, tabList, windowRow } from "./helpers";

/** Alpha, Bravo, the saved window "Research" (Gamma, Delta), Echo (20 days old, in Reading, which ages). */
async function seed(popup: Page) {
    await seedLibrary(
        popup,
        [
            { title: "Alpha", url: "https://alpha.example.com/", category: "Work" },
            { title: "Bravo", url: "https://bravo.example.com/", category: "Work" },
            { title: "Gamma", url: "https://gamma.example.com/", groupId: "g" },
            { title: "Delta", url: "https://delta.example.com/", groupId: "g" },
            { title: "Echo", url: "https://echo.example.com/", category: "Reading", daysAgo: 20 },
        ],
        {},
        { groups: [{ id: "g", name: "Research", collapsed: false }] }
    );
}

const pinned = async (popup: Page) => (await storedTabs(popup)).filter((t) => (t as { pinned?: boolean }).pinned).map((t) => t.title);

test.describe("Pinned tabs", () => {
    test("TC-260: the pin button puts a tab on top, marked, never waiting; again unpins it", async ({ popup }) => {
        await seed(popup);
        await expect(row(popup, "Echo").getByTitle("Saved 20 days ago")).toBeVisible();
        await popup.getByRole("button", { name: "Pin Echo" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Echo", "Alpha", "Bravo", "▾ Research", "Gamma", "Delta"]);
        expect(await pinned(popup)).toEqual(["Echo"]);
        // Pinned: the pin shows, the age badge doesn't, and it's out of the Waiting filter.
        await expect(row(popup, "Echo").getByTitle(/Saved \d+ days ago/)).toHaveCount(0);
        await expect(popup.getByRole("button", { name: /^Waiting/ })).toHaveCount(0);
        await expect(row(popup, "Echo")).toContainText("Pinned"); // said to screen readers with the row
        await expect(popup.getByRole("status").filter({ hasText: "Pinned “Echo” to the top" })).toBeAttached();

        // A second pin goes below the first.
        await popup.getByRole("button", { name: "Pin Bravo" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Echo", "Bravo", "Alpha", "▾ Research", "Gamma", "Delta"]);

        await popup.getByRole("button", { name: "Unpin Echo" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Bravo", "Echo", "Alpha", "▾ Research", "Gamma", "Delta"]);
        await expect(popup.getByRole("button", { name: "Unpin Echo" })).toHaveCount(0);
        // (Back on the row: hidden only while the row is hovered or focused, under its buttons.)
        await expect(row(popup, "Echo").getByTitle("Saved 20 days ago")).toHaveCount(1);
    });

    test("TC-261: P pins and unpins the row the keyboard is on, which keeps the focus", async ({ popup }) => {
        await seed(popup);
        const bravo = tabList(popup).getByRole("button", { name: "Bravo", exact: true });
        await bravo.focus();
        await popup.keyboard.press("p");
        await expect.poll(() => rowTitles(popup)).toEqual(["Bravo", "Alpha", "▾ Research", "Gamma", "Delta", "Echo"]);
        await expect(bravo).toBeFocused();
        await popup.keyboard.press("P");
        await expect.poll(pinned.bind(null, popup)).toEqual([]);
    });

    test("TC-262: pinned tabs stay on top in every sort; inside a saved window, at its top", async ({ popup }) => {
        await seed(popup);
        await popup.getByRole("button", { name: "Pin Delta" }).click();
        await popup.getByRole("button", { name: "Pin Bravo" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Bravo", "Alpha", "▾ Research", "Delta", "Gamma", "Echo"]);
        await popup.getByRole("button", { name: /^Sort:/ }).click();
        await popup.getByRole("menuitemradio", { name: "Title (A–Z)" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Bravo", "Alpha", "▾ Research", "Delta", "Gamma", "Echo"]);
        // Filtered, windows aren't shown as one: every pinned tab is on top.
        await popup.getByRole("button", { name: "Uncategorized", exact: true }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Delta", "Gamma"]);
    });

    test("TC-263: Alt+arrows stop at the line between pinned tabs and the rest", async ({ popup }) => {
        await seed(popup);
        await popup.getByRole("button", { name: "Pin Echo" }).click();
        const alpha = tabList(popup).getByRole("button", { name: "Alpha", exact: true });
        await alpha.focus();
        await popup.keyboard.press("Alt+ArrowUp");
        await expect(popup.getByRole("status").filter({ hasText: "Pinned tabs stay above the others. Press P to pin this one." })).toBeAttached();
        await expect.poll(() => rowTitles(popup)).toEqual(["Echo", "Alpha", "Bravo", "▾ Research", "Gamma", "Delta"]);
        await expect(windowRow(popup, "Research")).toBeVisible();
    });
});
