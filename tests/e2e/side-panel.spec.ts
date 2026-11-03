import type { Page } from "@playwright/test";
import { test, expect, SIDE_PANEL_URL, TEST_SITE, waitUntilReady } from "./fixtures";
import { answerPermissionPrompt, clickMenu, openFromMenu, openSettings, openSiteTab, promptsShown, row, seedLibrary, storedTabs, tabList, worker } from "./helpers";

const LIBRARY = Array.from({ length: 14 }, (_, i) => ({ title: `Saved page ${i + 1}`, url: `https://page${i + 1}.example.com/` }));

const openPanel = async (popup: Page) => {
    await popup.setViewportSize({ width: 360, height: 900 });
    await popup.goto(SIDE_PANEL_URL);
    await waitUntilReady(popup);
};

/** A page the test copy of the extension has no access to: what the side panel sees without the "tabs" permission. */
const openUnseenPage = async (context: import("@playwright/test").BrowserContext, panel: Page) => {
    const url = "https://unseen.example.org/article";
    await context.route(url, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Unseen article</title><h1>Hello</h1>" }));
    const opened = context.waitForEvent("page");
    await panel.evaluate((u) => chrome.tabs.create({ url: u, active: true }), url);
    await (await opened).waitForLoadState();
    return url;
};

test.describe("The side panel", () => {
    test("TC-291: it's the whole app, as tall as the window, and a right-click save shows up by itself", async ({ context, popup }) => {
        await seedLibrary(popup, LIBRARY);
        await openPanel(popup);
        await expect(row(popup, "Saved page 9")).toBeVisible();

        // Taller than a popup could be, and the list scrolls inside it, never the page.
        const heights = await popup.evaluate(() => ({ page: document.documentElement.scrollHeight, window: innerHeight, list: document.getElementById("main-view")!.getBoundingClientRect().bottom }));
        expect(heights.page).toBe(heights.window);
        expect(heights.list).toBeGreaterThan(800);
        await expect(popup.getByRole("button", { name: "Open in" })).toHaveCount(0);
        await expect(popup.getByRole("button", { name: "Open library" })).toBeVisible();

        await openSiteTab(context, popup, "Something to read");
        await clickMenu(context, popup, "Reading", { linkUrl: "https://link.example.com/", selectionText: "A saved link" });
        await expect(row(popup, "A saved link")).toBeVisible();

        await openSettings(popup, "General");
        expect(await popup.getByRole("main", { name: "Settings" }).evaluate((main) => main.getBoundingClientRect().height)).toBe(900);
    });

    test("TC-291: a right-click save shows itself, even below a long run of pinned tabs", async ({ context, popup }) => {
        const pinned = Array.from({ length: 24 }, (_, i) => ({ title: `Pinned page ${i + 1}`, url: `https://pinned${i + 1}.example.com/`, pinned: true }));
        await seedLibrary(popup, pinned);
        await openPanel(popup);
        await openSiteTab(context, popup, "Something to read");
        // (Here the panel is a tab of its own, and a tab behind another doesn't scroll. A real panel is always on show.)
        await popup.bringToFront();
        await clickMenu(context, popup, "Reading", { linkUrl: "https://link.example.com/", selectionText: "Below the pins" });
        await expect(row(popup, "Below the pins")).toBeInViewport();
        await expect(popup.locator('[class*="hop"]')).toHaveCount(1);
    });

    test("TC-292: saving asks Chrome once, on the first Save, and a no saves nothing", async ({ context, popup }) => {
        await seedLibrary(popup, []);
        await openPanel(popup);
        await answerPermissionPrompt(context, popup, "deny");
        await openUnseenPage(context, popup);

        const card = popup.getByRole("region", { name: "Current tab" });
        await expect(card).toContainText("The page you're on");
        await expect(card).toContainText("Chrome asks once before the first save.");
        await expect.poll(() => promptsShown(popup)).toBe(0);

        await card.getByRole("button", { name: "Save Tab" }).click();
        await expect(popup.getByRole("status").filter({ hasText: "so nothing was saved" })).toBeVisible();
        expect(await storedTabs(popup)).toEqual([]);
        expect(await promptsShown(popup)).toBe(1);
    });

    test("TC-292: after a yes the page is saved, and from then on the card shows it", async ({ context, popup }) => {
        await seedLibrary(popup, []);
        await openPanel(popup);
        await answerPermissionPrompt(context, popup, "grant");
        const url = await openUnseenPage(context, popup);
        // The prompt is a stand-in, so what the real permission would then reveal is too.
        await popup.evaluate((url) => {
            const query = chrome.tabs.query.bind(chrome.tabs);
            Object.defineProperty(chrome.tabs, "query", {
                value: async (q: chrome.tabs.QueryInfo) => {
                    const tabs = await query(q);
                    return localStorage.getItem("test.tabsPermission") === "yes" ? tabs.map((t) => ({ ...t, url, title: "Unseen article" })) : tabs;
                },
            });
        }, url);
        await popup.getByRole("button", { name: "Save Tab" }).click();
        await expect(row(popup, "Unseen article")).toBeVisible();
        expect((await storedTabs(popup))[0]).toMatchObject({ title: "Unseen article", url });
    });

    test("a page it can already see needs no asking", async ({ context, popup }) => {
        await seedLibrary(popup, []);
        await openPanel(popup);
        await answerPermissionPrompt(context, popup, "deny");
        await openSiteTab(context, popup, "Example Article");
        await popup.getByRole("button", { name: "Save Tab" }).click();
        await expect(row(popup, "Example Article")).toBeVisible();
        expect(await promptsShown(popup)).toBe(0);
    });

    test("TC-293: Settings decides what the toolbar icon opens, and the choice is kept", async ({ context, popup }) => {
        const sw = await worker(context);
        const opens = () => sw.evaluate(async () => [await chrome.action.getPopup({}), (await chrome.sidePanel.getPanelBehavior()).openPanelOnActionClick]);
        await expect.poll(opens).toEqual([expect.stringContaining("/popup/popup.html"), false]);

        await openSettings(popup, "General");
        const choice = popup.getByRole("group", { name: "What the toolbar icon opens" });
        await expect(choice.getByRole("button", { name: "Popup" })).toHaveAttribute("aria-pressed", "true");
        await choice.getByRole("button", { name: "Side panel" }).click();
        await expect(choice.getByRole("button", { name: "Side panel" })).toHaveAttribute("aria-pressed", "true");
        await expect.poll(opens).toEqual(["", true]);

        await choice.getByRole("button", { name: "Popup" }).click();
        await expect.poll(opens).toEqual([expect.stringContaining("/popup/popup.html"), false]);
    });

    test("TC-294: the popup's Open in menu opens the panel for its window, then the popup closes", async ({ popup }) => {
        const windowId = await popup.evaluate(async () => {
            const asked: number[] = [];
            Object.assign(window, { asked });
            Object.defineProperty(chrome.sidePanel, "open", { value: async (o: { windowId: number }) => void asked.push(o.windowId) });
            return (await chrome.windows.getCurrent()).id;
        });
        await popup.evaluate(() => {
            window.close = () => Object.assign(window, { closedPopup: true });
        });
        await openFromMenu(popup, "Open side panel");
        await expect.poll(() => popup.evaluate(() => (window as unknown as { closedPopup?: boolean }).closedPopup)).toBe(true);
        expect(await popup.evaluate(() => (window as unknown as { asked: number[] }).asked)).toEqual([windowId]);
    });

    test("TC-294: the menu works from the keyboard, and goes when you click away", async ({ popup }) => {
        const button = popup.getByRole("button", { name: "Open in" });
        const items = popup.getByRole("menu", { name: "Open in" }).getByRole("menuitem");
        await button.focus();
        await popup.keyboard.press("Enter");
        await expect(items).toHaveText(["Open side panel", "Open library"]);
        await expect(items.first()).toBeFocused();
        await popup.keyboard.press("ArrowDown");
        await expect(items.nth(1)).toBeFocused();
        await popup.keyboard.press("ArrowDown");
        await expect(items.first()).toBeFocused();
        await popup.keyboard.press("Escape");
        await expect(items).toHaveCount(0);
        await expect(button).toBeFocused();
        await button.click();
        await tabList(popup).click({ position: { x: 5, y: 5 } });
        await expect(items).toHaveCount(0);
    });

    test("TC-294: if Chrome refuses, the popup stays and says so", async ({ popup }) => {
        await popup.evaluate(() => {
            Object.defineProperty(chrome.sidePanel, "open", { value: async () => Promise.reject(new Error("No")) });
        });
        await openFromMenu(popup, "Open side panel");
        await expect(popup.getByRole("status").filter({ hasText: "couldn't open the side panel" })).toBeVisible();
        await expect(tabList(popup)).toBeVisible();
    });
});

test("TC-291: a side panel and a popup open together stay in step, both ways", async ({ context, popup }) => {
    await seedLibrary(popup, [{ title: "Alpha", url: `${TEST_SITE}/alpha` }]);
    await popup.reload();
    await waitUntilReady(popup);
    const panel = await context.newPage();
    await openPanel(panel);
    await popup.getByRole("button", { name: "Archive Alpha" }).click();
    await expect(row(panel, "Alpha")).toHaveCount(0);
    await popup.getByRole("button", { name: "Undo" }).click();
    await expect(row(panel, "Alpha")).toBeVisible();
});
