import type { Page } from "@playwright/test";
import { test, expect, TEST_SITE } from "./fixtures";
import { clickMenu, openSettings, openSiteTab, seedLibrary, storedSettings, worker } from "./helpers";

const badge = (popup: Page) => popup.evaluate(() => chrome.action.getBadgeText({}));
const LIBRARY = [
    { title: "Old read", url: `${TEST_SITE}/old`, category: "Reading", daysAgo: 30 },
    { title: "Due", url: `${TEST_SITE}/due`, category: "Work", remindInDays: -1 },
    { title: "Fresh", url: `${TEST_SITE}/fresh`, category: "Work" },
];
const turnOn = async (popup: Page) => {
    await openSettings(popup);
    await popup.getByRole("region", { name: "Waiting count" }).getByRole("button", { name: "Turn on" }).click();
};

test.describe("The toolbar badge", () => {
    test("TC-310: off by default; turned on, it counts waiting tabs and due reminders, and turns off again", async ({ popup }) => {
        await seedLibrary(popup, LIBRARY);
        expect(await badge(popup)).toBe("");
        await turnOn(popup);
        await expect.poll(() => badge(popup)).toBe("2");
        expect((await storedSettings(popup)).toolbarBadge).toBe(true);
        await expect.poll(() => popup.evaluate(() => chrome.action.getTitle({}))).toBe("Tab Sandwich: 2 waiting");

        await popup.getByRole("region", { name: "Waiting count" }).getByRole("button", { name: "Turn off" }).click();
        await expect.poll(() => badge(popup)).toBe("");
    });

    test("TC-311: it follows the library, and the waiting settings, from wherever they change", async ({ popup }) => {
        await seedLibrary(popup, LIBRARY, { toolbarBadge: true });
        await expect.poll(() => badge(popup)).toBe("2");
        await popup.evaluate(async () => {
            const key = "tabSandwich.tabs";
            const tabs = (await chrome.storage.local.get(key))[key] as Array<{ title: string; archivedAt?: number }>;
            tabs[0].archivedAt = Date.now();
            await chrome.storage.local.set({ [key]: tabs });
        });
        await expect.poll(() => badge(popup)).toBe("1");
        await popup.evaluate(async () => {
            const key = "tabSandwich.settings";
            const settings = (await chrome.storage.local.get(key))[key] as { waitingCategories: string[]; outdatedDays: number };
            await chrome.storage.local.set({ [key]: { ...settings, waitingCategories: ["Work"], outdatedDays: 1 } });
        });
        await expect.poll(() => badge(popup)).toBe("1");
    });

    test("TC-311: it's counted again as time passes, on Chrome's next start too", async ({ context, popup }) => {
        await seedLibrary(popup, LIBRARY, { toolbarBadge: true });
        await expect.poll(() => badge(popup)).toBe("2");
        const sw = await worker(context);
        await expect.poll(() => sw.evaluate(async () => (await chrome.alarms.get("tabSandwich.badge"))?.periodInMinutes)).toBe(60);
        await popup.evaluate(() => chrome.action.setBadgeText({ text: "" }));
        await sw.evaluate(() => (chrome.alarms.onAlarm as unknown as { dispatch: (alarm: object) => void }).dispatch({ name: "tabSandwich.badge" }));
        await expect.poll(() => badge(popup)).toBe("2");
        await popup.evaluate(() => chrome.action.setBadgeText({ text: "" }));
        await sw.evaluate(() => (chrome.runtime.onStartup as unknown as { dispatch: () => void }).dispatch());
        await expect.poll(() => badge(popup)).toBe("2");
    });

    test("TC-312: a save's flash shows, then the count comes back", async ({ context, popup }) => {
        await seedLibrary(popup, LIBRARY, { toolbarBadge: true });
        await openSiteTab(context, popup, "Links");
        await clickMenu(context, popup, "Reading", { linkUrl: `${TEST_SITE}/article`, selectionText: "An article" });
        await expect.poll(() => badge(popup)).toBe("✓");
        await expect.poll(() => badge(popup), { timeout: 6000 }).toBe("2");
    });
});
