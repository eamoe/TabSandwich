import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures";
import { openSettings, rowTitles, seedLibrary, storedTabs } from "./helpers";

const backupFile = (tabs: Array<{ title: string; url: string; category?: string }>, categories?: string[]) => ({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
        JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tabs, settings: categories ? { categories } : undefined })
    ),
});

test.describe("Export and import", () => {
    test.beforeEach(async ({ popup }) => {
        await seedLibrary(popup, [{ title: "Kept", url: "https://kept.example.com/", category: "Work" }]);
        await openSettings(popup, "Backup");
    });

    test("TC-130: export downloads a backup with everything saved", async ({ popup }) => {
        const download = popup.waitForEvent("download");
        await popup.getByRole("button", { name: "Export" }).click();
        const file = await download;
        expect(file.suggestedFilename()).toMatch(/^tab-sandwich-backup-\d{4}-\d{2}-\d{2}\.json$/);
        const content = JSON.parse(readFileSync(await file.path(), "utf8"));
        expect(content.tabs).toEqual([expect.objectContaining({ title: "Kept", url: "https://kept.example.com/" })]);
        await expect(popup.getByText("Exported 1 tab.")).toBeVisible();
    });

    test("TC-133: merge adds only what's new", async ({ popup }) => {
        await popup.locator("#import-file-input").setInputFiles(
            backupFile([
                { title: "Kept again", url: "https://kept.example.com" },
                { title: "New one", url: "https://new.example.com" },
            ])
        );
        await expect(popup.getByText("This file contains 2 tabs.", { exact: false })).toBeVisible();
        await popup.getByRole("button", { name: "Merge" }).click();
        await expect(popup.getByText("Imported 1 tab")).toBeVisible();
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(["New one", "Kept"]);
    });

    test("TC-138/TC-139: replace overwrites everything, and Undo brings it back", async ({ popup }) => {
        await popup.locator("#import-file-input").setInputFiles(backupFile([{ title: "Only this", url: "https://only.example.com" }]));
        await popup.getByRole("button", { name: "Replace all" }).click();
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Only this"]);

        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Kept"]);
        await popup.getByRole("button", { name: "Back", exact: true }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["Kept"]);
    });

    test("TC-140: a file that isn't a backup is rejected without changes", async ({ popup }) => {
        await popup.locator("#import-file-input").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from('{"hello":1}') });
        await expect(popup.getByText("That file doesn't look like a Tab Sandwich backup.")).toBeVisible();
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(["Kept"]);
    });
});
