import { readFileSync } from "node:fs";
import { test } from "@playwright/test";

/**
 * Not a test: renders the extension's icons (images/icon-*.png) from the drawings in branding/.
 * The 16 and 32 px icons have their own drawings, lined up with whole pixels, because a scaled-down
 * 128 px drawing goes soft at toolbar size. Run `pnpm icons` after changing a drawing, then look
 * at the result in a light and a dark toolbar before committing.
 */
const ICONS = [
    { size: 16, source: "branding/icon-16.svg" },
    { size: 32, source: "branding/icon-32.svg" },
    { size: 48, source: "branding/icon.svg" },
    { size: 128, source: "branding/icon.svg" },
];

test("extension icons", async ({ page }) => {
    test.skip(!process.env.TS_RENDER_ICONS, "Run through `pnpm icons`.");
    for (const { size, source } of ICONS) {
        const svg = readFileSync(source, "utf8").replace(/ width="\d+" height="\d+"/, ` width="${size}" height="${size}"`);
        await page.setViewportSize({ width: size, height: size });
        await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
        await page.screenshot({ path: `images/icon-${size}.png`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    }
});
