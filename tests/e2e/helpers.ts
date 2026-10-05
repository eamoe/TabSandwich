import type { BrowserContext, Locator, Page } from "@playwright/test";
import { expect, TEST_SITE, waitUntilReady } from "./fixtures";

export interface SeedTab {
    title: string;
    url: string;
    category?: string;
    /** How long ago it was saved; defaults to now. */
    daysAgo?: number;
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
    { seenVersion = "current" }: { seenVersion?: string | null } = {}
): Promise<void> {
    await popup.evaluate(
        async ({ tabs, settings, day, seenVersion }) => {
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
                })),
                "tabSandwich.settings": {
                    outdatedEnabled: true,
                    outdatedDays: 7,
                    categories: ["Work", "Personal", "Reading", "Entertainment"],
                    categoryColors: { Work: "purple", Personal: "coral", Reading: "teal", Entertainment: "pink" },
                    ...settings,
                },
            });
        },
        { tabs, settings, day: DAY, seenVersion }
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
    outdatedEnabled?: boolean;
    outdatedDays?: number;
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

/** The titles of the rows on screen, top to bottom — each row's first button is its title, which opens the tab. */
export async function rowTitles(popup: Page): Promise<string[]> {
    const rows = tabList(popup).getByRole("listitem");
    const titles: string[] = [];
    for (const item of await rows.all()) {
        const title = item.getByRole("button").first();
        if (await title.count()) titles.push((await title.textContent()) ?? "");
    }
    return titles;
}

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
