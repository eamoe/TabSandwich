import type { BrowserContext, Page } from "@playwright/test";
import { test, expect, LIBRARY_URL, TEST_SITE, waitUntilReady } from "./fixtures";
import { seedLibrary, storedTabs, worker } from "./helpers";

const LIBRARY = [
    { title: "Rust docs", url: `${TEST_SITE}/rust`, category: "Reading" },
    { title: "Weather", url: `${TEST_SITE}/weather` },
    { title: "Old archive", url: `${TEST_SITE}/old`, archivedDaysAgo: 1 },
];

/** Chrome's address bar can't be typed in from a test, so these deliver what it would send. */
type Dispatching = { dispatch: (...args: unknown[]) => void };
const typed = async (context: BrowserContext, text: string) =>
    (await worker(context)).evaluate(
        (text) =>
            new Promise<chrome.omnibox.SuggestResult[]>((resolve) => {
                (chrome.omnibox.onInputChanged as unknown as Dispatching).dispatch(text, resolve);
            }),
        text
    );
const entered = async (context: BrowserContext, text: string, disposition: string) =>
    (await worker(context)).evaluate(([text, disposition]) => (chrome.omnibox.onInputEntered as unknown as Dispatching).dispatch(text, disposition), [text, disposition]);

/** Read from Chrome's tab list: a background tab loads outside Playwright's routing, so its page can't say. */
const tabAt = async (context: BrowserContext, url: string) => (await worker(context)).evaluate(async (url) => (await chrome.tabs.query({ url })).map((t) => ({ active: t.active }))[0], url);

const opens = (popup: Page) => popup.evaluate(async () => ((await chrome.storage.local.get("tabSandwich.tabs"))["tabSandwich.tabs"] as { title: string; openCount?: number }[]).find((t) => t.title === "Rust docs")?.openCount);

test.describe("The address bar", () => {
    test.beforeEach(async ({ popup }) => {
        await seedLibrary(popup, LIBRARY);
    });

    test("TC-301: ts and a word lists saved tabs, never the archive", async ({ context }) => {
        expect(await typed(context, "rust")).toEqual([{ content: LIBRARY[0].url, description: "<match>Rust</match> docs <dim>· example.test</dim>" }]);
        expect(await typed(context, "archive")).toEqual([]);
    });

    test("TC-302: picking one opens it where the address bar was told, and counts the open", async ({ context, popup }) => {
        await entered(context, LIBRARY[0].url, "newForegroundTab");
        await expect.poll(() => tabAt(context, LIBRARY[0].url)).toEqual({ active: true });
        await expect.poll(() => opens(popup)).toBe(1);
    });

    test("TC-302: Enter on words alone goes to the best match", async ({ context, popup }) => {
        await entered(context, "weath", "newBackgroundTab");
        await expect.poll(() => tabAt(context, LIBRARY[1].url)).toEqual({ active: false });
        expect((await storedTabs(popup)).length).toBe(3);
    });

    test("TC-303: nothing found opens the library on that search, or goes to the one that's open", async ({ context }) => {
        const opened = context.waitForEvent("page");
        await entered(context, "no such words", "currentTab");
        const library = await opened;
        await waitUntilReady(library);
        await expect(library).toHaveURL(`${LIBRARY_URL}?q=no%20such%20words`);
        await expect(library.getByRole("textbox", { name: "Search saved tabs" })).toHaveValue("no such words");
        await expect(library.getByText("No saved tabs match")).toBeVisible();

        await library.getByRole("button", { name: "Open settings" }).click();
        await entered(context, "other words", "currentTab");
        await expect(library).toHaveURL(`${LIBRARY_URL}?q=other%20words`);
        expect(context.pages().filter((p) => p.url().startsWith(LIBRARY_URL))).toHaveLength(1);
    });
});
