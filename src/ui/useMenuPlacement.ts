import type { RefObject } from "preact";
import { useLayoutEffect } from "preact/hooks";

/** How far a menu tucks over the edge of what it opens from, and keeps from the window's edge. */
const OVERLAP = 4;
const MARGIN = 6;

/**
 * Places a floating menu against the window, not inside the list: the popup is only as tall as
 * what it shows, so with one or two rows a menu hanging below them would be cut off by the
 * window's edge, and the scrolling list would clip it too. The menu opens below `anchor` when it
 * fits, above it when it doesn't, and scrolls inside itself if it fits neither way. Its right
 * edge sits `inset` px inside the anchor's. Scrolling that moves the anchor closes it, rather
 * than leaving it floating away from its button.
 *
 * The menu must be `position: fixed` with no top/bottom/right of its own, and nothing between it
 * and the page may have a transform while it's open (a transform would become its frame).
 */
export function useMenuPlacement(
    open: boolean,
    anchor: RefObject<HTMLElement | null>,
    menu: RefObject<HTMLElement | null>,
    inset: number,
    onScrollAway: () => void
): void {
    useLayoutEffect(() => {
        const el = menu.current;
        const box = anchor.current?.getBoundingClientRect();
        if (!open || !el || !box) return;
        const viewport = document.documentElement.clientHeight;
        el.style.right = `${document.documentElement.clientWidth - box.right + inset}px`;
        el.style.maxHeight = "";
        const height = el.offsetHeight;
        const below = viewport - (box.bottom - OVERLAP) - MARGIN;
        const above = box.top + OVERLAP - MARGIN;
        if (height <= below || below >= above) {
            el.style.top = `${box.bottom - OVERLAP}px`;
            el.style.bottom = "";
            if (height > below) el.style.maxHeight = `${below}px`;
        } else {
            el.style.top = "";
            el.style.bottom = `${viewport - box.top - OVERLAP}px`;
            if (height > above) el.style.maxHeight = `${above}px`;
        }
        // A scroll that carries the button away (the list scrolling under it) closes the menu; one
        // that leaves the button where it was (inside the menu, or a nudge of nothing) doesn't.
        const onScroll = () => {
            const now = anchor.current?.getBoundingClientRect();
            if (!now || Math.abs(now.top - box.top) > 1 || Math.abs(now.left - box.left) > 1) onScrollAway();
        };
        document.addEventListener("scroll", onScroll, true);
        return () => document.removeEventListener("scroll", onScroll, true);
    }, [open]);
}
