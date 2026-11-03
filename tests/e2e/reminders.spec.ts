import type { BrowserContext, Page } from "@playwright/test";
import { test, expect, LIBRARY_URL, TEST_SITE, waitUntilReady } from "./fixtures";
import { answerPermissionPrompt, openSettings, row, seedLibrary, storedTabs, worker } from "./helpers";

const url = (name: string) => `${TEST_SITE}/${name}`;
const stored = async (popup: Page, title: string) => ((await storedTabs(popup)) as Array<{ title: string; remindAt?: number; reminded?: boolean; openCount?: number }>).find((t) => t.title === title);

type Dispatching = { dispatch: (...args: unknown[]) => void };
/** What Chrome does at the alarm's time: a test can't wait for 9:00. */
const alarmRings = async (context: BrowserContext) => (await worker(context)).evaluate((alarm) => (chrome.alarms.onAlarm as unknown as Dispatching).dispatch(alarm), { name: "tabSandwich.reminders" });
const nextAlarm = async (context: BrowserContext) => (await worker(context)).evaluate(async () => (await chrome.alarms.getAll()).map((a) => a.scheduledTime)[0]);
/** The notifications the worker shows, kept instead of shown: the desktop's aren't there to read. */
const catchNotifications = async (context: BrowserContext) =>
    (await worker(context)).evaluate(() => {
        const self = globalThis as unknown as { shown: unknown[] };
        self.shown = [];
        Object.defineProperty(chrome.notifications, "create", {
            configurable: true,
            value: async (id: string, options: { title: string; message: string }) => void self.shown.push({ id, title: options.title, message: options.message }),
        });
    });
const notifications = async (context: BrowserContext) => (await worker(context)).evaluate(() => (globalThis as unknown as { shown: Array<{ id: string; title: string; message: string }> }).shown);
const clicked = async (context: BrowserContext, id: string) => (await worker(context)).evaluate((id) => (chrome.notifications.onClicked as unknown as Dispatching).dispatch(id), id);

test.describe("Setting a reminder", () => {
    test("TC-304: the edit form sets a reminder for 9:00 tomorrow, asks once, and the row says so", async ({ context, popup }) => {
        await seedLibrary(popup, [{ title: "Later", url: url("later") }, { title: "Next", url: url("next") }]);
        await answerPermissionPrompt(context, popup, "deny");
        const asked = () => popup.evaluate(async () => (await chrome.storage.local.get("tabSandwich.notificationsAsked"))["tabSandwich.notificationsAsked"]);

        await popup.getByRole("button", { name: "Edit Later" }).click();
        await popup.getByLabel("Reminder").selectOption({ label: "Remind me tomorrow" });
        await popup.getByRole("button", { name: "Save" }).last().click();

        await expect(row(popup, "Later")).toContainText("Tomorrow");
        // Refused: said so, since the reminder is set all the same.
        await expect(popup.getByRole("status").filter({ hasText: "Reminder set. Without notifications, it will show under Waiting." })).toBeVisible();
        const at = new Date((await stored(popup, "Later"))!.remindAt!);
        expect([at.getHours(), at.getMinutes()]).toEqual([9, 0]);
        await expect.poll(asked).toBe(true);
        await expect.poll(() => nextAlarm(context)).toBe(at.getTime());
    });

    test("TC-304: removing the reminder takes it off the row and clears the alarm", async ({ context, popup }) => {
        await seedLibrary(popup, [{ title: "Later", url: url("later"), remindInDays: 3 }]);
        await expect.poll(() => nextAlarm(context)).toBeTruthy();
        await popup.getByRole("button", { name: "Edit Later" }).click();
        await popup.getByLabel("Reminder").selectOption({ label: "No reminder" });
        await popup.getByRole("button", { name: "Save" }).last().click();
        await expect(row(popup, "Later")).not.toContainText("Reminder");
        expect((await stored(popup, "Later"))?.remindAt).toBeUndefined();
        await expect.poll(() => nextAlarm(context)).toBeUndefined();
    });
});

test.describe("A due reminder", () => {
    test("TC-305: without notifications it still shows under Waiting, and opening it ends it", async ({ context, popup }) => {
        await seedLibrary(popup, [{ title: "Pinned one", url: url("pinned"), category: "Work", pinned: true, remindInDays: -1 }, { title: "Kept", url: url("kept"), category: "Work" }]);
        await popup.getByRole("button", { name: /^Waiting/ }).click();
        await expect(row(popup, "Pinned one")).toContainText("Due");
        await expect(row(popup, "Kept")).toHaveCount(0);

        await alarmRings(context);
        await expect.poll(async () => (await stored(popup, "Pinned one"))?.reminded).toBe(true);

        const opened = context.waitForEvent("page");
        await popup.getByRole("button", { name: "Pinned one" }).first().click();
        await opened;
        await expect.poll(async () => (await stored(popup, "Pinned one"))?.remindAt).toBeUndefined();
        await expect(popup.getByRole("button", { name: /^Waiting/ })).toHaveCount(0);
    });

    test.describe("with notifications allowed", () => {
        test.use({ notificationsAllowed: true });

        test("TC-306: one reminder names its tab, comes once, and clicking it opens that tab", async ({ context, popup }) => {
            await seedLibrary(popup, [{ title: "To come", url: url("tocome"), remindInDays: 2 }]);
            await catchNotifications(context);
            await popup.evaluate(
                async (tab) => {
                    const key = "tabSandwich.tabs";
                    const tabs = (await chrome.storage.local.get(key))[key] as object[];
                    await chrome.storage.local.set({ [key]: [...tabs, tab] });
                },
                { id: "due", title: "Back to this", url: url("back"), savedAt: 1, remindAt: 1 }
            );

            await expect.poll(() => notifications(context)).toEqual([{ id: "tabSandwich.reminder:due", title: "Back to this", message: "Your reminder from Tab Sandwich · example.test" }]);
            await alarmRings(context);
            await expect.poll(async () => (await stored(popup, "Back to this"))?.reminded).toBe(true);
            expect(await notifications(context)).toHaveLength(1);
            await expect.poll(() => nextAlarm(context)).toBeGreaterThan(Date.now());

            await clicked(context, "tabSandwich.reminder:due");
            await expect.poll(async () => (await worker(context)).evaluate(async (address) => (await chrome.tabs.query({ url: address })).length, url("back"))).toBe(1);
            await expect.poll(async () => (await stored(popup, "Back to this"))?.openCount).toBe(1);
            expect((await stored(popup, "Back to this"))?.remindAt).toBeUndefined();
        });

        test("TC-307: several due at once make one notification, which opens them in the library", async ({ context, popup }) => {
            await catchNotifications(context);
            await seedLibrary(popup, [{ title: "One", url: url("one"), category: "Work", remindInDays: -1 }, { title: "Two", url: url("two"), category: "Work", remindInDays: -2 }, { title: "Other", url: url("other"), category: "Work" }]);
            await expect.poll(() => notifications(context)).toEqual([{ id: "tabSandwich.reminders", title: "2 saved tabs to come back to", message: "Click to see them in your library." }]);

            const opened = context.waitForEvent("page");
            await clicked(context, "tabSandwich.reminders");
            const library = await opened;
            await waitUntilReady(library);
            await expect(library).toHaveURL(`${LIBRARY_URL}?show=waiting`);
            await expect(library.getByRole("heading", { name: "Waiting" })).toBeVisible();
            await expect(library.getByText("2 tabs")).toBeVisible();
        });

        test("TC-308: Settings says when they're on", async ({ popup }) => {
            await openSettings(popup);
            await expect(popup.getByText("A notification at 9:00 when a reminder is due.")).toBeVisible();
        });
    });

    test("TC-308: Settings says they're off, and offers to turn them on", async ({ popup }) => {
        await openSettings(popup);
        await expect(popup.getByText("Off: a due reminder just shows under Waiting.")).toBeVisible();
        await expect(popup.getByRole("region", { name: "Reminder notifications" }).getByRole("button", { name: "Turn on" })).toBeVisible();
    });

    test("TC-309: the library shows a reminder under the title, and sets one the same way", async ({ popup }) => {
        await seedLibrary(popup, [{ title: "Later", url: url("later"), remindInDays: -1 }, { title: "Soon", url: url("soon") }]);
        await popup.goto(LIBRARY_URL);
        await waitUntilReady(popup);
        await expect(popup.getByRole("row", { name: /Later/ })).toContainText("Due");

        await popup.getByRole("row", { name: /Soon/ }).hover();
        await popup.getByRole("button", { name: "Edit Soon" }).click();
        await popup.getByLabel("Reminder").selectOption({ label: "Remind me tomorrow" });
        await popup.getByRole("button", { name: "Save", exact: true }).click();
        await expect(popup.getByRole("row", { name: /Soon/ })).toContainText("Tomorrow");
    });
});
