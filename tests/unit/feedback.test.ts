import { describe, expect, it } from "vitest";
import { feedbackUrl } from "../../src/util/feedback";

describe("feedbackUrl", () => {
    it("opens the form with the language and version filled in, and nothing else", () => {
        const url = new URL(feedbackUrl("de-AT", "4.1.0"));
        expect(url.origin + url.pathname).toBe("https://docs.google.com/forms/d/e/1FAIpQLSdM7DP88IJXLBv0JBhm13oeMTt3_75SdDT6RBob6sVzLWV1UQ/viewform");
        expect([...url.searchParams]).toEqual([
            ["usp", "pp_url"],
            ["entry.1844963166", "de-AT · 4.1.0"],
        ]);
    });

    it("spells it the way the form's own pre-filled link does", () => {
        expect(feedbackUrl("de", "4.1.0")).toBe(
            "https://docs.google.com/forms/d/e/1FAIpQLSdM7DP88IJXLBv0JBhm13oeMTt3_75SdDT6RBob6sVzLWV1UQ/viewform?usp=pp_url&entry.1844963166=de+%C2%B7+4.1.0"
        );
    });
});
