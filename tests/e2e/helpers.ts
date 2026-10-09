import type { BrowserContext, Locator, Page } from "@playwright/test";
import { expect, TEST_SITE, waitUntilReady } from "./fixtures";

export interface SeedTab {
    title: string;
    url: string;
    category?: string;
    /** How long ago it was saved; defaults to now. */
    daysAgo?: number;
    /** The id of a saved window in `groups` (seedLibrary's last argument). */
    groupId?: string;
    pinned?: boolean;
    /** Archived this many days ago. */
    archivedDaysAgo?: number;
    note?: string;
}

export interface SeedGroup {
    id: string;
    name: string;
    collapsed?: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Replaces everything stored with this library, then reloads the popup so it renders from it.
 * Seeded as someone who has already seen this version's "What's new" note, so it only shows in
 * the tests about it (pass `seenVersion: null` for someone who just updated).
 */
export async function seedLibrary(
    popup: Page,
    tabs: SeedTab[],
    settings: Record<string, unknown> = {},
    { seenVersion = "current", groups = [] }: { seenVersion?: string | null; groups?: SeedGroup[] } = {}
): Promise<void> {
    await popup.evaluate(
        async ({ tabs, settings, day, seenVersion, groups }) => {
            await chrome.storage.local.clear();
            if (seenVersion !== null) {
                await chrome.storage.local.set({
                    "tabSandwich.lastSeenVersion": seenVersion === "current" ? chrome.runtime.getManifest().version : seenVersion,
                });
            }
            // One clock reading for the whole library: tabs seeded with the same age get exactly
            // the same time, so sorting by date keeps them in a fixed order on every run.
            const now = Date.now();
            await chrome.storage.local.set({
                "tabSandwich.tabs": tabs.map((t, i) => ({
                    id: `seed-${i}`,
                    title: t.title,
                    url: t.url,
                    category: t.category,
                    savedAt: now - (t.daysAgo ?? 0) * day,
                    ...(t.groupId ? { groupId: t.groupId } : {}),
                    ...(t.pinned ? { pinned: true } : {}),
                    ...(t.note ? { note: t.note } : {}),
                    ...(t.archivedDaysAgo !== undefined ? { archivedAt: now - t.archivedDaysAgo * day } : {}),
                })),
                "tabSandwich.groups": groups.map((g) => ({ id: g.id, name: g.name, createdAt: now, collapsed: g.collapsed ?? true })),
                "tabSandwich.settings": {
                    outdatedDays: 7,
                    // As on a fresh install: Reading and Uncategorized age, the rest are kept.
                    waitingCategories: ["Reading", "Uncategorized"],
                    categories: ["Work", "Personal", "Reading", "Entertainment"],
                    categoryColors: { Work: "purple", Personal: "coral", Reading: "teal", Entertainment: "pink" },
                    ...settings,
                },
            });
        },
        { tabs, settings, day: DAY, seenVersion, groups }
    );
    await popup.reload();
    await waitUntilReady(popup);
}

export async function storedTabs(popup: Page): Promise<Array<{ title: string; url: string; category?: string }>> {
    return popup.evaluate(async () => (await chrome.storage.local.get("tabSandwich.tabs"))["tabSandwich.tabs"] ?? []);
}

export interface StoredSettings {
    categories: string[];
    categoryColors: Record<string, string>;
    outdatedDays?: number;
    waitingCategories?: string[];
    theme?: string;
    sort?: string;
}

export async function storedSettings(popup: Page): Promise<StoredSettings> {
    return popup.evaluate(async () => (await chrome.storage.local.get("tabSandwich.settings"))["tabSandwich.settings"]);
}

/**
 * Opens a page of the fake test site as the active tab in the popup's own window — the tab
 * "Save Tab" saves. Created from inside the extension so it's guaranteed to land in the same
 * window, and only returns once Chrome reports the page's real title.
 */
export async function openSiteTab(context: BrowserContext, popup: Page, title: string): Promise<string> {
    const url = `${TEST_SITE}/${encodeURIComponent(title)}`;
    const opened = context.waitForEvent("page");
    await popup.evaluate((u) => chrome.tabs.create({ url: u, active: true }), url);
    await (await opened).waitForLoadState();
    await expect
        .poll(() => popup.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.title))
        .toBe(title);
    return url;
}

export const tabList = (popup: Page): Locator => popup.getByRole("list", { name: "Saved tabs" });

export const row = (popup: Page, title: string): Locator => tabList(popup).getByRole("listitem").filter({ hasText: title });

/**
 * The titles of the rows on screen, top to bottom — each row's first button is its title, which
 * opens the tab. A saved window's row shows as "▸ name" (closed) or "▾ name" (open), followed by
 * its tabs while it's open.
 */
export async function rowTitles(popup: Page): Promise<string[]> {
    // Read in one step inside the page: row by row from here, a row sliding away (deleted) between
    // two reads would leave a read waiting for a row that's gone.
    return tabList(popup).evaluate((list) =>
        [...list.querySelectorAll("li")].flatMap((item) => {
            const title = [...item.querySelectorAll("button")].find((b) => (b.getAttribute("role") ?? "button") === "button");
            if (!title) return [];
            const groupName = title.getAttribute("data-group-name");
            if (groupName !== null) return [`${title.getAttribute("aria-expanded") === "true" ? "▾" : "▸"} ${groupName}`];
            return [title.textContent ?? ""];
        })
    );
}

/** A saved window's own row (the button that opens and closes it), by its name. */
export const windowRow = (popup: Page, name: string): Locator => tabList(popup).locator(`button[data-group-name="${name}"]`);

export async function openSettings(popup: Page, tab?: "General" | "Categories" | "Backup" | "About"): Promise<void> {
    await popup.getByRole("button", { name: "Open settings" }).click();
    await expect(popup.getByRole("main", { name: "Settings" })).toBeVisible();
    if (tab) await popup.getByRole("tab", { name: tab }).click();
}

/** The category choices offered when adding a link manually, in order (leaves the panel closed again). */
export async function manualEntryCategories(popup: Page): Promise<string[]> {
    const toggle = popup.getByRole("button", { name: "Add link manually" });
    await toggle.click();
    const select = popup.getByLabel("Category (optional)");
    await expect(select).toBeVisible();
    const options = await select.locator("option").allTextContents();
    await popup.getByRole("button", { name: "Cancel" }).click();
    return options;
}

/**
 * Stands in for Chrome's permission prompt, which a test can't click: from now on, asking for
 * the optional "tabs" permission is answered `answer` straight away, and remembered like Chrome
 * would. Only the prompt is fake: the test copy of the extension can already read the fake
 * site's tabs (see fixtures.ts), the same access the real permission gives on every site.
 * Reloads the popup so it starts with the stand-in. `promptsShown` counts how often it was asked.
 */
export async function answerPermissionPrompt(context: BrowserContext, popup: Page, answer: "grant" | "deny"): Promise<void> {
    await context.addInitScript((answer) => {
        if (!location.href.startsWith("chrome-extension://") || typeof chrome === "undefined" || !chrome.permissions) return;
        const GRANTED = "test.tabsPermission";
        const asksTabs = (p: chrome.permissions.Permissions) => p.permissions?.includes("tabs") ?? false;
        const replace = (name: string, value: unknown) => Object.defineProperty(chrome.permissions, name, { value, configurable: true });
        replace("contains", async (p: chrome.permissions.Permissions) => asksTabs(p) && localStorage.getItem(GRANTED) === "yes");
        replace("request", async (p: chrome.permissions.Permissions) => {
            if (!asksTabs(p)) return false;
            localStorage.setItem("test.promptsShown", String(Number(localStorage.getItem("test.promptsShown") ?? 0) + 1));
            if (answer === "grant") localStorage.setItem(GRANTED, "yes");
            return answer === "grant";
        });
    }, answer);
    await popup.reload();
    await waitUntilReady(popup);
}

export async function promptsShown(popup: Page): Promise<number> {
    return popup.evaluate(() => Number(localStorage.getItem("test.promptsShown") ?? 0));
}

/** The addresses of every tab open in the browser. */
export async function openTabUrls(popup: Page): Promise<string[]> {
    return popup.evaluate(async () => (await chrome.tabs.query({})).map((t) => t.url ?? t.pendingUrl ?? ""));
}

/**
 * Shrinks the test window to the popup's own height. A real popup is only as tall as what it
 * shows (the test window is always 580px), which is what a floating menu has to fit inside.
 */
export async function fitWindowToPopup(popup: Page): Promise<void> {
    const height = await popup.evaluate(() => Math.ceil(document.getElementById("main-view")!.getBoundingClientRect().bottom));
    await popup.setViewportSize({ width: 380, height });
}

/** Every item of the open menu is fully inside the window, and on top: nothing else covers it. */
export async function expectMenuFullyVisible(popup: Page): Promise<void> {
    const items = popup.getByRole("menu").locator("[role^='menuitem']");
    for (const item of await items.all()) {
        await expect(item).toBeInViewport({ ratio: 1 });
        // What's actually drawn at the item's corners and middle is the item itself.
        const covered = await item.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const points = [[r.left + 4, r.top + 4], [r.right - 4, r.bottom - 4], [r.left + r.width / 2, r.top + r.height / 2]];
            return points.some(([x, y]) => !el.contains(document.elementFromPoint(x, y)));
        });
        expect(covered).toBe(false);
    }
}
