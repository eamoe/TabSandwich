import type { BrowserContext, Page, Worker } from "@playwright/test";
import { test, expect, TEST_SITE } from "./fixtures";
import { openSettings, openSiteTab, row, seedLibrary, storedTabs } from "./helpers";

const PAGE_TITLE = "Links";
const PAGE = `<!doctype html><title>${PAGE_TITLE}</title>
    <a href="/article">An article   worth
    keeping</a>
    <a href="/picture"><img alt="A photo of Lisbon" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></a>
    <a href="/bare"></a>
    <a href="mailto:someone@example.test">Write to us</a>`;

const worker = async (context: BrowserContext): Promise<Worker> => context.serviceWorkers()[0] ?? context.waitForEvent("serviceworker");

/** Chrome's own menu can't be opened from a test, so this delivers the click it would send. */
async function clickMenu(context: BrowserContext, popup: Page, category: string, target: { linkUrl?: string; selectionText?: string }) {
    const tab = await popup.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
    const sw = await worker(context);
    await sw.evaluate(
        ([info, tab]) => (chrome.contextMenus.onClicked as unknown as { dispatch: (...args: unknown[]) => void }).dispatch(info, tab),
        [{ menuItemId: `save:${category}`, pageUrl: tab.url, frameId: 0, editable: false, ...target }, tab] as const
    );
}

const badge = (popup: Page) => popup.evaluate(() => chrome.action.getBadgeText({}));

test("TC-290: the menu follows the categories as they change in Settings", async ({ context, popup }) => {
    const sw = await worker(context);
    await sw.evaluate(() => {
        const created: string[] = [];
        const create = chrome.contextMenus.create.bind(chrome.contextMenus);
        Object.assign(globalThis, { created });
        chrome.contextMenus.create = (item: chrome.contextMenus.CreateProperties) => {
            created.push(item.title ?? "");
            return create(item);
        };
    });
    await openSettings(popup, "Categories");
    await popup.getByPlaceholder("New category").fill("Travel");
    await popup.keyboard.press("Enter");
    await expect.poll(() => sw.evaluate(() => (globalThis as unknown as { created: string[] }).created)).toEqual([
        "Save to Tab Sandwich",
        "Travel",
        "Work",
        "Personal",
        "Reading",
        "Entertainment",
        "Uncategorized",
    ]);
});

test.describe("Saving from the right-click menu", () => {
    test.beforeEach(async ({ context, popup }) => {
        await context.route(`${TEST_SITE}/${PAGE_TITLE}`, (route) => route.fulfill({ contentType: "text/html", body: PAGE }));
        await seedLibrary(popup, [{ title: "Alpha", url: "https://alpha.example.com/" }]);
        await openSiteTab(context, popup, PAGE_TITLE);
    });

    test("TC-287: a link is saved into the category picked, titled with its own words, and shows in what's open", async ({ context, popup }) => {
        await clickMenu(context, popup, "Reading", { linkUrl: `${TEST_SITE}/article` });
        await expect(row(popup, "An article worth keeping")).toBeVisible();
        expect((await storedTabs(popup))[0]).toMatchObject({ title: "An article worth keeping", url: `${TEST_SITE}/article`, category: "Reading" });
        await expect.poll(() => badge(popup)).toBe("✓");
        await expect.poll(() => badge(popup), { timeout: 6000 }).toBe("");
    });

    test("TC-288: a link with no words uses its picture's description, then what's selected, then the site's name", async ({ context, popup }) => {
        await clickMenu(context, popup, "Uncategorized", { linkUrl: `${TEST_SITE}/picture` });
        await expect(row(popup, "A photo of Lisbon")).toBeVisible();
        expect((await storedTabs(popup))[0]).not.toHaveProperty("category");

        await clickMenu(context, popup, "Work", { linkUrl: `${TEST_SITE}/bare`, selectionText: "Selected words" });
        await expect(row(popup, "Selected words")).toBeVisible();

        await clickMenu(context, popup, "Work", { linkUrl: "https://nowhere.example.com/page" });
        await expect(row(popup, "nowhere.example.com")).toBeVisible();
    });

    test("TC-289: away from any link it saves the page, a saved link stays one copy, and a link that isn't a page is refused", async ({ context, popup }) => {
        await clickMenu(context, popup, "Work", {});
        await expect(row(popup, PAGE_TITLE)).toBeVisible();
        expect((await storedTabs(popup))[0]).toMatchObject({ url: `${TEST_SITE}/${PAGE_TITLE}`, category: "Work" });

        await clickMenu(context, popup, "Reading", { linkUrl: "https://alpha.example.com/" });
        await expect.poll(() => badge(popup)).toBe("✓");
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual([PAGE_TITLE, "Alpha"]);

        await clickMenu(context, popup, "Work", { linkUrl: "mailto:someone@example.test" });
        await expect.poll(() => badge(popup)).toBe("!");
        expect(await storedTabs(popup)).toHaveLength(2);
    });
});
