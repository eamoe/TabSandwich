import { test, expect, TEST_SITE } from "./fixtures";
import { answerPermissionPrompt, openSiteTab, openTabUrls, promptsShown, rowTitles, seedLibrary, storedTabs } from "./helpers";

const storedArchived = (popup: import("@playwright/test").Page) =>
    popup.evaluate(async () => ((await chrome.storage.local.get("tabSandwich.tabs"))["tabSandwich.tabs"] as Array<{ title: string; archivedAt?: number }>).filter((t) => t.archivedAt).map((t) => t.title));

const card = (popup: import("@playwright/test").Page) => popup.getByRole("region", { name: "Current tab" });

test.describe("Saving a whole window", () => {
    test("TC-229: Save all tabs saves every new page in the window, after asking once", async ({ context, popup }) => {
        await seedLibrary(popup, [{ title: "Saved Before", url: `${TEST_SITE}/Saved%20Before` }]);
        await answerPermissionPrompt(context, popup, "grant");
        await openSiteTab(context, popup, "Alpha");
        await openSiteTab(context, popup, "Saved Before");
        await openSiteTab(context, popup, "Beta");
        await popup.getByLabel("Save to category").selectOption("Reading");

        // Before the permission, only the number of open tabs is known.
        await card(popup).getByRole("button", { name: /^Save all \d+ tabs in this window$/ }).click();

        await expect(card(popup).getByRole("status").filter({ hasText: "Saved 2 tabs" })).toContainText(/\d+ skipped \(1 already saved, \d+ browser pages?\)/);
        expect(await promptsShown(popup)).toBe(1);
        const stored = await storedTabs(popup);
        expect(stored.slice(0, 2)).toEqual([
            expect.objectContaining({ title: "Alpha", url: `${TEST_SITE}/Alpha`, category: "Reading" }),
            expect.objectContaining({ title: "Beta", url: `${TEST_SITE}/Beta`, category: "Reading" }),
        ]);
        expect(stored).toHaveLength(3);
        // Together as one saved window, closed, at the top.
        const titles = await rowTitles(popup);
        expect(titles).toHaveLength(2);
        expect(titles[0]).toMatch(/^▸ [A-Z][a-z]+ [A-Z][a-z]+$/);
        expect(titles[1]).toBe("Saved Before");
        await expect(popup.locator("[data-hops]")).toHaveAttribute("data-hops", "1");
    });

    test("TC-230: Close closes the saved tabs, keeps the one you're on and anything not saved", async ({ context, popup }) => {
        await answerPermissionPrompt(context, popup, "grant");
        await openSiteTab(context, popup, "Alpha");
        await openSiteTab(context, popup, "Beta");
        await openSiteTab(context, popup, "Gamma");
        await card(popup).getByRole("button", { name: /^Save all \d+ tabs in this window$/ }).click();
        await expect(card(popup).getByRole("status").filter({ hasText: "Saved 3 tabs" })).toBeVisible();
        // Nothing closes until asked.
        expect(await openTabUrls(popup)).toEqual(expect.arrayContaining([`${TEST_SITE}/Alpha`, `${TEST_SITE}/Beta`, `${TEST_SITE}/Gamma`]));

        await card(popup).getByRole("button", { name: "Close 2 tabs" }).click();

        await expect(card(popup).getByRole("status").filter({ hasText: "Closed 2 tabs" })).toBeVisible();
        const open = await openTabUrls(popup);
        expect(open).not.toContain(`${TEST_SITE}/Alpha`);
        expect(open).not.toContain(`${TEST_SITE}/Beta`);
        expect(open).toContain(`${TEST_SITE}/Gamma`);
        expect(popup.isClosed()).toBe(false);
        expect(await storedTabs(popup)).toHaveLength(3);
    });

    test("TC-229: started from an already-saved page, each of the window's pages goes where it's suggested (none: Uncategorized)", async ({ context, popup }) => {
        // The saved page's category says nothing about the rest; here no page has a suggestion either.
        await seedLibrary(popup, [{ title: "Saved Before", url: `${TEST_SITE}/Saved%20Before` }]);
        await answerPermissionPrompt(context, popup, "grant");
        await openSiteTab(context, popup, "Alpha");
        await openSiteTab(context, popup, "Saved Before");
        await popup.getByLabel("Saved in category").selectOption("Work");
        await card(popup).getByRole("button", { name: /^Save all \d+ tabs in this window$/ }).click();
        await expect(card(popup).getByRole("status").filter({ hasText: "Saved 1 tab" })).toBeVisible();
        const [alpha] = await storedTabs(popup);
        expect(alpha.title).toBe("Alpha");
        expect(alpha.category).toBeUndefined();
    });

    test("TC-231: saying no saves nothing, and everything else still works", async ({ context, popup }) => {
        await answerPermissionPrompt(context, popup, "deny");
        await openSiteTab(context, popup, "Alpha");
        await openSiteTab(context, popup, "Beta");
        await card(popup).getByRole("button", { name: /^Save all \d+ tabs in this window$/ }).click();

        await expect(card(popup).getByRole("alert")).toHaveText("Nothing saved. Saving a window needs your OK to see its tabs.");
        expect(await storedTabs(popup)).toEqual([]);
        await expect(card(popup).getByRole("button", { name: "Try again" })).toBeVisible();

        await card(popup).getByRole("button", { name: "Save Tab" }).click();
        await expect(card(popup).getByRole("button", { name: "Saved!" })).toBeVisible();
        expect(await storedTabs(popup)).toEqual([expect.objectContaining({ title: "Beta" })]);
    });

    test("TC-232: once allowed, the line counts only new pages and hides when there are none", async ({ context, popup }) => {
        await seedLibrary(popup, [{ title: "Alpha", url: `${TEST_SITE}/Alpha` }]);
        await answerPermissionPrompt(context, popup, "grant");
        await openSiteTab(context, popup, "Alpha");
        await openSiteTab(context, popup, "Beta");
        await card(popup).getByRole("button", { name: /^Save all \d+ tabs in this window$/ }).click();
        await expect(card(popup).getByRole("status").filter({ hasText: "Saved 1 tab" })).toBeVisible();

        // Opened again: no second question, and the line knows exactly what's new.
        await popup.reload();
        await openSiteTab(context, popup, "Gamma");
        await expect(card(popup).getByRole("button", { name: "Save 1 new tab from this window" })).toBeVisible();
        await card(popup).getByRole("button", { name: "Save 1 new tab from this window" }).click();
        await expect(card(popup).getByRole("status").filter({ hasText: "Saved 1 tab" })).toBeVisible();
        expect(await promptsShown(popup)).toBe(1);

        await popup.reload();
        await expect(card(popup).getByRole("button", { name: /from this window|in this window/ })).toHaveCount(0);
    });

    test("TC-334: when the window's pages are in the archive, the line says so and Restore brings them back, with Undo", async ({ context, popup }) => {
        // A saved window, archived whole, and one page still in the list.
        await seedLibrary(
            popup,
            [
                { title: "Alpha", url: `${TEST_SITE}/Alpha`, groupId: "g", archivedDaysAgo: 1 },
                { title: "Beta", url: `${TEST_SITE}/Beta`, groupId: "g", archivedDaysAgo: 1 },
                { title: "Gamma", url: `${TEST_SITE}/Gamma` },
            ],
            {},
            { groups: [{ id: "g", name: "Research" }] }
        );
        await answerPermissionPrompt(context, popup, "grant");
        await openSiteTab(context, popup, "Alpha");
        await openSiteTab(context, popup, "Beta");
        await openSiteTab(context, popup, "Gamma");

        // Before the permission, the line can only count open tabs; saving finds nothing new, says
        // the pages are in the archive, and offers them back.
        await card(popup).getByRole("button", { name: /^Save all \d+ tabs in this window$/ }).click();
        await expect(card(popup).getByRole("status").filter({ hasText: "Nothing new to save" })).toContainText(/\(1 already saved, 2 in your archive, \d+ browser pages?\)/);
        await card(popup).getByRole("button", { name: "Restore" }).click();

        // Back in the list as the saved window they were archived from, and the line says so.
        await expect(card(popup).getByRole("status").filter({ hasText: "Restored 2 tabs" })).toBeVisible();
        // (opened, to show where they landed).
        await expect.poll(() => rowTitles(popup)).toEqual(["▾ Research", "Alpha", "Beta", "Gamma"]);
        expect(await storedArchived(popup)).toEqual([]);

        // Undo puts them back in the archive.
        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(() => storedArchived(popup)).toEqual(["Alpha", "Beta"]);
        await expect.poll(() => rowTitles(popup)).toEqual(["Gamma"]);

        // Opened again, with the permission now known: the line says so straight away, and offers no save.
        await popup.reload();
        await expect(card(popup)).toContainText("2 open tabs are in your archive");
        await expect(card(popup).getByRole("button", { name: /from this window|in this window/ })).toHaveCount(0);
        await card(popup).getByRole("button", { name: "Restore" }).click();
        await expect(card(popup).getByRole("status").filter({ hasText: "Restored 2 tabs" })).toBeVisible();
        await expect.poll(() => storedArchived(popup)).toEqual([]);
    });

    test("TC-334: with new pages too, the line saves those, and the note counts the archived ones apart", async ({ context, popup }) => {
        await seedLibrary(popup, [
            { title: "Alpha", url: `${TEST_SITE}/Alpha`, archivedDaysAgo: 1 },
            { title: "Gamma", url: `${TEST_SITE}/Gamma` },
        ]);
        await answerPermissionPrompt(context, popup, "grant");
        await openSiteTab(context, popup, "Alpha");
        await openSiteTab(context, popup, "Beta");
        await openSiteTab(context, popup, "Gamma");
        await card(popup).getByRole("button", { name: /^Save all \d+ tabs in this window$/ }).click();
        await expect(card(popup).getByRole("status").filter({ hasText: "Saved 1 tab" })).toContainText(/\d+ skipped \(1 already saved, 1 in your archive, \d+ browser pages?\)/);
        // Something was saved, so the line offers to close the tabs, not to restore.
        await expect(card(popup).getByRole("button", { name: "Restore" })).toHaveCount(0);
        expect(await storedArchived(popup)).toEqual(["Alpha"]);
    });
});
