import { Icon } from "../Icon";
import { strings } from "../strings";
import { ALL, OUTDATED, type FilterOption } from "./listModel";
import { UNCATEGORIZED } from "../../domain/CategoryRepository";
import controls from "../controls.module.css";
import styles from "./FilterPills.module.css";

export function FilterPills(props: {
    options: FilterOption[];
    active: string;
    colorOf: (category: string) => string;
    onSelect: (key: string) => void;
}) {
    return (
        <div class={styles.pills} role="group" aria-label={strings.filterLabel}>
            {props.options.map((o) => {
                const isCategory = o.key !== ALL && o.key !== OUTDATED;
                const label = o.key === ALL ? strings.all : o.key === OUTDATED ? strings.outdated : o.key;
                return (
                    <button
                        key={o.key}
                        type="button"
                        class={styles.pill}
                        aria-label={o.key === OUTDATED ? strings.outdatedPill(o.count) : label}
                        aria-pressed={o.key === props.active}
                        onClick={() => props.onSelect(o.key)}
                    >
                        {isCategory && <span class={controls.dot} style={{ background: props.colorOf(o.key) }} />}
                        {o.key === OUTDATED && <Icon name="moon" size={12} />}
                        <span>{o.key === UNCATEGORIZED ? UNCATEGORIZED : label}</span>
                        <span class={styles.count} aria-hidden="true">
                            {o.count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

export function StorageWarning(props: { pct: number; onSeeStorage: () => void }) {
    return (
        <div class={styles.warning} role="status">
            <Icon name="warning" size={14} />
            <span>{strings.storageNearlyFull(Math.round(props.pct))}</span>
            <button type="button" class={styles.warningLink} onClick={props.onSeeStorage}>
                {strings.seeStorage}
            </button>
        </div>
    );
}
