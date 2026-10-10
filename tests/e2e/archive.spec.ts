import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { openSettings, rowTitles, seedLibrary, storedTabs, tabList, windowRow } from "./helpers";

/**
 * Alpha (Work), the saved window "Research" (Gamma, Delta, and Old notes: archived), Bravo
 * (Reading, 20 days: waiting), Zulu (Reading, 30 days, archived).
 */
async function seed(popup: Page) {
    await seedLibrary(
        popup,
        [
            { title: "Alpha", url: "https://alpha.example.com/", category: "Work" },
            { title: "Gamma", url: "https://gamma.example.com/", groupId: "g" },
            { title: "Old notes", url: "https://notes.example.com/", groupId: "g", archivedDaysAgo: 2 },
            { title: "Delta", url: "https://delta.example.com/", groupId: "g" },
            { title: "Bravo", url: "https://bravo.example.com/", category: "Reading", daysAgo: 20 },
            { title: "Zulu", url: "https://zulu.example.com/", category: "Reading", daysAgo: 30, archivedDaysAgo: 1 },
        ],
        {},
        { groups: [{ id: "g", name: "Research", collapsed: false }] }
    );
}

const search = (popup: Page) => popup.getByRole("textbox", { name: "Search saved tabs" });
const archivedFlags = async (popup: Page) => Object.fromEntries((await storedTabs(popup)).map((t) => [t.title, "archivedAt" in t]));

test.describe("Archive", () => {
    test("TC-264: archived tabs are out of the list, its counts, Waiting and search, and on their own pill", async ({ popup }) => {
        await seed(popup);
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "▾ Research", "Gamma", "Delta", "Bravo"]);
        await expect(popup.getByRole("button", { name: "All", exact: true })).toContainText("4");
        await expect(popup.getByRole("button", { name: "Reading", exact: true })).toContainText("1");
        await expect(popup.getByRole("button", { name: "Waiting (1)" })).toBeVisible();
        await expect(search(popup)).toHaveAttribute("placeholder", "Search 4 saved tabs");
        await expect(windowRow(popup, "Research")).toContainText("2 tabs");

        // Search leaves the archive out, and offers it when that's where the match is.
        await search(popup).fill("zulu");
        await expect(tabList(popup).getByRole("heading", { name: "No saved tabs match “zulu”" })).toBeVisible();
        await popup.getByRole("button", { name: "Search the archive" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Zulu"]);
        await expect(popup.getByRole("button", { name: "Archived (2)" })).toHaveAttribute("aria-pressed", "true");

        // On the Archived pill: the archive, searched as such; no age badges, no pinning, no moving.
        await search(popup).fill("");
        await expect.poll(() => rowTitles(popup)).toEqual(["Old notes", "Zulu"]);
        await expect(search(popup)).toHaveAttribute("placeholder", "Search 2 archived tabs");
        await expect(tabList(popup).getByTitle(/Saved \d+ days ago/)).toHaveCount(0);
        await tabList(popup).getByRole("button", { name: "Zulu", exact: true }).focus();
        await popup.keyboard.press("p");
        await popup.keyboard.press("Alt+ArrowUp");
        await expect(popup.getByRole("status").filter({ hasText: "Restore a tab to move it." })).toBeAttached();
        expect((await storedTabs(popup)).some((t) => (t as { pinned?: boolean }).pinned)).toBe(false);
    });

    test("TC-265: Restore puts a tab back exactly where it was, inside its saved window", async ({ popup }) => {
        await seed(popup);
        await popup.getByRole("button", { name: "Archived (2)" }).click();
        await popup.getByRole("button", { name: "Restore Old notes" }).click();
        await expect(popup.getByRole("status").filter({ hasText: "Restored" })).toBeVisible();
        await popup.getByRole("button", { name: "All", exact: true }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "▾ Research", "Gamma", "Old notes", "Delta", "Bravo"]);

        // Undo sends it back to the archive.
        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(archivedFlags.bind(null, popup)).toMatchObject({ "Old notes": true });
    });

    test("TC-266: in the archive, Delete deletes for good (with Undo); archiving the last tab leaves a way back", async ({ popup }) => {
        await seedLibrary(popup, [
            { title: "Alpha", url: "https://alpha.example.com/" },
            { title: "Zulu", url: "https://zulu.example.com/", archivedDaysAgo: 1 },
        ]);
        await popup.getByRole("button", { name: "Archived (1)" }).click();
        await tabList(popup).getByRole("button", { name: "Zulu", exact: true }).focus();
        await popup.keyboard.press("Delete");
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Alpha"]);
        // (The archive emptied, so the list is back on All; the toast's Undo brings Zulu back to it.)
        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Alpha", "Zulu"]);

        // Everything archived: not the first-run welcome, but the way to the archive.
        await popup.getByRole("button", { name: "All", exact: true }).click();
        await popup.getByRole("button", { name: "Archive Alpha" }).click();
        await expect(tabList(popup).getByRole("heading", { name: "Everything's in the archive" })).toBeVisible();
        await popup.getByRole("button", { name: "Show the archive" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Zulu"]);
    });

    test("TC-267: removing a category only archived tabs use says so; they become Uncategorized in the archive", async ({ popup }) => {
        await seedLibrary(popup, [
            { title: "Alpha", url: "https://alpha.example.com/", category: "Work" },
            { title: "Zulu", url: "https://zulu.example.com/", category: "Personal", archivedDaysAgo: 1 },
        ]);
        await openSettings(popup, "Categories");
        await expect(popup.getByRole("listitem").filter({ hasText: "Personal" })).toContainText("0 tabs");
        await popup.getByRole("button", { name: "Remove Personal" }).click();
        const ask = popup.getByRole("listitem").filter({ hasText: "Remove Personal?" });
        await expect(ask).toContainText("Its archived tab becomes Uncategorized");
        await ask.getByRole("button", { name: "Remove", exact: true }).click();
        await expect.poll(async () => "category" in (await storedTabs(popup)).find((t) => t.title === "Zulu")!).toBe(false);
        const zulu = (await storedTabs(popup)).find((t) => t.title === "Zulu")!;
        expect(zulu).not.toHaveProperty("category");
        expect(zulu).toHaveProperty("archivedAt");
    });

    test("TC-268: an archived page: the save card and the + form say so and offer Restore; Update brings it back too", async ({ context, popup }) => {
        const { openSiteTab } = await import("./helpers");
        const url = await openSiteTab(context, popup, "Example Article");
        const library = [
            { title: "Alpha", url: "https://alpha.example.com/" },
            { title: "Example Article", url, archivedDaysAgo: 3 },
        ];
        await seedLibrary(popup, library);
        const card = popup.getByRole("region", { name: "Current tab" });
        await expect(card).toContainText("In your archive");
        await card.getByRole("button", { name: "Restore", exact: true }).click();
        await expect(popup.getByRole("status").filter({ hasText: "Restored" })).toBeVisible();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Example Article"]);
        await expect(card).toContainText("Saved 0 days ago".replace("0 days ago", "today"));

        // Update on an archived copy brings it back as well (and Undo puts it back in the archive).
        await seedLibrary(popup, library);
        await card.getByRole("button", { name: "Update", exact: true }).click();
        await expect.poll(archivedFlags.bind(null, popup)).toMatchObject({ "Example Article": false });
        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(archivedFlags.bind(null, popup)).toMatchObject({ "Example Article": true });

        // The + form, given that link.
        await popup.getByRole("button", { name: "Add link manually" }).click();
        await popup.getByLabel("URL").fill(url);
        await popup.getByRole("button", { name: "Add", exact: true }).click();
        await expect(popup.getByRole("alert")).toHaveText("In your archive, as “Example Article”.");
        await popup.getByRole("button", { name: "Restore", exact: true }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Example Article"]);
    });

    test("TC-270: the Waiting filter archives every waiting tab at once, with one Undo", async ({ popup }) => {
        await seedLibrary(popup, [
            { title: "Alpha", url: "https://alpha.example.com/", category: "Work", daysAgo: 40 },
            { title: "Bravo", url: "https://bravo.example.com/", category: "Reading", daysAgo: 20 },
            { title: "Charlie", url: "https://charlie.example.com/", daysAgo: 10 },
            { title: "Delta", url: "https://delta.example.com/", category: "Reading" },
        ]);
        await popup.getByRole("button", { name: "Waiting (2)" }).click();
        await popup.getByRole("button", { name: "Archive all 2 waiting tabs" }).click();
        await expect(popup.getByText("Archived 2 tabs")).toBeVisible();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Delta"]);
        await expect(popup.getByRole("button", { name: "Archived (2)" })).toBeVisible();
        // Undo: they're back, and so is the Waiting filter you were on.
        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Bravo", "Charlie"]);
        await expect(popup.getByRole("button", { name: "Waiting (2)" })).toHaveAttribute("aria-pressed", "true");
    });
});
