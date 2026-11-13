import { test, expect, SIDE_PANEL_URL, waitUntilReady } from "./fixtures";
import type { Page } from "@playwright/test";
import { row, rowTitles, seedLibrary, storedTabs } from "./helpers";

/**
 * Notes each row that starts sliding from somewhere else: its title, how far below its new place
 * it starts, and when (rows that start together share a time).
 */
const recordSlides = (popup: Page) =>
    popup.evaluate(() => {
        const w = window as unknown as { slides: [string, number, number][] };
        w.slides = [];
        const animate = Element.prototype.animate;
        Element.prototype.animate = function (keyframes, options) {
            const from = Array.isArray(keyframes) ? String((keyframes[0] as Keyframe | undefined)?.transform ?? "") : "";
            const by = /translateY\((-?[\d.]+)px\)/.exec(from);
            const title = this.querySelector("[data-row-title]")?.textContent ?? "";
            if (by && this.matches("li[data-tab-id]")) w.slides.push([title, Number(by[1]), performance.now()]);
            return animate.call(this, keyframes, options);
        };
    });
const slides = (popup: Page) => popup.evaluate(() => (window as unknown as { slides: [string, number, number][] }).slides);
/** The copy of the dragged row that follows the pointer: only drawn (hidden from assistive tech, so no role to find it by). */
const copyBox = (popup: Page) =>
    popup.evaluate(() => {
        const copy = document.body.querySelector(":scope > li[aria-hidden]");
        if (!copy) return null;
        const box = copy.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom };
    });

/** Presses on a row (where its drag handle shows on hover) and drags it to (x, y), still held. */
async function pickUp(popup: Page, title: string, to: { x: number; y: number }, steps = 6) {
    const box = (await row(popup, title).boundingBox())!;
    await popup.mouse.move(box.x + 22, box.y + 23);
    await popup.mouse.down();
    await popup.mouse.move(to.x, to.y, { steps });
}

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

    test("TC-050: before letting go, the rows make room where it will land; let go in the gap between two rows, and it lands there", async ({ popup }) => {
        const alpha = (await row(popup, "Alpha").boundingBox())!;
        const bravo = (await row(popup, "Bravo").boundingBox())!;
        await pickUp(popup, "Charlie", { x: alpha.x + 150, y: alpha.y + alpha.height - 6 });
        await popup.mouse.move(alpha.x + 150, (alpha.y + alpha.height + bravo.y) / 2, { steps: 2 });
        // Its place in the list (an empty one, while it's in hand) is already between them.
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Charlie", "Bravo"]);
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(["Alpha", "Bravo", "Charlie"]);
        await popup.mouse.up();
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Alpha", "Charlie", "Bravo"]);
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Charlie", "Bravo"]);
    });

    test("TC-050: the place it will land stays put while the pointer crosses from one row into the next", async ({ popup }) => {
        const alpha = (await row(popup, "Alpha").boundingBox())!;
        await pickUp(popup, "Charlie", { x: alpha.x + 150, y: alpha.y + alpha.height - 8 });
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Charlie", "Bravo"]);
        // From Alpha's lower half, across the gap, into the room made under it: one place all the way.
        const shown: string[] = [];
        const bravo = (await row(popup, "Bravo").boundingBox())!;
        for (let y = alpha.y + alpha.height - 8; y <= bravo.y - 8; y += 3) {
            await popup.mouse.move(alpha.x + 150, y);
            shown.push((await rowTitles(popup)).join(" "));
        }
        await popup.mouse.up();
        expect(new Set(shown)).toEqual(new Set(["Alpha Charlie Bravo"]));
    });

    test("TC-050: the row is picked up and follows the pointer, then settles into its place", async ({ popup }) => {
        const charlie = (await row(popup, "Charlie").boundingBox())!;
        await pickUp(popup, "Charlie", { x: charlie.x + 150, y: charlie.y - 30 });
        // Its copy, lifted, is where the pointer holds it; the row itself is the empty place.
        await expect.poll(async () => (await copyBox(popup))?.top).toBeLessThan(charlie.y - 20);
        const copy = (await copyBox(popup))!;
        expect(copy.top).toBeLessThan(charlie.y - 30 + 23 - 10 + 2);
        await popup.mouse.move(charlie.x + 150, charlie.y - 10, { steps: 3 });
        await expect.poll(async () => (await copyBox(popup))!.top).toBeGreaterThan(copy.top + 10);
        await popup.mouse.up();
        await expect.poll(() => copyBox(popup)).toBeNull();
        await expect(row(popup, "Charlie").getByRole("button", { name: "Charlie", exact: true })).toBeVisible();
    });

    test("TC-324: Escape puts it back, and so does leaving the window sideways", async ({ popup }) => {
        const alpha = (await row(popup, "Alpha").boundingBox())!;
        await pickUp(popup, "Charlie", { x: alpha.x + 150, y: alpha.y + 6 });
        await expect.poll(() => rowTitles(popup)).toEqual(["Charlie", "Alpha", "Bravo"]);
        await popup.keyboard.press("Escape");
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Bravo", "Charlie"]);
        await expect.poll(() => copyBox(popup)).toBeNull();
        // Escape went to the drag: the search box didn't take focus for it.
        await expect(popup.getByRole("textbox", { name: "Search saved tabs" })).not.toBeFocused();
        await popup.mouse.up();
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(["Alpha", "Bravo", "Charlie"]);

        await pickUp(popup, "Charlie", { x: alpha.x + 150, y: alpha.y + 6 });
        await expect.poll(() => rowTitles(popup)).toEqual(["Charlie", "Alpha", "Bravo"]);
        await popup.mouse.move(-20, alpha.y + 6, { steps: 4 });
        await expect.poll(() => rowTitles(popup)).toEqual(["Alpha", "Bravo", "Charlie"]);
        await popup.mouse.up();
        await expect.poll(() => copyBox(popup)).toBeNull();
        expect((await storedTabs(popup)).map((t) => t.title)).toEqual(["Alpha", "Bravo", "Charlie"]);
    });

    test("TC-324: let go outside the window, where the popup never hears it, and the next press still drags", async ({ popup }) => {
        const alpha = (await row(popup, "Alpha").boundingBox())!;
        await pickUp(popup, "Charlie", { x: alpha.x + 150, y: alpha.y + 6 });
        await expect.poll(() => rowTitles(popup)).toEqual(["Charlie", "Alpha", "Bravo"]);
        // Back in the window with the button already up: the next move says so (as Chrome reports it).
        await popup.evaluate(() => window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, pointerType: "mouse", buttons: 0, clientX: 150, clientY: 300 })));
        await expect.poll(() => copyBox(popup)).toBeNull();
        await popup.mouse.up();
        await row(popup, "Alpha").dragTo(row(popup, "Bravo"), { sourcePosition: { x: 22, y: 23 }, targetPosition: { x: 150, y: 40 } });
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title).indexOf("Alpha")).toBeGreaterThan(0);
    });

    test("TC-324: a drag that ends on a title doesn't open it; a click still does", async ({ popup }) => {
        const tabs = () => popup.evaluate(async () => (await chrome.tabs.query({})).length);
        const before = await tabs();
        const alpha = (await row(popup, "Alpha").boundingBox())!;
        // Picked up by its title and let go over the title of the row it now sits above.
        const title = (await row(popup, "Bravo").getByRole("button", { name: "Bravo", exact: true }).boundingBox())!;
        await popup.mouse.move(title.x + 30, title.y + 8);
        await popup.mouse.down();
        await popup.mouse.move(alpha.x + 30, alpha.y + 8, { steps: 4 });
        await popup.mouse.up();
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Bravo", "Alpha", "Charlie"]);
        await popup.waitForTimeout(300);
        expect(await tabs()).toBe(before);
        await row(popup, "Bravo").getByRole("button", { name: "Bravo", exact: true }).click();
        await expect.poll(tabs).toBe(before + 1);
    });

    test("TC-328: on a touchscreen, a row held still is picked up; a swipe isn't, and a tap still opens", async ({ popup }) => {
        const cdp = await popup.context().newCDPSession(popup);
        await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
        const touch = (type: "touchStart" | "touchMove" | "touchEnd", x = 0, y = 0) =>
            cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
        const tabs = () => popup.evaluate(async () => (await chrome.tabs.query({})).length);
        const before = await tabs();
        const alpha = (await row(popup, "Alpha").boundingBox())!;
        const charlie = (await row(popup, "Charlie").boundingBox())!;
        const [x, y] = [charlie.x + 250, charlie.y + 23];

        // A swipe: moving at once, the finger scrolls; nothing is picked up.
        await touch("touchStart", x, y);
        for (let i = 1; i <= 6; i++) await touch("touchMove", x, y - i * 12);
        await popup.waitForTimeout(400);
        expect(await copyBox(popup)).toBeNull();
        await touch("touchEnd");
        expect(await rowTitles(popup)).toEqual(["Alpha", "Bravo", "Charlie"]);

        // Held still a moment (a pixel or two of drift is fine): the row lifts; carried up, it lands there.
        await touch("touchStart", x, y);
        await touch("touchMove", x + 2, y + 1);
        await expect.poll(() => copyBox(popup)).not.toBeNull();
        for (let i = 1; i <= 8; i++) await touch("touchMove", x, y + ((alpha.y + 6 - y) * i) / 8);
        await expect.poll(() => rowTitles(popup)).toEqual(["Charlie", "Alpha", "Bravo"]);
        await touch("touchEnd");
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Charlie", "Alpha", "Bravo"]);
        await popup.waitForTimeout(300);
        expect(await tabs()).toBe(before);

        // A tap opens the tab, as ever.
        const title = (await row(popup, "Bravo").getByRole("button", { name: "Bravo", exact: true }).boundingBox())!;
        await touch("touchStart", title.x + 20, title.y + 8);
        await touch("touchEnd");
        await expect.poll(tabs).toBe(before + 1);
    });

    test("TC-323: the rows it passes slide aside to make room, and it slides into place", async ({ popup }) => {
        await recordSlides(popup);
        const alpha = (await row(popup, "Alpha").boundingBox())!;
        // In one move, straight to Alpha's upper half: one change of place.
        await pickUp(popup, "Charlie", { x: alpha.x + 150, y: alpha.y + 6 }, 1);
        await expect.poll(() => rowTitles(popup)).toEqual(["Charlie", "Alpha", "Bravo"]);
        // Its place comes up from two rows down; Alpha and Bravo each move down by one.
        await expect.poll(async () => (await slides(popup)).map(([title]) => title).sort()).toEqual(["Alpha", "Bravo", "Charlie"]);
        const by = Object.fromEntries((await slides(popup)).map(([title, from]) => [title, from]));
        expect(by.Charlie).toBeGreaterThan(0);
        expect(by.Alpha).toBeLessThan(0);
        // (To a pixel: the row under the pointer may still be lifting off its hover as it's picked up.)
        expect(Math.abs(by.Charlie! + by.Alpha! + by.Bravo!)).toBeLessThanOrEqual(1);
        await popup.mouse.up();
        await expect.poll(async () => (await storedTabs(popup)).map((t) => t.title)).toEqual(["Charlie", "Alpha", "Bravo"]);
        // Landing where it was shown, nothing moves again.
        await popup.waitForTimeout(300);
        expect(await slides(popup)).toHaveLength(3);
    });

    test("TC-323: with the system's reduce-motion setting, the rows just move", async ({ popup }) => {
        await popup.emulateMedia({ reducedMotion: "reduce" });
        await recordSlides(popup);
        await row(popup, "Charlie").dragTo(row(popup, "Alpha"), { sourcePosition: { x: 22, y: 23 }, targetPosition: { x: 150, y: 6 } });
        await expect.poll(() => rowTitles(popup)).toEqual(["Charlie", "Alpha", "Bravo"]);
        await expect.poll(() => copyBox(popup)).toBeNull();
        expect(await slides(popup)).toEqual([]);
    });

    test("TC-119: rows can't be dragged while searching", async ({ popup }) => {
        await popup.getByRole("textbox", { name: "Search saved tabs" }).fill("a");
        await expect(row(popup, "Alpha")).not.toHaveAttribute("data-draggable", "true");
        await popup.getByRole("button", { name: "Clear search" }).click();
        await expect(row(popup, "Alpha")).toHaveAttribute("data-draggable", "true");
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
            // Back into the list, away from the edge: it stops, and the tab lands where the room was made.
            await popup.mouse.move(grip.x + 150, main.y + main.height / 2, { steps: 4 });
            const stoppedAt = await scrolled(popup);
            await popup.waitForTimeout(300);
            expect(await scrolled(popup)).toBe(stoppedAt);
            await popup.mouse.up();
            await expect.poll(async () => (await storedTabs(popup)).findIndex((t) => t.title === "Tab 01")).toBeGreaterThan(10);
            // Picked up again, and the list scrolled by the wheel while it's held: its place moves with the list.
            await popup.locator("#main-view").evaluate((main) => (main.scrollTop = 0));
            const tab02 = (await row(popup, "Tab 02").boundingBox())!;
            await popup.mouse.move(tab02.x + 22, tab02.y + 23);
            await popup.mouse.down();
            await popup.mouse.move(tab02.x + 150, tab02.y + 60, { steps: 4 });
            const placeBefore = (await rowTitles(popup)).indexOf("Tab 02");
            await popup.mouse.wheel(0, 400);
            await expect.poll(async () => (await rowTitles(popup)).indexOf("Tab 02")).toBeGreaterThan(placeBefore + 4);
            await popup.keyboard.press("Escape");
            await popup.mouse.up();
            // Each time it moved on, only the rows in sight slid aside (TC-323), never the whole list.
            const at = new Map<number, number>();
            for (const [, , when] of await slides(popup)) at.set(when, (at.get(when) ?? 0) + 1);
            expect(at.size).toBeGreaterThan(0);
            expect(Math.max(...at.values())).toBeLessThan(TITLES.length / 2);
        });
    }
});
