import { test, expect } from "./fixtures";
import { manualEntryCategories, openSettings, seedLibrary, storedSettings, storedTabs } from "./helpers";

test.describe("Categories in Settings", () => {
    test.beforeEach(async ({ popup }) => {
        await seedLibrary(popup, [{ title: "Q3 Roadmap", url: "https://notion.so/q3", category: "Work" }]);
        await openSettings(popup, "Categories");
    });

    const categoryList = (popup: import("@playwright/test").Page) => popup.getByRole("list", { name: "Configured categories" });

    test("TC-032: add a category", async ({ popup }) => {
        await popup.getByLabel("New category").fill("Travel");
        await popup.getByRole("button", { name: "Add", exact: true }).click();
        await expect(categoryList(popup).locator("li").first()).toContainText("Travel");
        expect((await storedSettings(popup)).categories[0]).toBe("Travel");
        await popup.getByRole("button", { name: "Back", exact: true }).click();
        expect(await manualEntryCategories(popup)).toEqual(["Uncategorized", "Travel", "Work", "Personal", "Reading", "Entertainment"]);
        await popup.getByRole("button", { name: "Edit Q3 Roadmap" }).click();
        await expect(popup.getByRole("list", { name: "Saved tabs" }).getByLabel("Category", { exact: true }).locator("option", { hasText: "Travel" })).toHaveCount(1);
    });

    test("TC-150: renaming a category renames it on every tab", async ({ popup }) => {
        await popup.getByRole("button", { name: "Rename Work" }).click();
        const input = popup.getByRole("textbox", { name: "Rename Work" });
        await input.fill("Job");
        await input.press("Enter");
        await expect(categoryList(popup)).toContainText("Job");
        await expect.poll(async () => (await storedTabs(popup))[0].category).toBe("Job");
    });

    for (const [label, newName, message] of [
        ["TC-151: an existing name", "Personal", "That name is already used by another category."],
        ["TC-152: an empty name", "", "Name can't be empty."],
        ["TC-153: the reserved name", "Uncategorized", "That name is already used by another category."],
    ]) {
        test(`${label} is refused with a message on the card`, async ({ popup }) => {
            await popup.getByRole("button", { name: "Rename Work" }).click();
            const input = popup.getByRole("textbox", { name: "Rename Work" });
            await input.fill(newName);
            await input.press("Enter");
            await expect(categoryList(popup).locator("li").first()).toContainText(message);
            await expect(categoryList(popup).locator("li").first()).toContainText("Work");
            expect((await storedSettings(popup)).categories[0]).toBe("Work");
        });
    }

    test("TC-035: a category in use can't be removed", async ({ popup }) => {
        await popup.getByRole("button", { name: "Remove Work" }).click();
        await expect(categoryList(popup)).toContainText("In use — reassign its tabs first.");
        expect((await storedSettings(popup)).categories).toContain("Work");
    });

    test("TC-034: an unused category can be removed", async ({ popup }) => {
        await popup.getByRole("button", { name: "Remove Entertainment" }).click();
        await expect(categoryList(popup)).not.toContainText("Entertainment");
        expect((await storedSettings(popup)).categories).not.toContain("Entertainment");
        await popup.getByRole("button", { name: "Back", exact: true }).click();
        expect(await manualEntryCategories(popup)).not.toContain("Entertainment");
    });

    test("TC-156/TC-157: move a category up; the first one can't move further up", async ({ popup }) => {
        await expect(popup.getByRole("button", { name: "Move Work up" })).toBeDisabled();
        await popup.getByRole("button", { name: "Move Personal up" }).click();
        await expect.poll(async () => (await storedSettings(popup)).categories).toEqual(["Personal", "Work", "Reading", "Entertainment"]);
        await expect(popup.getByRole("button", { name: "Move Entertainment down" })).toBeDisabled();
        await popup.getByRole("button", { name: "Back", exact: true }).click();
        expect(await manualEntryCategories(popup)).toEqual(["Uncategorized", "Personal", "Work", "Reading", "Entertainment"]);
    });

    test("TC-159: dragging a category by its handle moves it there", async ({ popup }) => {
        await categoryList(popup).getByRole("listitem").filter({ hasText: "Entertainment" }).dragTo(
            categoryList(popup).getByRole("listitem").filter({ hasText: "Work" }),
            { sourcePosition: { x: 10, y: 22 } }
        );
        await expect.poll(async () => (await storedSettings(popup)).categories).toEqual(["Entertainment", "Work", "Personal", "Reading"]);
    });
});
