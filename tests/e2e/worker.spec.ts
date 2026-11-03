import type { Page } from "@playwright/test";
import { test, expect, POPUP_URL, WELCOME_URL, waitUntilReady } from "./fixtures";
import { row, seedLibrary, storedTabs, tabList } from "./helpers";

/** Chrome words the shortcut for the computer: "Alt+S", or "⌥S" on a Mac. */
const SHORTCUT_SHOWN = /Press\s*\S*S/;

const secondPopup = async (context: import("@playwright/test").BrowserContext): Promise<Page> => {
    const page = await context.newPage();
    await page.goto(POPUP_URL);
    await waitUntilReady(page);
    return page;
};

const addLink = async (popup: Page, url: string, title: string) => {
    await popup.getByRole("button", { name: "Add link manually" }).click();
    await popup.getByLabel("URL").fill(url);
    await popup.getByRole("textbox", { name: /^Title/ }).fill(title);
    await popup.getByRole("button", { name: "Add", exact: true }).click();
};

test.describe("A fresh install", () => {
    test.use({ keepWelcomePage: true });

    test("TC-284: the welcome page opens once, says how to start, and closes with Got it", async ({ context, popup }) => {
        const welcome = context.pages().find((p) => p.url() === WELCOME_URL)!;
        await expect(welcome.getByRole("heading", { level: 1, name: "Welcome to Tab Sandwich" })).toBeVisible();
        await expect(welcome.getByRole("heading", { level: 2 })).toHaveText(["Pin it to your toolbar", "Save a page", "Open it from anywhere"]);
        await expect(welcome.getByRole("main")).toContainText(SHORTCUT_SHOWN);
        await expect(welcome.getByRole("main")).toContainText("No account, no tracking");

        // A new user gets no "What's new", and opening the popup doesn't bring the page back.
        await popup.reload();
        await waitUntilReady(popup);
        await expect(popup.getByRole("region", { name: /^New in / })).toHaveCount(0);
        expect(context.pages().filter((p) => p.url() === WELCOME_URL)).toHaveLength(1);

        const closed = welcome.waitForEvent("close");
        await welcome.getByRole("button", { name: "Got it" }).click();
        await closed;
    });
});

test.describe("Several parts of the extension open at once", () => {
    test("TC-285: a change made in one shows in the others without a refresh, and an open edit survives it", async ({ context, popup }) => {
        await seedLibrary(popup, [{ title: "Alpha", url: "https://alpha.example.com/" }]);
        await popup.reload();
        await waitUntilReady(popup);
        const other = await secondPopup(context);

        await other.getByRole("button", { name: "Edit Alpha" }).click();
        await tabList(other).getByLabel("Title", { exact: true }).fill("Alpha, half typed");

        await addLink(popup, "https://bravo.example.com/", "Bravo");
        await expect(row(other, "Bravo")).toBeVisible();
        await expect(tabList(other).getByLabel("Title", { exact: true })).toHaveValue("Alpha, half typed");

        await popup.getByRole("button", { name: "Open settings" }).click();
        await popup.getByRole("button", { name: "Dark", exact: true }).click();
        await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");
    });

    test("TC-286: they take turns writing, so saves made at the same moment are all kept", async ({ context, popup }) => {
        await seedLibrary(popup, []);
        await popup.reload();
        await waitUntilReady(popup);
        const other = await secondPopup(context);
        const holder = await secondPopup(context);

        // Another part of the extension in the middle of a write.
        await holder.evaluate(
            () =>
                new Promise<void>((held) => {
                    void navigator.locks.request("tabSandwich.storage", () => {
                        held();
                        return new Promise<void>((release) => {
                            (window as unknown as { release: () => void }).release = release;
                        });
                    });
                })
        );
        await addLink(popup, "https://one.example.com/", "One");
        await addLink(other, "https://two.example.com/", "Two");
        await popup.waitForTimeout(300);
        expect(await storedTabs(popup)).toEqual([]);

        await holder.evaluate(() => (window as unknown as { release: () => void }).release());
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title).sort()).toEqual(["One", "Two"]);
        await expect(row(popup, "Two")).toBeVisible();
        await expect(row(other, "One")).toBeVisible();
    });
});
