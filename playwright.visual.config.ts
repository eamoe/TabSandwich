import { defineConfig } from "@playwright/test";

/**
 * Approved screenshots: every screen of the built extension, in light and dark, compared pixel
 * for pixel with the pictures in tests/visual/__screenshots__. Any visual change shows up as a
 * failure with expected / actual / diff side by side in the report.
 *
 * Pixels only match on identical rendering, so this runs in one place only: Playwright's Docker
 * image (locally via `pnpm visual`, in CI via the same image). Change the approved pictures only
 * for an intended visual change, with `pnpm visual:update`, and show before/after in the PR.
 */
if (process.platform !== "linux") {
    throw new Error("The screenshot comparisons run in Docker so they match CI: use `pnpm visual` (or `pnpm visual:update`).");
}

export default defineConfig({
    testDir: "tests/visual",
    snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    expect: {
        // Strict: both sides always render in the same Docker image, so even a subtle color shift counts.
        toHaveScreenshot: { animations: "disabled", caret: "hide", scale: "css", threshold: 0.02, maxDiffPixelRatio: 0.001 },
    },
    use: { trace: "retain-on-failure" },
});
