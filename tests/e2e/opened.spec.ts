import { test, expect } from "./fixtures";
import { rowTitles, seedLibrary, storedTabs, tabList } from "./helpers";

type Counted = { title: string; lastOpenedAt?: number; openCount?: number };
const counts = async (popup: import("@playwright/test").Page) =>
    Object.fromEntries(((await storedTabs(popup)) as Counted[]).map((t) => [t.title, t.openCount ?? 0]));

test.describe("Last opened", () => {
    test("TC-274: opening a tab from the list counts, and the two new sorts use it", async ({ context, popup }) => {
        await seedLibrary(popup, [
            { title: "Alpha", url: "https://alpha.example.com/" },
            { title: "Bravo", url: "https://bravo.example.com/", openedDaysAgo: 3, openCount: 5 },
            { title: "Charlie", url: "https://charlie.example.com/", openedDaysAgo: 1 },
        ]);
        const opened = context.waitForEvent("page");
        await tabList(popup).getByRole("button", { name: "Alpha", exact: true }).click();
        await opened;
        await expect.poll(() => counts(popup)).toEqual({ Alpha: 1, Bravo: 5, Charlie: 1 });

        await popup.reload();
        await popup.getByRole("button", { name: /^Sort:/ }).click();
        await popup.getByRole("menuitemradio", { name: "Recently opened" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Charlie", "Bravo"]);
        await popup.getByRole("button", { name: /^Sort:/ }).click();
        await popup.getByRole("menuitemradio", { name: "Most opened" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Bravo", "Alpha", "Charlie"]);
    });

    test("TC-275: the cleanup tip offers to archive kept tabs untouched for six months, or to wait", async ({ popup }) => {
        const library = [
            { title: "Old wiki", url: "https://wiki.example.com/", category: "Work", daysAgo: 300 },
            { title: "Old dashboard", url: "https://dash.example.com/", category: "Work", daysAgo: 250, openedDaysAgo: 200 },
            { title: "Old account", url: "https://account.example.com/", category: "Personal", daysAgo: 400 },
            { title: "Used lately", url: "https://used.example.com/", category: "Work", daysAgo: 300, openedDaysAgo: 2 },
            { title: "Pinned", url: "https://pinned.example.com/", category: "Work", daysAgo: 300, pinned: true },
            { title: "Old article", url: "https://article.example.com/", category: "Reading", daysAgo: 300 },
        ];
        await seedLibrary(popup, library, {}, { trackingSinceDaysAgo: 365 });
        const tip = popup.getByRole("note", { name: "3 kept tabs not opened in 6 months" });
        await expect(tip).toBeVisible();
        await tip.getByRole("button", { name: "Archive them" }).click();
        await expect(popup.getByText("Archived 3 tabs")).toBeVisible();
        // Left: the one used lately, the pinned one (on top), and Reading's, which ages instead.
        await expect.poll(() => rowTitles(popup)).toEqual(["Pinned", "Used lately", "Old article"]);
        await expect(tip).toHaveCount(0);

        // Not now: gone, and still gone after reopening.
        await seedLibrary(popup, library, {}, { trackingSinceDaysAgo: 365 });
        await popup.getByRole("button", { name: "Not now" }).click();
        await expect(tip).toHaveCount(0);
        await popup.reload();
        await expect(popup.getByRole("button", { name: "All", exact: true })).toBeVisible();
        await expect(tip).toHaveCount(0);

        // Counting only began recently: no tip, whatever the tabs' age.
        await seedLibrary(popup, library);
        await expect(popup.getByRole("button", { name: "All", exact: true })).toBeVisible();
        await expect(tip).toHaveCount(0);
    });
});
