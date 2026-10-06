import type { Page } from "@playwright/test";
import { test, expect, TEST_SITE } from "./fixtures";
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

    test("TC-010/TC-218: after saving, the card says the page is saved instead of offering Save again", async ({ context, popup }) => {
        await openSiteTab(context, popup, "Example Article");
        const card = popup.getByRole("region", { name: "Current tab" });
        await card.getByRole("button", { name: "Save Tab" }).click();
        // "Saved!" gets its moment first, then the card settles into its saved look.
        await expect(card.getByRole("button", { name: "Saved!" })).toBeVisible();
        await expect(card).toContainText("Saved today");
        await expect(card.getByRole("button", { name: "Update" })).toBeVisible();
        await expect(card.locator("#save-btn")).toHaveCount(0);
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

    test("TC-219: an already-saved link typed by hand can be opened from the message", async ({ popup }) => {
        await seedLibrary(popup, [{ title: "Existing", url: `${TEST_SITE}/Existing` }]);
        await popup.getByRole("button", { name: "Add link manually" }).click();
        await popup.getByLabel("URL").fill(`${TEST_SITE}/Existing/`);
        await popup.getByRole("button", { name: "Add", exact: true }).click();
        await popup.getByRole("button", { name: "Open", exact: true }).click();
        // A new tab for the saved link, exactly as saved. Asked of Chrome rather than the page:
        // the fake site (the one address the test extension may see) doesn't serve a tab's very
        // first load when the extension opens it.
        await expect
            .poll(() => popup.evaluate(async () => (await chrome.tabs.query({})).map((t) => t.pendingUrl || t.url)))
            .toContain(`${TEST_SITE}/Existing`);
        // Typing again clears the message and its Open.
        await popup.getByLabel("URL").fill("https://b.example.com");
        await expect(popup.getByRole("button", { name: "Open", exact: true })).toHaveCount(0);
    });
    test.describe("TC-228: the logo hops on a new save", () => {
        // The logo is decorative (hidden from screen readers), so there's no role to find it by.
        const logo = (popup: Page) => popup.locator("[data-hops]");
        const animation = (popup: Page) => logo(popup).evaluate((el) => getComputedStyle(el).animationName);

        test("saving the page you're on and adding a link by hand each make it hop", async ({ context, popup }) => {
            await openSiteTab(context, popup, "Example Article");
            await expect(logo(popup)).toHaveAttribute("data-hops", "0");
            expect(await animation(popup)).toBe("none");

            await popup.getByRole("button", { name: "Save Tab" }).click();
            await expect(logo(popup)).toHaveAttribute("data-hops", "1");
            expect(await animation(popup)).toMatch(/hop/);

            await popup.getByRole("button", { name: "Add link manually" }).click();
            await popup.getByLabel("URL").fill("docs.example.com/guide");
            await popup.getByRole("button", { name: "Add", exact: true }).click();
            await expect(logo(popup)).toHaveAttribute("data-hops", "2");
        });

        test("an already-saved link and Update don't make it hop", async ({ context, popup }) => {
            await seedLibrary(popup, [{ title: "Existing", url: "https://a.example.com/" }]);
            await popup.getByRole("button", { name: "Add link manually" }).click();
            await popup.getByLabel("URL").fill("https://a.example.com");
            await popup.getByRole("button", { name: "Add", exact: true }).click();
            await expect(popup.getByRole("alert")).toHaveText("Already saved as “Existing”.");
            await popup.getByRole("button", { name: "Cancel" }).click();

            await openSiteTab(context, popup, "Example Article");
            await popup.getByRole("button", { name: "Save Tab" }).click();
            await popup.getByRole("button", { name: "Update" }).click();
            await expect(popup.getByRole("button", { name: "Updated" })).toBeVisible();
            await expect(logo(popup)).toHaveAttribute("data-hops", "1");
        });

        test("with reduce motion on, it stays still", async ({ context, popup }) => {
            await popup.emulateMedia({ reducedMotion: "reduce" });
            await openSiteTab(context, popup, "Example Article");
            await popup.getByRole("button", { name: "Save Tab" }).click();
            await expect(logo(popup)).toHaveAttribute("data-hops", "1");
            expect(await animation(popup)).toBe("none");
        });
    });
});
