import { defineConfig } from "@playwright/test";

/**
 * Not a test: renders the Chrome Web Store screenshots (1280×800) into store-assets/ from the
 * built extension: each a headline next to the popup, the first also with the 3D logo
 * (store-assets/3d-branded-logo.png). Run `pnpm build && pnpm store:screenshots` on a Mac (marketing images use the
 * system fonts), then review the pictures before uploading them. Needs network access: it visits
 * each sample site once so the rows show real site icons.
 */
export default defineConfig({
    testDir: "tests/store",
    workers: 1,
    timeout: 120_000,
    reporter: "list",
});
