export class DOMHelper {
    public getElement<T extends HTMLElement>(id: string): T {
        const el = document.getElementById(id) as T;
        if (!el) {
            throw new Error(`Element with ID ${id} not found.`);
        }
        return el;
    }

    public clearInputError(inputEl: HTMLInputElement): void {
        inputEl.classList.remove("input-error-bg");
    }

    public displayInputError(inputEl: HTMLInputElement, message: string): void {
        inputEl.classList.add("input-error-bg");
        alert(message);
    }
}
