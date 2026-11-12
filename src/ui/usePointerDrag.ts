import type { RefObject } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { edgeScrollSpeed, isDrag, pointedAt, type Pointed, type RowBox } from "./dragModel";

/** A row of the list, and the key its owner knows it by. */
export interface Keyed {
    key: string;
    el: HTMLElement;
}

export interface PointerDragOptions<T> {
    list: RefObject<HTMLElement | null>;
    /** The row a press on `target` would pick up, or null: nothing to drag there (or no dragging now). */
    pickUp: (target: Element) => Keyed | null;
    /** The rows a dragged one can be over, top to bottom (its own place among them). */
    targets: (list: HTMLElement) => Keyed[];
    /** The rows that slide into their new places; one inside another moves with it. */
    movers: (list: HTMLElement) => Keyed[];
    /** Where letting go over that half of that row would put the dragged one; null: it may not go there. */
    resolve: (dragged: string, at: Pointed) => T | null;
    same: (a: T, b: T) => boolean;
    /** Show the list as if the dragged row were let go at `to` (null: as it was before the drag). */
    onPreview: (dragged: string, to: T | null) => void;
    /**
     * Let go. `to` is the last place shown (null: it never left its own); `refused`: the pointer
     * was over a place it may not go, so it lands at the last one it may.
     */
    onDrop: (dragged: string, to: T | null, refused: boolean) => void;
    /** The dragged row's element, wherever the list now has it. */
    elementOf: (key: string) => HTMLElement | null;
    /** The look of the row in hand: a class added to its copy that follows the pointer. */
    liftClass: string;
}

interface Session<T> {
    key: string;
    el: HTMLElement;
    pointerId: number;
    startX: number;
    startY: number;
    started: boolean;
    /** The copy of the row that follows the pointer (the row itself stays in the list, as its empty place). */
    clone: HTMLElement | null;
    /** Where on the row it was grabbed, so the copy keeps that spot under the pointer. */
    grabY: number;
    left: number;
    height: number;
    scroller: HTMLElement | null;
    boxes: RowBox[];
    to: T | null;
    refused: boolean;
    pointerY: number;
    /** The pointer has left the window sideways: letting go puts the row back. */
    away: boolean;
    /** Where each row stood on screen just before the list changed, until it shows the change. */
    before: Map<string, number> | null;
    ending: boolean;
    frame: number;
    /** The list's scroll as of the last frame: scrolled since (by the edge, a wheel or a trackpad), the place under the pointer is looked for again. */
    scrolledTo: number;
    slides: Animation[];
    /** Once let go: ends the settling at once (a new press doesn't wait for it). */
    settled: (() => void) | null;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** How long the rows take to slide aside, and the row in hand to settle into its place. */
export const SLIDE_MS = 200;
const SETTLE_MS = 160;
/** A row this far above or below the list's visible part still slides: it's about to come into sight. */
const SLIDE_MARGIN = 80;
/** The row in hand, a little larger than the list's rows: picked up off it. */
const LIFT_SCALE = 1.02;

/**
 * Dragging a row to a new place, with the pointer (mouse or pen), in place of the browser's own
 * drag and drop: the row is picked up and follows the pointer, the other rows slide apart to
 * show where it will land, the list scrolls at its edges, Escape puts it back. Where it may land
 * is the owner's call (`resolve`); the owner shows the list in that order (`onPreview`), so what
 * the rows show is exactly where it lands. Rows are measured once each time the list changes,
 * never on every move, and moved only by transforms.
 */
export function usePointerDrag<T>(options: PointerDragOptions<T>) {
    const opts = useRef(options);
    opts.current = options;
    const [dragging, setDragging] = useState<string | null>(null);
    // Made once: the listeners it adds to the window are the ones it removes.
    const [engine] = useState(() => dragEngine(opts, setDragging));
    useLayoutEffect(() => engine.rendered());
    useEffect(() => engine.dispose, []);
    return {
        /** The key of the row in hand, from the moment it's picked up until it has settled. */
        dragging,
        onPointerDown: engine.onPointerDown,
        /** Puts the row back, as Escape does: the list changed under it. */
        cancel: engine.cancel,
    };
}

function dragEngine<T>(opts: { current: PointerDragOptions<T> }, setDragging: (key: string | null) => void) {
    const session: { current: Session<T> | null } = { current: null };

    /** Each row's box, in the scrolled list's own coordinates, so scrolling doesn't change them. */
    const measure = (s: Session<T>) => {
        const list = opts.current.list.current;
        if (!list) return;
        const { origin, scroll } = frameOf(s.scroller);
        s.boxes = opts.current.targets(list).map(({ key, el }) => {
            const box = el.getBoundingClientRect();
            return { key, top: box.top - origin + scroll, bottom: box.bottom - origin + scroll };
        });
    };

    const show = (s: Session<T>, to: T | null) => {
        const list = opts.current.list.current;
        s.before = list && !reducedMotion() ? screenTops(opts.current.movers(list)) : new Map();
        s.to = to;
        opts.current.onPreview(s.key, to);
        // Should the list not render again (nothing changed on screen), measure anyway.
        requestAnimationFrame(() => {
            if (session.current === s && s.before) afterRender(s);
        });
    };

    /** The place under the pointer now: shown, kept (over the row's own place), or refused. */
    const follow = (s: Session<T>) => {
        if (!s.started || s.ending || s.before) return;
        if (s.away) {
            s.refused = false;
            if (s.to !== null) show(s, null);
            return;
        }
        const { origin, scroll } = frameOf(s.scroller);
        const pointed = pointedAt(s.boxes, s.pointerY - origin + scroll, s.key);
        if (!pointed) {
            s.refused = false;
            return;
        }
        const to = opts.current.resolve(s.key, pointed);
        s.refused = !to;
        if (!to || (s.to !== null && opts.current.same(s.to, to))) return;
        show(s, to);
    };

    /** The list shows the change: each row slides from where it stood, and the boxes are measured again. */
    const afterRender = (s: Session<T>) => {
        const before = s.before;
        const list = opts.current.list.current;
        if (!before || !list) return;
        s.before = null;
        for (const slide of s.slides) slide.cancel();
        s.slides = [];
        measure(s);
        if (before.size > 0) s.slides = slide(list, opts.current.movers(list), before, s.scroller);
        follow(s);
    };


    const placeCopy = (s: Session<T>) => {
        if (!s.clone) return;
        const view = s.scroller?.getBoundingClientRect();
        const top = Math.max(view?.top ?? 0, 0) - s.height / 2;
        const bottom = Math.min(view?.bottom ?? window.innerHeight, window.innerHeight) - s.height / 2;
        const y = Math.max(top, Math.min(bottom, s.pointerY - s.grabY));
        s.clone.style.transform = `translate(0, ${y}px) scale(${LIFT_SCALE})`;
    };

    const start = (s: Session<T>) => {
        const list = opts.current.list.current;
        if (!list) return;
        s.started = true;
        s.scroller = scrollParent(list);
        const box = s.el.getBoundingClientRect();
        s.grabY = s.startY - box.top;
        s.left = box.left;
        s.height = box.height;
        measure(s);

        const clone = s.el.cloneNode(true) as HTMLElement;
        // A picture of the row, not a second one: nothing in it can be found as the row, or animate in.
        for (const el of [clone, ...clone.querySelectorAll<HTMLElement>("*")]) {
            for (const name of el.getAttributeNames()) if (name === "id" || name.startsWith("data-")) el.removeAttribute(name);
            el.style.animation = "none";
        }
        clone.setAttribute("aria-hidden", "true");
        clone.classList.add(opts.current.liftClass);
        Object.assign(clone.style, {
            position: "fixed",
            top: "0",
            left: `${box.left}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
            margin: "0",
            zIndex: "1000",
            pointerEvents: "none",
            transition: "none",
            transformOrigin: "center",
        });
        document.body.append(clone);
        s.clone = clone;
        placeCopy(s);

        // Rows under the pointer neither light up nor lift while it carries one; the drag decides.
        list.style.pointerEvents = "none";
        document.documentElement.style.cursor = "grabbing";
        document.documentElement.style.userSelect = "none";
        window.getSelection()?.removeAllRanges();
        setDragging(s.key);

        // Near the list's top or bottom edge, or past it, the list scrolls, and the place under the
        // pointer changes with it even while the pointer rests.
        s.scrolledTo = s.scroller?.scrollTop ?? 0;
        s.frame = requestAnimationFrame(function scroll() {
            if (s.scroller) {
                const view = s.scroller.getBoundingClientRect();
                const speed = s.away ? 0 : edgeScrollSpeed(s.pointerY, Math.max(view.top, 0), Math.min(view.bottom, window.innerHeight));
                if (speed) s.scroller.scrollTop += speed;
                if (s.scroller.scrollTop !== s.scrolledTo) {
                    s.scrolledTo = s.scroller.scrollTop;
                    follow(s);
                }
            }
            s.frame = requestAnimationFrame(scroll);
        });
    };

    const stopListening = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey, true);
        window.removeEventListener("blur", onCancel);
        window.removeEventListener("dragstart", noNativeDrag, true);
    };

    /** Done: the row in hand settles into its place (the new one, or back), then the list is its own again. */
    const finish = (dropped: boolean) => {
        const s = session.current;
        if (!s) return;
        stopListening();
        if (!s.started) {
            session.current = null;
            return;
        }
        s.ending = true;
        cancelAnimationFrame(s.frame);
        const list = opts.current.list.current;
        if (list) list.style.removeProperty("pointer-events");
        document.documentElement.style.removeProperty("cursor");
        document.documentElement.style.removeProperty("user-select");
        if (dropped) opts.current.onDrop(s.key, s.to, s.refused);
        else if (s.to !== null) show(s, null);

        let over = false;
        const done = () => {
            if (over) return;
            over = true;
            s.settled = null;
            s.clone?.remove();
            if (session.current === s) session.current = null;
            setDragging(null);
        };
        s.settled = done;
        // Once the list shows where it went.
        requestAnimationFrame(() => {
            if (s.before) afterRender(s);
            // Its place as laid out, not as it stands mid-slide: where it will be when the slide ends.
            const own = s.boxes.find((box) => box.key === s.key);
            const place = opts.current.elementOf(s.key)?.getBoundingClientRect();
            if (!s.clone || !place || !own || reducedMotion()) return done();
            const { origin, scroll } = frameOf(s.scroller);
            const settle = s.clone.animate(
                [
                    { transform: s.clone.style.transform, width: s.clone.style.width },
                    { transform: `translate(${place.left - s.left}px, ${own.top - scroll + origin}px) scale(1)`, width: `${place.width}px` },
                ],
                { duration: SETTLE_MS, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" }
            );
            void settle.finished.catch(() => undefined).then(done);
        });
    };

    function onMove(e: PointerEvent) {
        const s = session.current;
        if (!s || e.pointerId !== s.pointerId || s.ending) return;
        // Let go where the window never heard of it (outside the popup): a release all the same.
        if (e.buttons === 0) return onUp(e);
        if (!s.started) {
            if (!isDrag(e.clientX - s.startX, e.clientY - s.startY)) return;
            start(s);
        }
        s.pointerY = e.clientY;
        s.away = e.clientX < 0 || e.clientX > window.innerWidth;
        placeCopy(s);
        follow(s);
    }

    function onUp(e: PointerEvent) {
        const s = session.current;
        if (!s || e.pointerId !== s.pointerId) return;
        // The press was a drag, not a click: the click that follows it opens nothing.
        if (s.started) swallowNextClick();
        finish(true);
    }

    function onCancel() {
        finish(false);
    }

    function onKey(e: KeyboardEvent) {
        if (e.key !== "Escape" || !session.current?.started) return;
        e.preventDefault();
        e.stopPropagation();
        finish(false);
    }

    const onPointerDown = (e: PointerEvent) => {
        if (e.button !== 0 || e.pointerType === "touch") return;
        // The last one still settling into place: it's there now. One whose release never arrived
        // (let go outside the window) is over: it goes back.
        session.current?.settled?.();
        if (session.current && !session.current.ending) finish(false);
        session.current?.settled?.();
        if (session.current) return;
        const target = e.target as Element;
        // Typing and menus keep the pointer for themselves.
        if (target.closest("input, textarea, select, form, [role='menu']")) return;
        const picked = opts.current.pickUp(target);
        if (!picked) return;
        session.current = {
            key: picked.key,
            el: picked.el,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            started: false,
            clone: null,
            grabY: 0,
            left: 0,
            height: 0,
            scroller: null,
            boxes: [],
            to: null,
            refused: false,
            pointerY: e.clientY,
            away: false,
            before: null,
            ending: false,
            frame: 0,
            scrolledTo: 0,
            slides: [],
            settled: null,
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onCancel);
        window.addEventListener("keydown", onKey, true);
        window.addEventListener("blur", onCancel);
        // A press on the site icon or a link would otherwise start the browser's own drag of it.
        window.addEventListener("dragstart", noNativeDrag, true);
    };

    return {
        onPointerDown,
        cancel: () => finish(false),
        /** The list has rendered: if it was to show a change, it does now. */
        rendered: () => {
            const s = session.current;
            if (s?.before) afterRender(s);
        },
        dispose: () => {
            const s = session.current;
            stopListening();
            if (!s) return;
            cancelAnimationFrame(s.frame);
            s.clone?.remove();
            document.documentElement.style.removeProperty("cursor");
            document.documentElement.style.removeProperty("user-select");
        },
    };
}

function noNativeDrag(e: DragEvent) {
    e.preventDefault();
}

function swallowNextClick() {
    const swallow = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.removeEventListener("click", swallow, true);
    };
    window.addEventListener("click", swallow, true);
    setTimeout(() => window.removeEventListener("click", swallow, true), 0);
}

/** The element that scrolls the list: in the popup and the side panel, the main area around it. */
export function scrollParent(el: HTMLElement | null): HTMLElement | null {
    for (let at = el?.parentElement ?? null; at; at = at.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(at).overflowY)) return at;
    }
    return null;
}

function frameOf(scroller: HTMLElement | null): { origin: number; scroll: number } {
    return scroller ? { origin: scroller.getBoundingClientRect().top, scroll: scroller.scrollTop } : { origin: 0, scroll: window.scrollY };
}

/** Where each row stands on screen now, a slide under way included. */
function screenTops(rows: Keyed[]): Map<string, number> {
    return new Map(rows.map(({ key, el }) => [key, el.getBoundingClientRect().top]));
}

/**
 * Each row that moved starts where it stood (`before`) and slides to where it is now. A row inside
 * another (a tab in a saved window) moves with it, so only its own move within it is its to show.
 * Rows out of sight both before and after don't slide: in a list of hundreds, a long move would
 * start hundreds of slides nobody sees.
 */
export function slide(list: HTMLElement, rows: Keyed[], before: Map<string, number>, scroller: HTMLElement | null): Animation[] {
    const after = screenTops(rows);
    const keyOf = new Map(rows.map(({ key, el }) => [el, key]));
    const moved = (key: string) => (before.get(key) ?? after.get(key)!) - after.get(key)!;
    const view = (scroller ?? list).getBoundingClientRect();
    const top = Math.max(view.top, 0) - SLIDE_MARGIN;
    const bottom = Math.min(view.bottom, window.innerHeight) + SLIDE_MARGIN;
    const inSight = (y: number) => y >= top && y <= bottom;
    const slides: Animation[] = [];
    for (const { key, el } of rows) {
        if (!before.has(key) || !(inSight(before.get(key)!) || inSight(after.get(key)!))) continue;
        let parent = el.parentElement;
        while (parent && parent !== list && !keyOf.has(parent)) parent = parent.parentElement;
        const by = moved(key) - (parent && keyOf.has(parent) ? moved(keyOf.get(parent)!) : 0);
        if (Math.abs(by) < 1) continue;
        slides.push(el.animate([{ transform: `translateY(${by}px)` }, { transform: "none" }], { duration: SLIDE_MS, easing: "cubic-bezier(0.2, 0, 0, 1)" }));
    }
    return slides;
}
