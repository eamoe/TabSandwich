import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editTab, markReminded, recordOpen } from "../../src/domain/TabRepository";
import { buildBackupFile, parseBackupFile } from "../../src/domain/backup";
import { isReminderDue, nextReminderAt, remindNextWeek, remindTomorrow, remindersToSend } from "../../src/domain/reminders";
import { DEFAULT_SETTINGS } from "../../src/storage/chromeStorage";
import { strings } from "../../src/ui/strings";
import { isTabAged, isTabOutdated } from "../../src/ui/main/listModel";
import { makeTab, seed, storedTabs } from "./helpers";

const NOW = new Date(2026, 10, 3, 23, 30).getTime();
const PAST = NOW - 1000;
const LATER = NOW + 1000;

describe("when a reminder comes", () => {
    const originalZone = process.env.TZ;
    afterEach(() => {
        process.env.TZ = originalZone;
    });

    it("is 9:00 on the calendar day, however late it was set", () => {
        const tomorrow = new Date(remindTomorrow(NOW));
        expect([tomorrow.getDate(), tomorrow.getHours(), tomorrow.getMinutes()]).toEqual([4, 9, 0]);
        expect(new Date(remindNextWeek(NOW)).getDate()).toBe(10);
    });

    it("stays at 9:00 across a clock change", () => {
        process.env.TZ = "Europe/Berlin";
        // Clocks went back on 25 Oct 2026, so that week is an hour longer than seven days of milliseconds.
        const before = new Date(2026, 9, 21, 20).getTime();
        expect(new Date(remindNextWeek(before)).getHours()).toBe(9);
        expect(new Date(remindNextWeek(before)).getDate()).toBe(28);
    });

    it("spans a month's and a year's end", () => {
        const end = new Date(remindTomorrow(new Date(2026, 11, 31, 10).getTime()));
        expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2027, 0, 1]);
    });

    it("names the day it's for, on a row", () => {
        const morning = new Date(2026, 10, 3, 7).getTime();
        expect(strings.reminderShort(PAST, NOW)).toBe("Due");
        expect(strings.reminderShort(new Date(2026, 10, 3, 9).getTime(), morning)).toBe("Today");
        expect(strings.reminderShort(remindTomorrow(NOW), NOW)).toBe("Tomorrow");
        expect(strings.reminderShort(remindNextWeek(NOW), NOW)).not.toMatch(/Due|Today|Tomorrow/);
    });
});

describe("which reminders are due", () => {
    it("counts a tab with one due, not one to come, nor an archived one", () => {
        expect(isReminderDue(makeTab({ remindAt: PAST }), NOW)).toBe(true);
        expect(isReminderDue(makeTab({ remindAt: LATER }), NOW)).toBe(false);
        expect(isReminderDue(makeTab(), NOW)).toBe(false);
        expect(isReminderDue(makeTab({ remindAt: PAST, archivedAt: 1 }), NOW)).toBe(false);
    });

    it("sends each once, and looks ahead only to what hasn't gone out", () => {
        const sent = makeTab({ remindAt: PAST, reminded: true });
        const due = makeTab({ remindAt: PAST });
        const soon = makeTab({ remindAt: LATER });
        const latest = makeTab({ remindAt: LATER + 5 });
        expect(remindersToSend([sent, due, soon], NOW)).toEqual([due]);
        expect(nextReminderAt([sent, latest, soon])).toBe(LATER);
        expect(nextReminderAt([sent, makeTab({ remindAt: LATER, archivedAt: 1 }), makeTab()])).toBeNull();
    });
});

describe("Waiting", () => {
    beforeEach(() => vi.useFakeTimers({ now: NOW }));
    afterEach(() => vi.useRealTimers());

    it("takes a due reminder even in a kept category, or pinned, without calling it aged", () => {
        const settings = { ...DEFAULT_SETTINGS, waitingCategories: [] };
        for (const tab of [makeTab({ remindAt: PAST }), makeTab({ remindAt: PAST, pinned: true })]) {
            expect(isTabOutdated(tab, settings)).toBe(true);
            expect(isTabAged(tab, settings)).toBe(false);
        }
        expect(isTabOutdated(makeTab({ remindAt: LATER }), settings)).toBe(false);
    });
});

describe("a tab's reminder over time", () => {
    beforeEach(() => vi.useFakeTimers({ now: NOW }));
    afterEach(() => vi.useRealTimers());

    it("is set, kept and removed from the edit form, and a new one can go out again", async () => {
        const tab = makeTab({ remindAt: PAST, reminded: true });
        seed([tab]);
        await editTab(tab.id, { note: "kept as it was" });
        expect(storedTabs()[0]).toMatchObject({ remindAt: PAST, reminded: true });
        await editTab(tab.id, { remindAt: LATER });
        expect(storedTabs()[0].remindAt).toBe(LATER);
        expect(storedTabs()[0].reminded).toBeUndefined();
        await editTab(tab.id, { remindAt: undefined });
        expect(storedTabs()[0]).not.toHaveProperty("remindAt");
    });

    it("ends when the tab is opened once it's due; opening sooner leaves it", async () => {
        const due = makeTab({ remindAt: PAST, reminded: true });
        const coming = makeTab({ remindAt: LATER });
        seed([due, coming]);
        await recordOpen([due.id, coming.id]);
        const [opened, early] = storedTabs();
        expect(opened).not.toHaveProperty("remindAt");
        expect(opened).not.toHaveProperty("reminded");
        expect(opened.openCount).toBe(1);
        expect(early.remindAt).toBe(LATER);
    });

    it("is marked sent once, however often the worker wakes", async () => {
        const tab = makeTab({ remindAt: PAST });
        seed([tab, makeTab({ remindAt: LATER })]);
        expect((await markReminded(NOW)).map((t) => t.id)).toEqual([tab.id]);
        expect(await markReminded(NOW)).toEqual([]);
        expect(storedTabs()[0].remindAt).toBe(PAST);
    });

    it("comes back with a backup, sent or not", () => {
        const file = buildBackupFile([makeTab({ remindAt: LATER }), makeTab({ remindAt: PAST, reminded: true })], DEFAULT_SETTINGS);
        const parsed = parseBackupFile(JSON.stringify(file));
        expect(parsed?.tabs.map((t) => [t.remindAt, t.reminded])).toEqual([[LATER, undefined], [PAST, true]]);
    });
});
