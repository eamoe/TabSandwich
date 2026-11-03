import type { SavedTab } from "../types";

/** Reminders arrive at this hour, local time: the start of a day, whenever one was set. */
const REMINDER_HOUR = 9;

/** `days` from today at that hour. By the calendar, not in milliseconds: a clock change mustn't move it. */
function morningIn(days: number, now: number): number {
    const day = new Date(now);
    day.setDate(day.getDate() + days);
    return day.setHours(REMINDER_HOUR, 0, 0, 0);
}

export const remindTomorrow = (now: number) => morningIn(1, now);
export const remindNextWeek = (now: number) => morningIn(7, now);

/** Due: its day has come. It stays due (under Waiting) until it's opened or its reminder is changed. */
export function isReminderDue(tab: SavedTab, now: number): boolean {
    return tab.remindAt !== undefined && tab.remindAt <= now && tab.archivedAt === undefined;
}

/** The reminders still to be sent: each is sent once, however often the worker wakes. */
export function remindersToSend(tabs: SavedTab[], now: number): SavedTab[] {
    return tabs.filter((t) => isReminderDue(t, now) && !t.reminded);
}

/** When the next reminder is to be sent. Null: none is waiting to be. */
export function nextReminderAt(tabs: SavedTab[]): number | null {
    const times = tabs.filter((t) => t.remindAt !== undefined && t.archivedAt === undefined && !t.reminded).map((t) => t.remindAt!);
    return times.length ? Math.min(...times) : null;
}
