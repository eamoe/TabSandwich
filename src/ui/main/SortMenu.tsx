import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { SortOrder } from "../../types";
import { Icon } from "../Icon";
import { useMenuPlacement } from "../useMenuPlacement";
import { strings } from "../strings";
import styles from "./SortMenu.module.css";

const ORDERS: SortOrder[] = ["custom", "newest", "oldest", "title", "site"];

/**
 * The sort button at the end of the filter row and its menu. The menu floats over the list, so
 * opening it never moves anything. While a sort other than your own order is on, the button
 * says which one, because it also turns drag-to-reorder off.
 */
export function SortMenu(props: { value: SortOrder; onChange: (sort: SortOrder) => void }) {
    const [open, setOpen] = useState(false);
    const button = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const wrap = useRef<HTMLDivElement>(null);
    // The menu's right edge lines up with the button's (the wrap's right padding).
    useMenuPlacement(open, wrap, menu, 6, () => setOpen(false));

    const close = (refocus: boolean) => {
        setOpen(false);
        if (refocus) button.current?.focus();
    };

    // Layout effects, so focus and the outside-click listener are in place the moment the menu
    // appears (a key pressed right after opening must already land in the menu).
    useLayoutEffect(() => {
        if (!open) return;
        // Without scrolling: the menu floats over the list, and a scroll would close it.
        menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
        const outside = (e: PointerEvent) => {
            const target = e.target as Node;
            if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
        };
        document.addEventListener("pointerdown", outside);
        return () => document.removeEventListener("pointerdown", outside);
    }, [open]);

    const onMenuKey = (e: KeyboardEvent) => {
        const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
        const index = items.indexOf(document.activeElement as HTMLElement);
        const go = (i: number) => items[(i + items.length) % items.length]?.focus({ preventScroll: true });
        if (e.key === "ArrowDown") go(index + 1);
        else if (e.key === "ArrowUp") go(index - 1);
        else if (e.key === "Home") go(0);
        else if (e.key === "End") go(items.length - 1);
        else if (e.key === "Escape") close(true);
        else if (e.key === "Tab") return setOpen(false);
        else return;
        e.preventDefault();
        e.stopPropagation();
    };

    const custom = props.value === "custom";
    return (
        <div ref={wrap} class={styles.wrap}>
            <button
                ref={button}
                type="button"
                class={custom ? styles.button : `${styles.button} ${styles.active}`}
                aria-label={strings.sortButton(strings.sortOptions[props.value])}
                title={strings.sortButton(strings.sortOptions[props.value])}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                <Icon name="sort" size={14} />
                {!custom && <span>{strings.sortShort[props.value]}</span>}
            </button>
            {open && (
                <div ref={menu} class={styles.menu} role="menu" aria-label={strings.sortMenuLabel} onKeyDown={onMenuKey}>
                    {ORDERS.map((order) => (
                        <button
                            key={order}
                            type="button"
                            role="menuitemradio"
                            aria-checked={order === props.value}
                            tabIndex={-1}
                            class={styles.item}
                            onClick={() => {
                                close(true);
                                if (order !== props.value) props.onChange(order);
                            }}
                        >
                            <span class={styles.check}>{order === props.value && <Icon name="check" size={14} />}</span>
                            {strings.sortOptions[order]}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
