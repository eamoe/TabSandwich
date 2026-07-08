export function daysSince(timestampMs: number): number {
    return Math.floor((Date.now() - timestampMs) / (1000 * 60 * 60 * 24));
}

export function isOutdated(savedAt: number, enabled: boolean, thresholdDays: number): boolean {
    if (!enabled) return false;
    return daysSince(savedAt) >= thresholdDays;
}
