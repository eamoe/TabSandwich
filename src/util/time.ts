export function daysSince(timestampMs: number): number {
    return Math.floor((Date.now() - timestampMs) / (1000 * 60 * 60 * 24));
}

/** Which word a reminder's row shows: due already, later today, tomorrow, or a date further on. */
export function reminderDay(at: number, now: number): "due" | "today" | "tomorrow" | "later" {
    if (at <= now) return "due";
    const day = (t: number) => new Date(t).toDateString();
    if (day(at) === day(now)) return "today";
    return day(at) === day(new Date(now).setDate(new Date(now).getDate() + 1)) ? "tomorrow" : "later";
}

export function isOutdated(savedAt: number, enabled: boolean, thresholdDays: number): boolean {
    if (!enabled) return false;
    return daysSince(savedAt) >= thresholdDays;
}
