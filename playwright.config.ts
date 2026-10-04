import { defineConfig } from "@playwright/test";

/**
 * Robot-user tests: a real Chromium loads the built extension from dist/ and the tests click
 * through the popup the way a person would. Run `pnpm build` first — the tests deliberately
 * exercise the exact files that get shipped.
 */
export default defineConfig({
    testDir: "tests/e2e",
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    use: {
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
});
