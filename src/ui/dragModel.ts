/**
 * Pure rules of dragging a row in a list (the tab list, Settings › Categories): which row and
 * which half of it the pointer is over, and how fast the list scrolls at its edges. The
 * browser-facing part is usePointerDrag.ts.
 */

/** Which half of a row a dragged one is over: it lands above the row, or below it. */
export type DropSide = "before" | "after";

/** A row as it stood when last measured: from `top` to `bottom`, in the list's own (scrolled) coordinates. */
export interface RowBox {
    key: string;
    top: number;
    bottom: number;
}

export interface Pointed {
    key: string;
    side: DropSide;
}

/**
 * The row the pointer at `y` is over, and which half: rows given top to bottom, each owning half
 * of the gap on either side of it, so there's no dead space between them (above the first row
 * counts as its top half, below the last as its bottom half). Null over `own` itself, the place
 * the dragged row holds right now: letting go there changes nothing.
 */
export function pointedAt(rows: RowBox[], y: number, own: string): Pointed | null {
    const at = rows.findIndex((row, i) => i === rows.length - 1 || y < (row.bottom + rows[i + 1].top) / 2);
    const row = rows[at];
    if (!row || row.key === own) return null;
    return { key: row.key, side: y < (row.top + row.bottom) / 2 ? "before" : "after" };
}

/** How near the list's top or bottom edge a dragged row starts it scrolling, and how fast at most. */
export const EDGE_SCROLL_ZONE = 48;
export const EDGE_SCROLL_MAX = 16;

/**
 * How far the list scrolls this frame while a row is dragged with the pointer at `y`, the list
 * showing from `top` to `bottom`: nothing away from the edges, faster the nearer the pointer gets
 * (and at full speed past them), up as a negative number, down as a positive one.
 */
export function edgeScrollSpeed(y: number, top: number, bottom: number): number {
    const zone = Math.min(EDGE_SCROLL_ZONE, (bottom - top) / 3);
    const into = (depth: number) => Math.ceil(EDGE_SCROLL_MAX * Math.min(1, depth / zone));
    if (y < top + zone) return -into(top + zone - y);
    if (y > bottom - zone) return into(y - (bottom - zone));
    return 0;
}

/** How far the pointer moves, pressed on a row, before it's a drag rather than a click. */
export const DRAG_THRESHOLD = 4;

/** Whether a press that has moved by (dx, dy) has become a drag. */
export function isDrag(dx: number, dy: number): boolean {
    return Math.hypot(dx, dy) >= DRAG_THRESHOLD;
}
