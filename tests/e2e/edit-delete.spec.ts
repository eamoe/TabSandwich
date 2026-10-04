import { test, expect } from "./fixtures";
import { row, rowTitles, seedLibrary, storedTabs, tabList } from "./helpers";

const library = [
    { title: "Alpha", url: "https://alpha.example.com/" },
    { title: "Bravo", url: "https://bravo.example.com/" },
    { title: "Charlie", url: "https://charlie.example.com/" },
];

test.describe("Editing and deleting", () => {
    test.beforeEach(async ({ popup }) => {
        await seedLibrary(popup, library);
    });

    test("TC-040: edit a tab's title and category", async ({ popup }) => {
        await popup.getByRole("button", { name: "Edit Bravo" }).click();
        await tabList(popup).getByLabel("Title", { exact: true }).fill("Bravo, renamed");
        await tabList(popup).getByLabel("Category", { exact: true }).selectOption("Work");
        await tabList(popup).getByRole("button", { name: "Save", exact: true }).click();

        await expect(row(popup, "Bravo, renamed")).toBeVisible();
        await expect(tabList(popup).getByLabel("Title", { exact: true })).toHaveCount(0);
        await expect.poll(() => storedTabs(popup)).toContainEqual(expect.objectContaining({ title: "Bravo, renamed", category: "Work" }));
    });

    test("TC-041: an invalid URL keeps the row in edit mode", async ({ popup }) => {
        await popup.getByRole("button", { name: "Edit Bravo" }).click();
        await tabList(popup).getByLabel("URL", { exact: true }).fill("not a url");
        await tabList(popup).getByRole("button", { name: "Save", exact: true }).click();
        await expect(popup.getByRole("alert")).toHaveText("Enter a valid URL.");
        await expect(tabList(popup).getByLabel("URL", { exact: true })).toBeFocused();
    });

    test("TC-183: changing a URL to one that's already saved is refused, keeping what you typed", async ({ popup }) => {
        await popup.getByRole("button", { name: "Edit Bravo" }).click();
        await tabList(popup).getByLabel("Title", { exact: true }).fill("Typed title");
        await tabList(popup).getByLabel("URL", { exact: true }).fill("https://alpha.example.com");
        await tabList(popup).getByRole("button", { name: "Save", exact: true }).click();

        await expect(popup.getByRole("alert")).toHaveText("Already saved as “Alpha”.");
        await expect(tabList(popup).getByLabel("Title", { exact: true })).toHaveValue("Typed title");
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(["Alpha", "Bravo", "Charlie"]);
    });

    test("TC-042: Cancel discards edits", async ({ popup }) => {
        await popup.getByRole("button", { name: "Edit Bravo" }).click();
        await tabList(popup).getByLabel("Title", { exact: true }).fill("Changed");
        await tabList(popup).getByRole("button", { name: "Cancel" }).click();
        await expect(row(popup, "Bravo")).toBeVisible();
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(["Alpha", "Bravo", "Charlie"]);
    });

    test("TC-043/TC-044: delete, then Undo puts the tab back in the same place", async ({ popup }) => {
        await popup.getByRole("button", { name: "Delete Bravo" }).click();
        await expect(row(popup, "Bravo")).toHaveCount(0);
        await expect(popup.getByRole("status").filter({ hasText: "Deleted" })).toBeVisible();
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(["Alpha", "Charlie"]);

        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Bravo", "Charlie"]);
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(["Alpha", "Bravo", "Charlie"]);
    });
});
