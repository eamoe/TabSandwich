import { test, expect, TEST_SITE } from "./fixtures";
import { answerPermissionPrompt, openSiteTab, openTabUrls, promptsShown, rowTitles, seedLibrary, storedTabs } from "./helpers";

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
});
