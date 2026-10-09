import { test, expect } from "./fixtures";
import { openSiteTab, row, rowTitles, seedLibrary, storedTabs, tabList } from "./helpers";

const noteOf = async (popup: import("@playwright/test").Page, title: string) =>
    ((await storedTabs(popup)).find((t) => t.title === title) as { note?: string } | undefined)?.note;

test.describe("Notes", () => {
    test("TC-271: Add a note on the save card saves it with the page, shown under the row", async ({ context, popup }) => {
        await openSiteTab(context, popup, "Example Article");
        await seedLibrary(popup, [{ title: "Alpha", url: "https://alpha.example.com/" }]);
        const card = popup.getByRole("region", { name: "Current tab" });
        await card.getByRole("button", { name: "Add a note" }).click();
        const note = card.getByRole("textbox", { name: "Note" });
        await expect(note).toBeFocused();
        await note.fill("read before the API review");
        await note.press("Enter");
        await expect.poll(() => rowTitles(popup)).toEqual(["Example Article", "Alpha"]);
        expect(await noteOf(popup, "Example Article")).toBe("read before the API review");
        await expect(row(popup, "Example Article")).toContainText("read before the API review");
        // Saved: the note field is put away, and Add a note doesn't show on a saved page.
        await expect(card.getByRole("textbox", { name: "Note" })).toHaveCount(0);
        await expect(card.getByRole("button", { name: "Add a note" })).toHaveCount(0);

        // Escape puts an opened note away without saving anything.
        await seedLibrary(popup, []);
        await card.getByRole("button", { name: "Add a note" }).click();
        await card.getByRole("textbox", { name: "Note" }).press("Escape");
        await expect(card.getByRole("textbox", { name: "Note" })).toHaveCount(0);
        expect(await storedTabs(popup)).toEqual([]);
    });

    test("TC-272: the edit form writes, changes and clears a note; the + form takes one", async ({ popup }) => {
        await seedLibrary(popup, [{ title: "Alpha", url: "https://alpha.example.com/" }]);
        await popup.getByRole("button", { name: "Edit Alpha" }).click();
        await tabList(popup).getByRole("textbox", { name: "Note" }).fill("the onboarding checklist");
        await tabList(popup).getByRole("button", { name: "Save", exact: true }).click();
        await expect(row(popup, "Alpha")).toContainText("the onboarding checklist");
        await popup.getByRole("button", { name: "Edit Alpha" }).click();
        await expect(tabList(popup).getByRole("textbox", { name: "Note" })).toHaveValue("the onboarding checklist");
        await tabList(popup).getByRole("textbox", { name: "Note" }).fill("");
        await tabList(popup).getByRole("button", { name: "Save", exact: true }).click();
        await expect.poll(() => noteOf(popup, "Alpha")).toBeUndefined();

        await popup.getByRole("button", { name: "Add link manually" }).click();
        await popup.getByLabel("URL").fill("https://bravo.example.com/");
        await popup.getByRole("textbox", { name: "Note" }).fill("pricing page for the deck");
        await popup.getByRole("button", { name: "Add", exact: true }).click();
        await expect.poll(() => noteOf(popup, "bravo.example.com")).toBe("pricing page for the deck");
    });

    test("TC-273: search finds a tab by its note, highlighting the words there", async ({ popup }) => {
        await seedLibrary(popup, [
            { title: "API reference", url: "https://docs.example.com/api", note: "auth endpoints for the mobile app" },
            { title: "Weather", url: "https://weather.example.com/" },
        ]);
        await popup.getByRole("textbox", { name: "Search saved tabs" }).fill("mobile");
        await expect.poll(() => rowTitles(popup)).toEqual(["API reference"]);
        await expect(row(popup, "API reference").locator("mark")).toHaveText(["mobile"]);
    });
});
