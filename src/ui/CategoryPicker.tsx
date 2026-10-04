import { Icon } from "./Icon";
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
}) {
    return (
        <div class={props.onSurface ? `${styles.picker} ${styles.onSurface}` : styles.picker}>
            <span class={`${controls.dot} ${styles.dot}`} style={{ background: props.color }} />
            <label for={props.id} class="visually-hidden">
                {props.label}
            </label>
            <select id={props.id} class={styles.select} value={props.value} onChange={(e) => props.onChange(e.currentTarget.value)}>
                {props.options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            <span class={styles.chevron}>
                <Icon name="chevronDown" size={12} />
            </span>
        </div>
    );
}
