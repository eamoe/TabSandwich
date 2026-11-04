import type { ComponentChildren } from "preact";
import { aroundSlot } from "./i18n";

/**
 * A sentence from strings.ts with something other than words inside it — a key cap, a field —
 * at its "{}", wherever that language's word order puts it.
 */
export function Slotted({ sentence, children }: { sentence: string; children: ComponentChildren }) {
    const [before, after] = aroundSlot(sentence);
    return (
        <>
            {before}
            {children}
            {after}
        </>
    );
}
