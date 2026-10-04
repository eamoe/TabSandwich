import { test, expect } from "./fixtures";
import { seedLibrary } from "./helpers";

// The theme choice itself gets its control in Settings later in v3.0; this pins how a stored
// choice reaches the page, which everything else about light and dark builds on.
test.describe("Theme", () => {
    test("follows the system by default, so nothing is pinned on the page", async ({ popup }) => {
        await seedLibrary(popup, []);
        await expect(popup.locator("html")).not.toHaveAttribute("data-theme");
    });

    test("an explicit choice is applied before the popup reports ready", async ({ popup }) => {
        await seedLibrary(popup, [], { theme: "dark" });
        await expect(popup.locator("html")).toHaveAttribute("data-theme", "dark");
    });

    test("a pinned theme wins over the system setting", async ({ popup }) => {
        await popup.emulateMedia({ colorScheme: "dark" });
        await seedLibrary(popup, [], { theme: "light" });
        await expect(popup.locator("html")).toHaveAttribute("data-theme", "light");
        expect(await popup.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--surface").trim())).toBe("#FFFFFF");
    });

    test("TC-193: an open popup follows the computer switching to dark mode, without reopening", async ({ popup }) => {
        await popup.emulateMedia({ colorScheme: "light" });
        await seedLibrary(popup, []);
        const surface = () => popup.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--surface").trim());
        expect(await surface()).toBe("#FFFFFF");
        await popup.emulateMedia({ colorScheme: "dark" });
        expect(await surface()).toBe("#1A1724");
    });

    test("System uses the dark colors when the computer is in dark mode", async ({ popup }) => {
        await popup.emulateMedia({ colorScheme: "dark" });
        await seedLibrary(popup, []);
        expect(await popup.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--surface").trim())).toBe("#1A1724");
    });
});
