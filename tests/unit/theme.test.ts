// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { applyTheme } from "../../src/ui/theme";

describe("applyTheme", () => {
    afterEach(() => {
        delete document.documentElement.dataset.theme;
    });

    it.each(["light", "dark"] as const)("pins the page to %s when chosen explicitly", (choice) => {
        applyTheme(choice);
        expect(document.documentElement.dataset.theme).toBe(choice);
    });

    it("leaves System to the OS setting by removing any pinned theme", () => {
        applyTheme("dark");
        applyTheme("system");
        expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    });
});
