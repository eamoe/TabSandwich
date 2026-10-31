import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { Icon } from "../Icon";
import { strings } from "../strings";
import { useMenuPlacement } from "../useMenuPlacement";
import styles from "./Hero.module.css";
import menuStyles from "./SortMenu.module.css";

/**
 * The popup's way to everywhere else Tab Sandwich opens: one header button with the side panel
 * and the library behind it, so the header keeps its few everyday buttons. Both are places you
 * go once and stay, so a second click costs little.
 */
export function OpenMenu(props: { onOpenPanel: () => void; onOpenLibrary: () => void }) {
    const [open, setOpen] = useState(false);
    const button = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    useMenuPlacement(open, button, menu, 0, () => setOpen(false));

    useLayoutEffect(() => {
        if (!open) return;
        menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
        const outside = (e: PointerEvent) => {
            const target = e.target as Node;
            if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
        };
        document.addEventListener("pointerdown", outside);
        return () => document.removeEventListener("pointerdown", outside);
    }, [open]);

    const onMenuKey = (e: KeyboardEvent) => {
        const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
        const index = items.indexOf(document.activeElement as HTMLElement);
        const go = (i: number) => items[(i + items.length) % items.length]?.focus({ preventScroll: true });
        if (e.key === "ArrowDown") go(index + 1);
        else if (e.key === "ArrowUp") go(index - 1);
        else if (e.key === "Escape") {
            setOpen(false);
            button.current?.focus();
        } else if (e.key === "Tab") return setOpen(false);
        else return;
        e.preventDefault();
        e.stopPropagation();
    };

    // Called right in the click: Chrome only opens the side panel for one.
    const choose = (action: () => void) => () => {
        setOpen(false);
        action();
    };

    return (
        <>
            <button
                ref={button}
                type="button"
                class={styles.heroBtn}
                aria-label={strings.openIn}
                title={strings.openInTooltip}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                <Icon name="external" size={16} />
            </button>
            {open && (
                <div ref={menu} class={menuStyles.menu} role="menu" aria-label={strings.openIn} onKeyDown={onMenuKey}>
                    <button type="button" role="menuitem" class={menuStyles.item} onClick={choose(props.onOpenPanel)}>
                        <Icon name="panel" size={15} />
                        {strings.openSidePanel}
                    </button>
                    <button type="button" role="menuitem" class={menuStyles.item} onClick={choose(props.onOpenLibrary)}>
                        <Icon name="library" size={15} />
                        {strings.openLibrary}
                    </button>
                </div>
            )}
        </>
    );
}
