import { getElement } from "../dom/domHelper";

// Module-level, mirroring PillsRenderer's currentFilter: one search box, one query, and it
// deliberately doesn't persist — the popup is a fresh capture surface on every open.
let currentQuery = "";

export function getSearchQuery(): string {
    return currentQuery;
}

/** Hidden while there's nothing saved — a search box over an empty state is just noise. */
export function setSearchRowVisible(visible: boolean): void {
    getElement<HTMLElement>("search-row").hidden = !visible;
}

/**
 * The result count changes on every keystroke without moving focus, which assistive tech
 * won't announce on its own — so it goes through a live region, the same way save feedback does.
 */
export function announceResultCount(count: number): void {
    getElement<HTMLElement>("search-status").textContent =
        count === 0 ? "No matching tabs" : `${count} matching tab${count === 1 ? "" : "s"}`;
}

export function clearResultAnnouncement(): void {
    getElement<HTMLElement>("search-status").textContent = "";
}

export function initSearch(onQueryChange: () => void): void {
    const input = getElement<HTMLInputElement>("search-input");
    const clearBtn = getElement<HTMLButtonElement>("search-clear");

    function apply(value: string): void {
        currentQuery = value;
        clearBtn.hidden = value.length === 0;
        onQueryChange();
    }

    function clear(): void {
        input.value = "";
        apply("");
        clearResultAnnouncement();
        input.focus();
    }

    // No debounce: scoring a few hundred short strings is sub-millisecond, and the re-render
    // reuses the last loaded snapshot rather than touching storage, so a delay would only
    // make typing feel slower than it is.
    input.addEventListener("input", () => apply(input.value));

    input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            // With nothing to clear, Escape belongs to the browser — that's how the popup closes.
            if (!input.value) return;
            e.preventDefault();
            clear();
            return;
        }

        if (e.key === "Enter") {
            e.preventDefault();
            // Reads the top row straight out of the DOM rather than tracking the ranked list
            // separately, so "the first result" can never disagree with what's on screen.
            document.querySelector<HTMLButtonElement>("#tab-list li[data-tab-id] .tab-title")?.click();
        }
    });

    clearBtn.addEventListener("click", clear);

    input.focus();
}
