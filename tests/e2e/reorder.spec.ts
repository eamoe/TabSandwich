import { test, expect, SIDE_PANEL_URL, waitUntilReady } from "./fixtures";
import type { Page } from "@playwright/test";
import { row, rowTitles, seedLibrary, storedTabs, tabList } from "./helpers";

/**
 * Notes each row that starts sliding from somewhere else: its title, and how far below its new
 * place it starts; and which ones slide above the others (`lifted`).
 */
const recordSlides = (popup: Page) =>
    popup.evaluate(() => {
        const w = window as unknown as { slides: [string, number][]; lifted: string[] };
        w.slides = [];
        w.lifted = [];
        const animate = Element.prototype.animate;
        Element.prototype.animate = function (keyframes, options) {
            const from = Array.isArray(keyframes) ? String((keyframes[0] as Keyframe | undefined)?.transform ?? "") : "";
            const by = /translateY\((-?[\d.]+)px\)/.exec(from);
            const title = this.querySelector("[data-row-title]")?.textContent ?? "";
            if (by && this.matches("li[data-tab-id]")) w.slides.push([title, Number(by[1])]);
            const slide = animate.call(this, keyframes, options);
            queueMicrotask(() => {
                if (this instanceof HTMLElement && this.style.zIndex) w.lifted.push(title);
            });
            return slide;
        };
    });
/** The insertion line, which is only drawn (no role or name to find it by). */
const lineShown = (popup: Page) => tabList(popup).evaluate((list) => !!list.querySelector('[class*="dropBefore"], [class*="dropAfter"]'));

test.describe("Drag to reorder", () => {
    test.beforeEach(async ({ popup }) => {
        await seedLibrary(popup, [
            { title: "Alpha", url: "https://alpha.example.com/" },
            { title: "Bravo", url: "https://bravo.example.com/" },
            { title: "Charlie", url: "https://charlie.example.com/" },
        ]);
        await popup.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
    });

    test("TC-050: dragging a row by its handle onto another moves it there, and it stays", async ({ popup }) => {
        // Grab where the drag handle appears on hover: the icon at the row's left edge. Dropped on
        // a row's upper half, it lands above that row.
        await row(popup, "Charlie").dragTo(row(popup, "Alpha"), { sourcePosition: { x: 22, y: 23 }, targetPosition: { x: 150, y: 6 } });
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Charlie", "Alpha", "Bravo"]);
        await expect.poll(() => rowTitles(popup)).toEqual(["Charlie", "Alpha", "Bravo"]);
    });

    test("TC-050: dropped on a row's lower half it lands below it, so the end of the list is reachable", async ({ popup }) => {
        await row(popup, "Alpha").dragTo(row(popup, "Charlie"), { sourcePosition: { x: 22, y: 23 }, targetPosition: { x: 150, y: 40 } });
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Bravo", "Charlie", "Alpha"]);
        await row(popup, "Alpha").dragTo(row(popup, "Charlie"), { sourcePosition: { x: 22, y: 23 }, targetPosition: { x: 150, y: 6 } });
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Bravo", "Alpha", "Charlie"]);
    });

    test("TC-050: let go on the line itself, in the gap between two rows, and the tab lands there", async ({ popup }) => {
        const alpha = (await row(popup, "Alpha").boundingBox())!;
        const bravo = (await row(popup, "Bravo").boundingBox())!;
        const grip = (await row(popup, "Charlie").boundingBox())!;
        await popup.mouse.move(grip.x + 22, grip.y + 23);
        await popup.mouse.down();
        await popup.mouse.move(alpha.x + 150, alpha.y + alpha.height - 6, { steps: 6 });
        await popup.mouse.move(alpha.x + 150, (alpha.y + alpha.height + bravo.y) / 2, { steps: 2 });
        await expect.poll(() => lineShown(popup)).toBe(true);
        await popup.mouse.up();
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Alpha", "Charlie", "Bravo"]);
    });

    test("TC-050: the line stays put while the pointer crosses from one row into the next", async ({ popup }) => {
        const alpha = (await row(popup, "Alpha").boundingBox())!;
        const bravo = (await row(popup, "Bravo").boundingBox())!;
        const grip = (await row(popup, "Charlie").boundingBox())!;
        await popup.mouse.move(grip.x + 22, grip.y + 23);
        await popup.mouse.down();
        await popup.mouse.move(alpha.x + 150, alpha.y + alpha.height - 8, { steps: 6 });
        await expect.poll(() => lineShown(popup)).toBe(true);
        // From Alpha's lower half, across the gap, into Bravo's upper half: one place, one line, all the way.
        const shown: boolean[] = [];
        for (let y = alpha.y + alpha.height - 8; y <= bravo.y + 8; y += 2) {
            await popup.mouse.move(alpha.x + 150, y);
            shown.push(await lineShown(popup));
        }
        await popup.mouse.up();
        expect(shown.every(Boolean)).toBe(true);
    });

    test("TC-050: the tab being dragged fades while it's carried, and comes back when let go", async ({ popup }) => {
        const charlie = row(popup, "Charlie");
        const grip = (await charlie.boundingBox())!;
        await popup.mouse.move(grip.x + 22, grip.y + 23);
        await popup.mouse.down();
        await popup.mouse.move(grip.x + 150, grip.y - 30, { steps: 6 });
        await expect.poll(() => charlie.evaluate((li) => Number(getComputedStyle(li).opacity))).toBeLessThan(0.6);
        await popup.mouse.up();
        await expect.poll(() => charlie.evaluate((li) => Number(getComputedStyle(li).opacity))).toBe(1);
    });

    test("TC-050: dragged off the list, the line goes, and letting go there moves nothing", async ({ popup }) => {
        const alpha = (await row(popup, "Alpha").boundingBox())!;
        const grip = (await row(popup, "Charlie").boundingBox())!;
        await popup.mouse.move(grip.x + 22, grip.y + 23);
        await popup.mouse.down();
        await popup.mouse.move(alpha.x + 150, alpha.y + 6, { steps: 6 });
        await expect.poll(() => lineShown(popup)).toBe(true);
        const search = (await popup.getByRole("textbox", { name: "Search saved tabs" }).boundingBox())!;
        await popup.mouse.move(search.x + 40, search.y + search.height / 2, { steps: 6 });
        await expect.poll(() => lineShown(popup)).toBe(false);
        await popup.mouse.up();
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Bravo", "Charlie"]);
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(["Alpha", "Bravo", "Charlie"]);
    });

    test("TC-323: a dropped tab slides into its new place, and so do the rows it passed", async ({ popup }) => {
        await recordSlides(popup);
        await row(popup, "Charlie").dragTo(row(popup, "Alpha"), { sourcePosition: { x: 22, y: 23 }, targetPosition: { x: 150, y: 6 } });
        await expect.poll(() => rowTitles(popup)).toEqual(["Charlie", "Alpha", "Bravo"]);
        // Charlie comes up from two rows down; Alpha and Bravo each move down by one.
        const slides = await popup.evaluate(() => (window as unknown as { slides: [string, number][] }).slides);
        expect(slides.map(([title]) => title).sort()).toEqual(["Alpha", "Bravo", "Charlie"]);
        const by = Object.fromEntries(slides);
        expect(by.Charlie).toBeGreaterThan(0);
        expect(by.Alpha).toBeLessThan(0);
        expect(Math.abs(by.Charlie! + by.Alpha! + by.Bravo!)).toBeLessThan(1);
        // Charlie passes over Alpha and Bravo, not under them.
        expect(await popup.evaluate(() => (window as unknown as { lifted: string[] }).lifted)).toEqual(["Charlie"]);
    });

    test("TC-323: with the system's reduce-motion setting, a dropped tab just moves", async ({ popup }) => {
        await popup.emulateMedia({ reducedMotion: "reduce" });
        await recordSlides(popup);
        await row(popup, "Charlie").dragTo(row(popup, "Alpha"), { sourcePosition: { x: 22, y: 23 }, targetPosition: { x: 150, y: 6 } });
        await expect.poll(() => rowTitles(popup)).toEqual(["Charlie", "Alpha", "Bravo"]);
        expect(await popup.evaluate(() => (window as unknown as { slides: unknown[] }).slides)).toEqual([]);
    });

    test("TC-119: rows can't be dragged while searching", async ({ popup }) => {
        await popup.getByRole("textbox", { name: "Search saved tabs" }).fill("a");
        await expect(row(popup, "Alpha")).not.toHaveAttribute("draggable", "true");
        await popup.getByRole("button", { name: "Clear search" }).click();
        await expect(row(popup, "Alpha")).toHaveAttribute("draggable", "true");
    });
});

test.describe("Drag to reorder, in a long list", () => {
    const TITLES = Array.from({ length: 40 }, (_, i) => `Tab ${String(i + 1).padStart(2, "0")}`);
    const scrolled = (popup: Page) => popup.locator("#main-view").evaluate((main) => main.scrollTop);

    for (const surface of ["popup", "side panel"] as const) {
        test(`TC-322: held near the list's bottom edge in the ${surface}, a dragged tab scrolls it, and lands past the rows that were in view`, async ({ popup }) => {
            await seedLibrary(popup, TITLES.map((title, i) => ({ title, url: `https://t${i + 1}.example.com/` })));
            if (surface === "side panel") {
                await popup.setViewportSize({ width: 360, height: 700 });
                await popup.goto(SIDE_PANEL_URL);
                await waitUntilReady(popup);
            }
            await popup.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
            await recordSlides(popup);
            const main = (await popup.locator("#main-view").boundingBox())!;
            // The list's bottom edge as seen: the main area may run on below the window.
            const edge = Math.min(main.y + main.height, popup.viewportSize()!.height) - 6;
            const grip = (await row(popup, "Tab 01").boundingBox())!;
            await popup.mouse.move(grip.x + 22, grip.y + 23);
            await popup.mouse.down();
            await popup.mouse.move(grip.x + 150, edge, { steps: 10 });
            // Held still at the edge (a hand never quite is: a pixel back and forth).
            for (let i = 0; i < 8; i++) {
                await popup.mouse.move(grip.x + 150 + (i % 2), edge);
                await popup.waitForTimeout(100);
            }
            expect(await scrolled(popup)).toBeGreaterThan(200);
            // Back into the list, away from the edge: it stops, and the tab lands where the line shows.
            await popup.mouse.move(grip.x + 150, main.y + main.height / 2, { steps: 4 });
            const stoppedAt = await scrolled(popup);
            await popup.waitForTimeout(300);
            expect(await scrolled(popup)).toBe(stoppedAt);
            await popup.mouse.up();
            await expect.poll(async () => (await storedTabs(popup)).findIndex((t) => t.title === "Tab 01")).toBeGreaterThan(10);
            // Every tab it passed moved up one, but only those in sight slid (TC-323).
            const passed = (await storedTabs(popup)).findIndex((t) => t.title === "Tab 01");
            const slid = await popup.evaluate(() => (window as unknown as { slides: unknown[] }).slides.length);
            expect(slid).toBeGreaterThan(0);
            expect(slid).toBeLessThan(passed);
        });
    }
});
