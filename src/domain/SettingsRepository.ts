import type { ThemeChoice } from "../types";
import { getSettings, setSettings } from "../storage/chromeStorage";
import { withStorageLock } from "../storage/writeQueue";

export const MIN_OUTDATED_DAYS = 1;
export const MAX_OUTDATED_DAYS = 365;
const FALLBACK_OUTDATED_DAYS = 7;

/** The one-field settings changes Settings › General makes; each is a full read-modify-write under the storage lock. */
async function update(change: (settings: Awaited<ReturnType<typeof getSettings>>) => void): Promise<void> {
    return withStorageLock(async () => {
        const settings = await getSettings();
        change(settings);
        await setSettings(settings);
    });
}

export function setTheme(theme: ThemeChoice): Promise<void> {
    return update((s) => {
        s.theme = theme;
    });
}

export function setOutdatedEnabled(enabled: boolean): Promise<void> {
    return update((s) => {
        s.outdatedEnabled = enabled;
    });
}

/** Whatever was typed becomes a whole number of days between 1 and 365 (7 if it isn't a number at all). */
export function clampOutdatedDays(raw: string | number): number {
    const n = typeof raw === "number" ? raw : parseInt(raw, 10);
    if (!Number.isFinite(n)) return FALLBACK_OUTDATED_DAYS;
    return Math.max(MIN_OUTDATED_DAYS, Math.min(MAX_OUTDATED_DAYS, Math.round(n)));
}

export function setOutdatedDays(days: number): Promise<void> {
    const clamped = clampOutdatedDays(days);
    return update((s) => {
        s.outdatedDays = clamped;
    });
}
