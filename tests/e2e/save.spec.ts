import { test, expect } from "./fixtures";
import { openSiteTab, row, seedLibrary, storedTabs, tabList } from "./helpers";

test.describe("Saving tabs", () => {
    test("TC-001: Save Tab saves the page you're on", async ({ context, popup }) => {
        const url = await openSiteTab(context, popup, "Example Article");
        await popup.getByRole("button", { name: "Save Tab" }).click();

        await expect(popup.getByRole("button", { name: "Saved!" })).toBeVisible();
        await expect(row(popup, "Example Article")).toBeVisible();
        await expect(row(popup, "Example Article").getByTestId("favicon")).toBeVisible();
        expect(await storedTabs(popup)).toEqual([expect.objectContaining({ title: "Example Article", url })]);
        await expect(popup.getByRole("textbox", { name: "Search saved tabs" })).toHaveAttribute("placeholder", "Search 1 saved tab");
    });

    test("TC-187: the save card shows the page you're on before you save", async ({ context, popup }) => {
        await openSiteTab(context, popup, "Example Article");
        const card = popup.getByRole("region", { name: "Current tab" });
        await expect(card).toContainText("Example Article");
        await expect(card).toContainText("example.test");
    });

    test("TC-188: saving straight into a category needs no editing afterwards", async ({ context, popup }) => {
        await openSiteTab(context, popup, "Example Article");
        await popup.getByLabel("Save to category").selectOption("Reading");
        await popup.getByRole("button", { name: "Save Tab" }).click();
        await expect(popup.getByRole("button", { name: "Saved!" })).toBeVisible();
        expect(await storedTabs(popup)).toEqual([expect.objectContaining({ title: "Example Article", category: "Reading" })]);
        await expect(row(popup, "Example Article")).toContainText("Reading");
    });

    test("TC-010: saving the same page twice keeps one copy", async ({ context, popup }) => {
        await openSiteTab(context, popup, "Example Article");
        const save = popup.locator("#save-btn");
        await save.click();
        await expect(save).toHaveText("Saved!");
        await expect(save).toHaveText("Save");
        await save.click();
        await expect(save).toHaveText("Already saved");
        expect(await storedTabs(popup)).toHaveLength(1);
    });

    test("TC-005: browser pages can't be saved", async ({ popup }) => {
        // The active tab is the popup page itself — a chrome-extension:// page, like chrome://settings.
        const card = popup.getByRole("region", { name: "Current tab" });
        await expect(card).toContainText("Only web pages can be saved");
        await expect(popup.getByRole("button", { name: "Save Tab" })).toBeDisabled();
        expect(await storedTabs(popup)).toEqual([]);
    });

    test("TC-002/TC-003: add a link manually with a title and category", async ({ popup }) => {
        await popup.getByRole("button", { name: "Add link manually" }).click();
        await popup.getByLabel("URL").fill("docs.example.com/guide");
        await popup.getByLabel("Title (optional)").fill("The Guide");
        await popup.getByLabel("Category (optional)").selectOption("Reading");
        await popup.getByRole("button", { name: "Add", exact: true }).click();

        await expect(row(popup, "The Guide")).toBeVisible();
        expect(await storedTabs(popup)).toEqual([
            expect.objectContaining({ title: "The Guide", url: "https://docs.example.com/guide", category: "Reading" }),
        ]);
        await expect(popup.getByRole("button", { name: "Add link manually" })).toHaveAttribute("aria-expanded", "false");
    });

    test("TC-002: a manual link with only a URL is titled after its site", async ({ popup }) => {
        await popup.getByRole("button", { name: "Add link manually" }).click();
        await popup.getByLabel("URL").fill("example.com");
        await popup.getByRole("button", { name: "Add", exact: true }).click();
        await expect(row(popup, "example.com")).toBeVisible();
        expect(await storedTabs(popup)).toEqual([expect.objectContaining({ title: "example.com", url: "https://example.com/" })]);
    });

    test("TC-004: Cancel closes manual entry, saves nothing, and clears the fields", async ({ popup }) => {
        const toggle = popup.getByRole("button", { name: "Add link manually" });
        await toggle.click();
        await popup.getByLabel("URL").fill("example.com");
        await popup.getByRole("button", { name: "Cancel" }).click();
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(await storedTabs(popup)).toEqual([]);
        await toggle.click();
        await expect(popup.getByLabel("URL")).toHaveValue("");
    });

    test("TC-006: a manual URL that isn't a web address is rejected", async ({ popup }) => {
        await popup.getByRole("button", { name: "Add link manually" }).click();
        await popup.getByLabel("URL").fill("weuirytuiwerytweury");
        await popup.getByRole("button", { name: "Add", exact: true }).click();
        await expect(popup.getByRole("alert")).toHaveText("Enter a valid URL");
        expect(await storedTabs(popup)).toEqual([]);
    });

    test("TC-012: adding an already-saved link manually keeps one copy", async ({ popup }) => {
        await seedLibrary(popup, [{ title: "Existing", url: "https://a.example.com/" }]);
        await popup.getByRole("button", { name: "Add link manually" }).click();
        await popup.getByLabel("URL").fill("https://a.example.com");
        await popup.getByRole("button", { name: "Add", exact: true }).click();
        await expect(popup.getByRole("alert")).toHaveText("Already saved as “Existing”.");
        await expect(tabList(popup).getByRole("listitem")).toHaveCount(1);
    });
});
