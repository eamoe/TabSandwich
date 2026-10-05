import { describe, expect, it } from "vitest";
import { releaseOf, whatsNewToShow } from "../../src/domain/whatsNew";

const notes = ["3.1"];
const show = (current: string, lastSeen: string | undefined, freshInstall = false) => whatsNewToShow({ current, lastSeen, freshInstall, notes });

describe("What's new", () => {
    it("belongs to a feature release, not a patch release", () => {
        expect(releaseOf("3.1.4")).toBe("3.1");
        expect(releaseOf("10.0.0")).toBe("10.0");
    });

    it("shows after updating to a release that has a note", () => {
        expect(show("3.1.0", "3.0.0")).toBe("3.1");
        expect(show("3.1.2", "2.2.0")).toBe("3.1");
    });

    it("shows when updating from a version that kept no record of what you'd seen", () => {
        expect(show("3.1.0", undefined)).toBe("3.1");
    });

    it("never shows on a fresh install", () => {
        expect(show("3.1.0", undefined, true)).toBeNull();
    });

    it("doesn't come back once seen, including after a patch release", () => {
        expect(show("3.1.0", "3.1.0")).toBeNull();
        expect(show("3.1.2", "3.1.0")).toBeNull();
    });

    it("compares versions as numbers, not text", () => {
        expect(whatsNewToShow({ current: "3.10.0", lastSeen: "3.9.0", freshInstall: false, notes: ["3.10"] })).toBe("3.10");
        expect(whatsNewToShow({ current: "3.9.0", lastSeen: "3.10.0", freshInstall: false, notes: ["3.9"] })).toBeNull();
    });

    it("shows nothing for a release without a note", () => {
        expect(show("3.2.0", "3.1.0")).toBeNull();
    });
});
