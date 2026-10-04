import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysSince, isOutdated } from "../../src/util/time";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 4, 12);

describe("daysSince / isOutdated", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });
    afterEach(() => vi.useRealTimers());

    it("counts whole days only", () => {
        expect(daysSince(NOW)).toBe(0);
        expect(daysSince(NOW - DAY + 1)).toBe(0);
        expect(daysSince(NOW - DAY)).toBe(1);
        expect(daysSince(NOW - 10 * DAY)).toBe(10);
    });

    it("flags a tab exactly at the threshold, not before", () => {
        expect(isOutdated(NOW - 6 * DAY, true, 7)).toBe(false);
        expect(isOutdated(NOW - 7 * DAY, true, 7)).toBe(true);
    });

    it("never flags anything when the feature is off", () => {
        expect(isOutdated(NOW - 365 * DAY, false, 7)).toBe(false);
    });
});

