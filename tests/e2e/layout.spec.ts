import { test, expect } from "./fixtures";
import { seedLibrary, tabList } from "./helpers";

test.describe("Layout", () => {
    test("TC-190: with 25 saved tabs, at least 8 whole rows are visible at once", async ({ popup }) => {
        // Chrome opens a popup at most 600px tall.
        await popup.setViewportSize({ width: 380, height: 600 });
        await seedLibrary(
            popup,
            Array.from({ length: 25 }, (_, i) => ({ title: `Saved page ${i + 1}`, url: `https://site${i + 1}.example.com/`, category: "Work" }))
        );
        await popup.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
        const fullyVisible = await tabList(popup).evaluate((list) => {
            const box = list.parentElement!.getBoundingClientRect();
            return [...list.children].filter((li) => {
                const r = li.getBoundingClientRect();
                return r.top >= box.top && r.bottom <= Math.min(box.bottom, window.innerHeight);
            }).length;
        });
        expect(fullyVisible).toBeGreaterThanOrEqual(8);
    });

    test("TC-191: a warning appears on the main screen once storage is over 80% full", async ({ popup }) => {
        await seedLibrary(popup, [{ title: "Only tab", url: "https://a.example.com/" }]);
        await expect(popup.getByText(/Storage is \d+% full/)).toHaveCount(0);
        // Fill most of Chrome's allowance with filler data the extension doesn't read.
        await popup.evaluate(async () => {
            const quota = chrome.storage.local.QUOTA_BYTES;
            await chrome.storage.local.set({ filler: "x".repeat(Math.floor(quota * 0.85)) });
        });
        await popup.reload();
        await expect(popup.getByText(/Storage is 8\d% full\./)).toBeVisible();
        await popup.getByRole("button", { name: "See storage" }).click();
        await expect(popup.getByRole("main", { name: "Settings" })).toBeVisible();
    });
});
