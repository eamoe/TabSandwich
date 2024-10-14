export class DOMHelper {
    getElement(id) {
        const el = document.getElementById(id);
        if (!el) {
            throw new Error(`Element with ID ${id} not found.`);
        }
        return el;
    }
    clearInputError(inputEl) {
        inputEl.classList.remove("input-error-bg");
    }
    displayInputError(inputEl, message) {
        inputEl.classList.add("input-error-bg");
        alert(message);
    }
}
