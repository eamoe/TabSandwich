import type { SavedTab } from "../types";
import { markReminded, recordOpen } from "../domain/TabRepository";
import { nextReminderAt } from "../domain/reminders";
import { getTabs } from "../storage/chromeStorage";
import { strings } from "../ui/strings";
import { siteName } from "../ui/main/listModel";
import { NOTIFICATIONS_PERMISSION } from "../util/notifications";
import { openLibrary } from "../util/openLibrary";

export const REMINDER_ALARM = "tabSandwich.reminders";
const ONE_TAB = "tabSandwich.reminder:";
const SEVERAL_TABS = "tabSandwich.reminders";

async function notify(due: SavedTab[]): Promise<void> {
    if (!(await chrome.permissions.contains(NOTIFICATIONS_PERMISSION))) return;
    const iconUrl = chrome.runtime.getURL("images/icon-128.png");
    const [tab] = due;
    await (due.length === 1
        ? chrome.notifications.create(`${ONE_TAB}${tab.id}`, { type: "basic", iconUrl, title: tab.title, message: strings.reminderMessage(siteName(tab.url)) })
        : chrome.notifications.create(SEVERAL_TABS, { type: "basic", iconUrl, title: strings.remindersTitle(due.length), message: strings.remindersMessage }));
}

/** One alarm, for the earliest reminder: rebuilt from what's saved, since Chrome may lose alarms across a restart or an update. */
export async function scheduleReminders(): Promise<void> {
    const next = nextReminderAt(await getTabs());
    if (next === null) await chrome.alarms.clear(REMINDER_ALARM);
    else if (next <= Date.now()) await sendReminders();
    else await chrome.alarms.create(REMINDER_ALARM, { when: next });
}

/** Marked first, so each goes out once. Whatever becomes of the notification, a due tab shows under Waiting. */
export async function sendReminders(): Promise<void> {
    const due = await markReminded(Date.now());
    if (due.length) await notify(due).catch(() => undefined);
    await scheduleReminders();
}

async function showTab(url: string): Promise<void> {
    // (Clicking a notification can come with no window open, or with Chrome behind other apps.)
    const opened = await chrome.tabs.create({ url }).catch(() => null);
    if (!opened) await chrome.windows.create({ url });
    else await chrome.windows.update(opened.windowId, { focused: true });
}

async function openReminder(id: string): Promise<void> {
    if (id !== SEVERAL_TABS && !id.startsWith(ONE_TAB)) return;
    void chrome.notifications.clear(id);
    const tab = (await getTabs()).find((t) => `${ONE_TAB}${t.id}` === id);
    if (!tab) return openLibrary({ show: "waiting" });
    await recordOpen([tab.id]).catch(() => undefined);
    await showTab(tab.url);
}

let listening = false;

/** `chrome.notifications` only exists once the permission is granted, which may be while the worker is running. */
export function listenForReminderClicks(): void {
    if (listening || !chrome.notifications) return;
    listening = true;
    chrome.notifications.onClicked.addListener((id) => void openReminder(id));
}
