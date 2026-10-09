import { Icon } from "./Icon";
import { strings } from "./strings";
import controls from "./controls.module.css";
import styles from "./CategoryPicker.module.css";

export interface PickerOption {
    value: string;
    label: string;
}

/** A native select (so keyboard and screen readers get the real thing) dressed with the chosen category's color dot. */
export function CategoryPicker(props: {
    id: string;
    label: string;
    value: string;
    options: PickerOption[];
    color: string;
    onChange: (value: string) => void;
    onSurface?: boolean;
    /** The value is a suggestion (src/domain/suggest.ts), not a choice yet: a small sparkle says so. */
    suggested?: boolean;
}) {
    return (
        <div class={`${styles.picker} ${props.onSurface ? styles.onSurface : ""} ${props.suggested ? styles.isSuggested : ""}`}>
            <span class={`${controls.dot} ${styles.dot}`} style={{ background: props.color }} />
            <label for={props.id} class="visually-hidden">
                {props.suggested ? strings.suggestedLabel(props.label) : props.label}
            </label>
            <select id={props.id} class={styles.select} value={props.value} onChange={(e) => props.onChange(e.currentTarget.value)}>
                {props.options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            {props.suggested && (
                <span class={styles.suggested} title={strings.suggestedTooltip} aria-hidden="true">
                    <Icon name="sparkle" size={12} />
                </span>
            )}
            <span class={styles.chevron}>
                <Icon name="chevronDown" size={12} />
            </span>
        </div>
    );
}
