import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(new URL("../../manifest.json", import.meta.url), "utf8"));

/**
 * Release gates from TESTING.md, checked on every change instead of by eye before a release.
 * A new permission must be a deliberate, visible decision (CLAUDE.md), so changing this list
 * means changing this test — and PRIVACY.md / PUBLISHING.md along with it.
 */
describe("manifest.json", () => {
    it("TC-103: asks for exactly the minimal permission set", () => {
        expect(manifest.permissions).toEqual(["activeTab", "storage", "favicon"]);
        // Asked for only when you first save a whole window (v3.2), never at install.
        expect(manifest.optional_permissions).toEqual(["tabs"]);
        expect(manifest.host_permissions).toBeUndefined();
    });

    it("TC-142 / TC-179: no downloads or unlimitedStorage permission", () => {
        expect(manifest.permissions).not.toContain("downloads");
        expect(manifest.permissions).not.toContain("unlimitedStorage");
    });

    it("exposes only the favicon cache to web pages", () => {
        expect(manifest.web_accessible_resources).toEqual([{ resources: ["_favicon/*"], matches: ["<all_urls>"] }]);
    });

    it("never ships a fixed extension key (the Store assigns the real id)", () => {
        expect(manifest.key).toBeUndefined();
    });
});
