import { test, expect } from "./fixtures";
import { openSiteTab, row, rowTitles, seedLibrary, storedTabs } from "./helpers";

const card = (popup: import("@playwright/test").Page) => popup.getByRole("region", { name: "Current tab" });

test.describe("A page that's already saved", () => {
    let url = "";
    test.beforeEach(async ({ context, popup }) => {
        url = await openSiteTab(context, popup, "Example Article");
        // Saved 20 days ago under an old title, in Reading, with your own order around it.
        await seedLibrary(
            popup,
            [
                { title: "First", url: "https://first.example.com/", category: "Work" },
                { title: "Old title", url: `${url}/`, category: "Reading", daysAgo: 20 },
                { title: "Last", url: "https://last.example.com/", category: "Work" },
            ],
            { categories: ["Work", "Reading"] }
        );
    });

    test("TC-215: the card says so as soon as the popup opens, with its category picked", async ({ popup }) => {
        await expect(card(popup)).toContainText("Saved 20 days ago");
        await expect(card(popup)).toContainText("example.test");
        await expect(popup.getByLabel("Saved in category")).toHaveValue("Reading");
        await expect(card(popup).getByRole("button", { name: "Show" })).toBeVisible();
        await expect(card(popup).getByRole("button", { name: "Update" })).toBeVisible();
        await expect(card(popup).locator("#save-btn")).toHaveCount(0);
    });

    test("TC-216: Show brings the saved row into view, widening a filter that hides it", async ({ popup }) => {
        await popup.getByRole("button", { name: "Work", exact: true }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["First", "Last"]);
        await card(popup).getByRole("button", { name: "Show" }).click();
        await expect(popup.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
        await expect(row(popup, "Old title")).toBeInViewport();
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(["First", "Old title", "Last"]);
    });

    test("TC-217: Update brings the saved copy up to date with the page, in place, and Undo puts it back", async ({ popup }) => {
        const before = Date.now();
        await popup.getByLabel("Saved in category").selectOption("Work");
        await card(popup).getByRole("button", { name: "Update" }).click();
        await expect(card(popup).getByRole("button", { name: "Updated!" })).toBeVisible();
        await expect(card(popup)).toContainText("Saved today");
        const [, updated] = await popup.evaluate(async () => (await chrome.storage.local.get("tabSandwich.tabs"))["tabSandwich.tabs"]);
        expect(updated).toMatchObject({ title: "Example Article", url, category: "Work" });
        expect(updated.savedAt).toBeGreaterThanOrEqual(before);
        // Same place in your own order; the moon badge is gone.
        await expect.poll(() => rowTitles(popup)).toEqual(["First", "Example Article", "Last"]);
        await expect(row(popup, "Example Article").getByTitle(/Saved \\d+ days ago/)).toHaveCount(0);

        await popup.getByRole("button", { name: "Undo" }).click();
        await expect.poll(() => rowTitles(popup)).toEqual(["First", "Old title", "Last"]);
        const [, restored] = await storedTabs(popup);
        expect(restored).toMatchObject({ title: "Old title", url: `${url}/`, category: "Reading" });
        await expect(card(popup)).toContainText("Saved 20 days ago");
    });

    test("TC-217: Update keeps the category when the picker wasn't touched", async ({ popup }) => {
        await card(popup).getByRole("button", { name: "Update" }).click();
        await expect(card(popup)).toContainText("Saved today");
        expect((await storedTabs(popup))[1]).toMatchObject({ title: "Example Article", category: "Reading" });
    });
});
