import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { addTab, type AddTabResult } from "../../domain/TabRepository";
import { UNCATEGORIZED } from "../../domain/CategoryRepository";
import { normalizeUrl } from "../../util/url";
import { writeErrorMessage } from "../../util/errors";
import { CategoryPicker, type PickerOption } from "../CategoryPicker";
import { strings } from "../strings";
import controls from "../controls.module.css";
import styles from "./Hero.module.css";

/**
 * Adding a link by hand, in place of the save card. Hints sit inside the fields; the labels
 * are still there for screen readers. Every problem is explained right here, and the form
 * stays open with what was typed so it can be fixed.
 */
export function ManualForm(props: {
    categoryOptions: PickerOption[];
    colorOf: (category: string) => string;
    onAdded: (result: AddTabResult) => void;
    onDuplicate: (existingId: string) => void;
    onClose: () => void;
}) {
    const [url, setUrl] = useState("");
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState(UNCATEGORIZED);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const urlInput = useRef<HTMLInputElement>(null);
    // Same moment the form appears (see EditForm in TabRow.tsx for why not later).
    useLayoutEffect(() => urlInput.current?.focus(), []);

    const chosen = props.categoryOptions.some((o) => o.value === category) ? category : UNCATEGORIZED;

    const submit = async (e: Event) => {
        e.preventDefault();
        const normalized = normalizeUrl(url);
        if (!normalized) {
            setError(strings.enterValidUrl);
            urlInput.current?.focus();
            return;
        }
        setBusy(true);
        try {
            const result = await addTab({
                title: title.trim() || new URL(normalized).hostname,
                url: normalized,
                category: chosen === UNCATEGORIZED ? undefined : chosen,
            });
            if (result.duplicate) {
                setError(strings.alreadySavedAs(result.tab.title));
                props.onDuplicate(result.tab.id);
                return;
            }
            props.onAdded(result);
        } catch (err) {
            setError(writeErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <section class={`${styles.card} ${styles.pop}`} aria-label={strings.addLinkManually}>
            <h2 class={styles.cardTitle}>{strings.addLinkTitle}</h2>
            <form class={styles.form} onSubmit={submit} noValidate>
                <label for="manual-url" class="visually-hidden">
                    {strings.urlLabel}
                </label>
                <input
                    ref={urlInput}
                    id="manual-url"
                    class={`${controls.field} ${error ? controls.fieldError : ""}`}
                    type="text"
                    placeholder={strings.urlPlaceholder}
                    value={url}
                    onInput={(e) => {
                        setUrl(e.currentTarget.value);
                        setError("");
                    }}
                />
                <label for="manual-title" class="visually-hidden">
                    {strings.titleOptionalLabel}
                </label>
                <input
                    id="manual-title"
                    class={controls.field}
                    type="text"
                    placeholder={strings.titleOptionalLabel}
                    value={title}
                    onInput={(e) => setTitle(e.currentTarget.value)}
                />
                <p class={controls.error} role="alert">
                    {error}
                </p>
                <div class={styles.actionRow}>
                    <CategoryPicker
                        id="manual-category"
                        label={strings.categoryOptionalLabel}
                        value={chosen}
                        options={props.categoryOptions}
                        color={props.colorOf(chosen)}
                        onChange={setCategory}
                        onSurface
                    />
                    <button type="button" class={controls.btn} onClick={props.onClose}>
                        {strings.cancel}
                    </button>
                    <button type="submit" class={`${controls.btn} ${controls.primary}`} disabled={busy}>
                        {strings.add}
                    </button>
                </div>
            </form>
        </section>
    );
}
