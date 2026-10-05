import { test, expect } from "./fixtures";
import { seedLibrary, tabList } from "./helpers";

const whatsNew = (popup: import("@playwright/test").Page) => popup.getByRole("region", { name: "New in 3.1" });
const lastSeen = (popup: import("@playwright/test").Page) =>
    popup.evaluate(async () => (await chrome.storage.local.get("tabSandwich.lastSeenVersion"))["tabSandwich.lastSeenVersion"]);
const version = (popup: import("@playwright/test").Page) => popup.evaluate(() => chrome.runtime.getManifest().version);

test.describe("First run", () => {
    test("TC-209: a new user sees a welcome with tips instead of an empty list", async ({ popup }) => {
        const tips = tabList(popup).getByRole("list", { name: "Getting started" });
        await expect(tabList(popup).getByRole("heading", { name: "Nothing saved yet" })).toBeVisible();
        await expect(tips.getByRole("listitem")).toHaveCount(3);
        await expect(tips).toContainText("Save the page you're on");
        await expect(tips).toContainText("Open Tab Sandwich from anywhere");
        // "Edit categories" goes straight to Settings › Categories.
        await tips.getByRole("button", { name: "Edit categories" }).click();
        await expect(popup.getByRole("tab", { name: "Categories" })).toHaveAttribute("aria-selected", "true");
    });

    test("TC-211: a fresh install shows no \"What's new\" note, now or after reopening", async ({ popup }) => {
        await expect(tabList(popup)).toBeVisible();
        await expect(whatsNew(popup)).toHaveCount(0);
        expect(await lastSeen(popup)).toBe(await version(popup));
        await popup.reload();
        await expect(tabList(popup)).toBeVisible();
        await expect(whatsNew(popup)).toHaveCount(0);
    });
});

test.describe("What's new", () => {
    test("TC-212: after an update the note shows once, until dismissed", async ({ popup }) => {
        await seedLibrary(popup, [{ title: "Alpha", url: "https://alpha.example.com/" }], {}, { seenVersion: "3.0.0" });
        await expect(whatsNew(popup)).toBeVisible();
        await expect(whatsNew(popup).getByRole("listitem")).toHaveCount(3);
        // Still there on the next open, until you dismiss it…
        await popup.reload();
        await expect(whatsNew(popup)).toBeVisible();
        await popup.getByRole("button", { name: "Dismiss what's new" }).click();
        await expect(whatsNew(popup)).toHaveCount(0);
        await expect(popup.getByRole("textbox", { name: "Search saved tabs" })).toBeFocused();
        await expect.poll(() => lastSeen(popup)).toBe(await version(popup));
        // …then gone for good.
        await popup.reload();
        await expect(tabList(popup)).toBeVisible();
        await expect(whatsNew(popup)).toHaveCount(0);
    });

    test("TC-213: updating from a version that didn't record what you'd seen counts as an update", async ({ popup }) => {
        await seedLibrary(popup, [{ title: "Alpha", url: "https://alpha.example.com/" }], {}, { seenVersion: null });
        await expect(whatsNew(popup)).toBeVisible();
    });

    test("TC-214: restoring an old backup doesn't bring a dismissed note back", async ({ popup }) => {
        // The record lives outside Settings, so a backup (which carries Settings) can't touch it.
        await seedLibrary(popup, [{ title: "Alpha", url: "https://alpha.example.com/" }]);
        const keys = await popup.evaluate(async () => Object.keys((await chrome.storage.local.get("tabSandwich.settings"))["tabSandwich.settings"]));
        expect(keys).not.toContain("lastSeenVersion");
        await expect(whatsNew(popup)).toHaveCount(0);
    });
});
