import { test, expect } from "./fixtures";
import { row, rowTitles, seedLibrary, storedTabs } from "./helpers";

test.describe("Drag to reorder", () => {
    test.beforeEach(async ({ popup }) => {
        await seedLibrary(popup, [
            { title: "Alpha", url: "https://alpha.example.com/" },
            { title: "Bravo", url: "https://bravo.example.com/" },
            { title: "Charlie", url: "https://charlie.example.com/" },
        ]);
        await popup.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
    });

    test("TC-050: dragging a row by its handle onto another moves it there, and it stays", async ({ popup }) => {
        // Grab where the drag handle appears on hover: the icon at the row's left edge.
        await row(popup, "Charlie").dragTo(row(popup, "Alpha"), { sourcePosition: { x: 22, y: 23 } });
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Charlie", "Alpha", "Bravo"]);
        await expect.poll(() => rowTitles(popup)).toEqual(["Charlie", "Alpha", "Bravo"]);
    });

    test("TC-119: rows can't be dragged while searching", async ({ popup }) => {
        await popup.getByRole("textbox", { name: "Search saved tabs" }).fill("a");
        await expect(row(popup, "Alpha")).not.toHaveAttribute("draggable", "true");
        await popup.getByRole("button", { name: "Clear search" }).click();
        await expect(row(popup, "Alpha")).toHaveAttribute("draggable", "true");
    });
});
