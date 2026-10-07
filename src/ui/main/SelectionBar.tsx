import type { PickerOption } from "../CategoryPicker";
import { Icon } from "../Icon";
import { strings } from "../strings";
import controls from "../controls.module.css";
import sortStyles from "./SortMenu.module.css";
import styles from "./SelectionBar.module.css";

/** At the end of the filter row: turns choosing several tabs on, and (as ✕) off again. */
export function SelectButton(props: { active: boolean; onToggle: () => void }) {
    return (
        <div class={sortStyles.wrap}>
            <button
                type="button"
                class={props.active ? `${sortStyles.button} ${sortStyles.active}` : sortStyles.button}
                aria-label={props.active ? strings.stopSelecting : strings.selectTabs}
                title={props.active ? strings.stopSelectingTooltip : strings.selectTooltip}
                aria-pressed={props.active}
                onClick={props.onToggle}
            >
                <Icon name={props.active ? "close" : "select"} size={14} />
            </button>
        </div>
    );
}

/**
 * Takes the filter row's place while selecting, at exactly its height, so the popup never
 * changes size: how many are picked, Select all, Move to a category, Delete, and ✕ to stop.
 * Moving and deleting each take one step and one Undo, and end selecting.
 */
export function SelectionBar(props: {
    count: number;
    moveOptions: PickerOption[];
    onSelectAll: () => void;
    onMove: (category: string) => void;
    onDelete: () => void;
    onStop: () => void;
}) {
    const none = props.count === 0;
    return (
        // A landmark, like the filter row it stands in for.
        <nav class={styles.bar} aria-label={strings.selectionBarLabel}>
            <div class={styles.main}>
                <p class={styles.count} role="status" aria-live="polite">
                    {strings.selectedCount(props.count)}
                </p>
                <button type="button" class={styles.link} title={strings.selectAllTooltip} onClick={props.onSelectAll}>
                    {strings.selectAll}
                </button>
                <span class={styles.spacer} />
                <label for="move-selected" class="visually-hidden">
                    {strings.moveToLabel}
                </label>
                {/* A "Move to…" prompt that's never itself a choice: picking a category moves straight away. */}
                <span class={styles.moveWrap}>
                    <select
                        id="move-selected"
                        class={styles.move}
                        value=""
                        disabled={none}
                        onChange={(e) => {
                            const category = e.currentTarget.value;
                            e.currentTarget.value = "";
                            if (category) props.onMove(category);
                        }}
                    >
                        <option value="" disabled>
                            {strings.moveTo}
                        </option>
                        {props.moveOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    <span class={styles.chevron}>
                        <Icon name="chevronDown" size={12} />
                    </span>
                </span>
                <button
                    type="button"
                    class={`${controls.iconBtn} ${styles.delete}`}
                    aria-label={strings.deleteSelectedLabel(props.count)}
                    title={strings.deleteSelectedLabel(props.count)}
                    disabled={none}
                    onClick={props.onDelete}
                >
                    <Icon name="trash" size={14} />
                </button>
            </div>
            <SelectButton active onToggle={props.onStop} />
        </nav>
    );
}
