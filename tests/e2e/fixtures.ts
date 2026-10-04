import { test as base, chromium, type BrowserContext, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../dist");

/**
 * A public key used ONLY by the test copy of the extension, never the shipped manifest (the
 * Chrome Web Store assigns the real one). Chrome derives an unpacked extension's id from its
 * manifest key, so pinning one gives the tests a known id to open the popup at — this
 * extension has no background service worker, which is where Playwright would otherwise read
 * the id from. The matching private key was discarded; Chrome doesn't need it to load the
 * extension unpacked.
 */
const TEST_KEY =
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvyZ2SdtX2G1h8k0mMiu5EQ/cA9NHzrkKohK5Xw1hHiI2G7lchPfjNoqjn8q+j8oOeFWLqN4CRDoEXiHIRM9SjNww47E90b4RFukr5k3TQMn/HFVqDvrvxgYsusmYi6i9OH0eQIQfQQtX1MQ7iABljNWS12QNaHZIDgn4MdUt3h99xDh6h5F+ry+JSRxsrZPAatIbLf7f2G3hf1BNW/uM6QGtCeK4C1Mq8PUYk1oStM9AVFzRW1Okt5W1k10t+RSOLznWXce2nnRJtbHRvn1aRmJXj2hnp1TeBmmM9XWh0xh0zcQFW2B84GnbJz2EpJgIutKrOv1ZKEgqWNqlrlObiwIDAQAB";

/** Chrome's own id scheme: first 128 bits of SHA-256 over the DER public key, each hex digit 0-f mapped to a-p. */
function extensionIdFromKey(base64Key: string): string {
    const digest = createHash("sha256").update(Buffer.from(base64Key, "base64")).digest("hex");
    return [...digest.slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
}

export const EXTENSION_ID = extensionIdFromKey(TEST_KEY);
export const POPUP_URL = `chrome-extension://${EXTENSION_ID}/popup/popup.html`;

/** A fake website the tests can "visit" with no network: every request to it is answered here. */
export const TEST_SITE = "https://example.test";

type Fixtures = {
    context: BrowserContext;
    popup: Page;
};

export const test = base.extend<Fixtures>({
    // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring form
    context: async ({}, use) => {
        if (!readFileSyncSafe(join(DIST, "manifest.json"))) {
            throw new Error("dist/ is missing — run `pnpm build` before the robot tests.");
        }
        // Tested build === shipped build: copy dist/ as-is and change only the manifest, in two
        // test-only ways. `key` pins the id (see TEST_KEY). `host_permissions` for the fake test
        // site stands in for `activeTab`: a real user opens the popup from the toolbar, which is
        // what grants activeTab and lets "Save Tab" read the current page's URL and title. A test
        // can't click the toolbar, so it's given access to the fake site's tabs instead — the
        // same access activeTab would grant, limited to pages that exist only inside the tests.
        const extDir = mkdtempSync(join(tmpdir(), "tab-sandwich-ext-"));
        cpSync(DIST, extDir, { recursive: true });
        const manifest = JSON.parse(readFileSync(join(extDir, "manifest.json"), "utf8"));
        writeFileSync(
            join(extDir, "manifest.json"),
            JSON.stringify({ ...manifest, key: TEST_KEY, host_permissions: [`${TEST_SITE}/*`] }, null, 2)
        );

        const userDataDir = mkdtempSync(join(tmpdir(), "tab-sandwich-profile-"));
        const context = await chromium.launchPersistentContext(userDataDir, {
            // The full Chromium build (not the stripped headless shell) is what can load extensions headless.
            channel: "chromium",
            viewport: { width: 380, height: 580 },
            args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
        });
        await context.route(`${TEST_SITE}/**`, (route) => {
            const path = new URL(route.request().url()).pathname;
            const title = decodeURIComponent(path.slice(1)) || "Test site home";
            return route.fulfill({
                contentType: "text/html",
                body: `<!doctype html><title>${title}</title><h1>${title}</h1>`,
            });
        });

        await use(context);

        await context.close();
        rmSync(userDataDir, { recursive: true, force: true });
        rmSync(extDir, { recursive: true, force: true });
    },

    popup: async ({ context }, use) => {
        const page = await context.newPage();
        await page.goto(POPUP_URL);
        await waitUntilReady(page);
        await use(page);
    },
});

/** The popup marks itself ready once startup has finished and every control is wired up (see src/popup.ts). */
export async function waitUntilReady(page: Page): Promise<void> {
    await page.locator("body[data-ready='true']").waitFor({ state: "attached" });
}

function readFileSyncSafe(path: string): string | null {
    try {
        return readFileSync(path, "utf8");
    } catch {
        return null;
    }
}

export { expect } from "@playwright/test";
