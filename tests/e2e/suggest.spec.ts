import { test, expect, TEST_SITE } from "./fixtures";
import { answerPermissionPrompt, openSiteTab, seedLibrary, storedTabs } from "./helpers";

const card = (popup: import("@playwright/test").Page) => popup.getByRole("region", { name: "Current tab" });
const categoryOf = async (popup: import("@playwright/test").Page, title: string) => (await storedTabs(popup)).find((t) => t.title === title)?.category;

test.describe("Category suggestions", () => {
    test("TC-276: the save card starts where pages from this site went, marked as a suggestion", async ({ context, popup }) => {
        await openSiteTab(context, popup, "Example Article");
        await seedLibrary(popup, [
            { title: "Older page", url: `${TEST_SITE}/Older`, category: "Work" },
            { title: "Elsewhere", url: "https://elsewhere.example.com/", category: "Reading" },
        ]);
        const picker = popup.getByLabel("Save to category (suggested from where you saved pages like it)");
        await expect(picker).toHaveValue("Work");
        await card(popup).getByRole("button", { name: "Save tab" }).click();
        await expect.poll(() => categoryOf(popup, "Example Article")).toBe("Work");

        // Picking yourself: no longer a suggestion, and that's what's saved.
        await seedLibrary(popup, [{ title: "Older page", url: `${TEST_SITE}/Older`, category: "Work" }]);
        await picker.selectOption("Personal");
        await expect(popup.getByLabel("Save to category", { exact: true })).toHaveValue("Personal");
        await card(popup).getByRole("button", { name: "Save tab" }).click();
        await expect.poll(() => categoryOf(popup, "Example Article")).toBe("Personal");
    });

    test("TC-277: a whole window: each page to its suggestion unless you pick one for all", async ({ context, popup }) => {
        await seedLibrary(popup, [{ title: "Older page", url: `${TEST_SITE}/Older`, category: "Work" }]);
        await answerPermissionPrompt(context, popup, "grant");
        await openSiteTab(context, popup, "Alpha");
        await openSiteTab(context, popup, "Beta");
        await card(popup).getByRole("button", { name: /^Save all \d+ tabs in this window$/ }).click();
        await expect(card(popup).getByRole("status").filter({ hasText: "Saved 2 tabs" })).toBeVisible();
        expect([await categoryOf(popup, "Alpha"), await categoryOf(popup, "Beta")]).toEqual(["Work", "Work"]);
    });

    test("TC-278: the + form suggests once a link is typed, until you pick yourself", async ({ popup }) => {
        await seedLibrary(popup, [{ title: "Repo", url: "https://github.com/eamoe/projx", category: "Work" }]);
        await popup.getByRole("button", { name: "Add link manually" }).click();
        await popup.getByLabel("URL").fill("https://github.com/eamoe/projx/issues");
        await popup.getByLabel("URL").press("Tab");
        await expect(popup.getByLabel("Category (optional) (suggested from where you saved pages like it)")).toHaveValue("Work");
        await popup.getByRole("button", { name: "Add", exact: true }).click();
        await expect.poll(() => categoryOf(popup, "github.com")).toBe("Work");
    });
});
