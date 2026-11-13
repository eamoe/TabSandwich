import { describe, expect, it } from "vitest";
import { edgeScrollSpeed, EDGE_SCROLL_MAX, EDGE_SCROLL_ZONE, holdBroken, isDrag, pointedAt, type RowBox } from "../../src/ui/dragModel";

describe("which row a dragged one is over", () => {
    // Three rows 40 tall with 5 between them; "b" is the dragged one's own place.
    const rows: RowBox[] = [
        { key: "a", top: 0, bottom: 40 },
        { key: "b", top: 45, bottom: 85 },
        { key: "c", top: 90, bottom: 130 },
    ];

    it("is the row under the pointer, its upper or lower half", () => {
        expect(pointedAt(rows, 10, "b")).toEqual({ key: "a", side: "before" });
        expect(pointedAt(rows, 30, "b")).toEqual({ key: "a", side: "after" });
        expect(pointedAt(rows, 125, "b")).toEqual({ key: "c", side: "after" });
    });

    it("splits the gap between two rows, so there's no dead space", () => {
        expect(pointedAt(rows, 87, "a")).toEqual({ key: "b", side: "after" });
        expect(pointedAt(rows, 88, "a")).toEqual({ key: "c", side: "before" });
    });

    it("counts above the first row and below the last as their outer halves", () => {
        expect(pointedAt(rows, -300, "b")).toEqual({ key: "a", side: "before" });
        expect(pointedAt(rows, 900, "b")).toEqual({ key: "c", side: "after" });
    });

    it("is nothing over the dragged row's own place, or in an empty list", () => {
        expect(pointedAt(rows, 60, "b")).toBeNull();
        expect(pointedAt([], 60, "b")).toBeNull();
    });
});

describe("a press becoming a drag", () => {
    it("takes a few pixels of movement, in any direction", () => {
        expect(isDrag(0, 0)).toBe(false);
        expect(isDrag(2, 2)).toBe(false);
        expect(isDrag(0, 4)).toBe(true);
        expect(isDrag(-3, -3)).toBe(true);
    });
});

describe("scrolling while dragging", () => {
    const [top, bottom] = [100, 500];

    it("stays still away from the edges", () => {
        expect(edgeScrollSpeed(300, top, bottom)).toBe(0);
        expect(edgeScrollSpeed(top + EDGE_SCROLL_ZONE, top, bottom)).toBe(0);
        expect(edgeScrollSpeed(bottom - EDGE_SCROLL_ZONE, top, bottom)).toBe(0);
    });

    it("scrolls up near the top and down near the bottom, faster the nearer the edge", () => {
        const slowUp = edgeScrollSpeed(top + EDGE_SCROLL_ZONE - 4, top, bottom);
        const fastUp = edgeScrollSpeed(top + 2, top, bottom);
        expect(slowUp).toBeLessThan(0);
        expect(fastUp).toBeLessThan(slowUp);
        const slowDown = edgeScrollSpeed(bottom - EDGE_SCROLL_ZONE + 4, top, bottom);
        const fastDown = edgeScrollSpeed(bottom - 2, top, bottom);
        expect(slowDown).toBeGreaterThan(0);
        expect(fastDown).toBeGreaterThan(slowDown);
    });

    it("goes at full speed, never faster, with the pointer past an edge", () => {
        expect(edgeScrollSpeed(top - 200, top, bottom)).toBe(-EDGE_SCROLL_MAX);
        expect(edgeScrollSpeed(bottom + 200, top, bottom)).toBe(EDGE_SCROLL_MAX);
    });

    it("keeps the middle still in a short list, whose edge zones would otherwise meet", () => {
        expect(edgeScrollSpeed(150, 100, 200)).toBe(0);
        expect(edgeScrollSpeed(105, 100, 200)).toBeLessThan(0);
    });
});

describe("a finger holding a row", () => {
    it("keeps the drag on while it drifts a few pixels, and gives it up for a scroll past that", () => {
        expect(holdBroken(0, 0)).toBe(false);
        expect(holdBroken(3, 4)).toBe(false);
        expect(holdBroken(0, 6)).toBe(true);
    });
});
