import { LinkManager } from './LinkManager';
import { Item } from './Item';

export class UI {    
    private readonly linkManager: LinkManager;
    private readonly linkInputEl: HTMLInputElement;
    private readonly descriptionInputEl: HTMLInputElement;
    private readonly ulEl: HTMLUListElement;

    constructor(linkManager: LinkManager) {
        this.linkManager = linkManager;
        this.linkInputEl = this.getElement<HTMLInputElement>("link-input-el");
        this.descriptionInputEl = this.getElement<HTMLInputElement>("description-input-el");
        this.ulEl = this.getElement<HTMLUListElement>("ul-el");
        this.initialize();
    }

    private initialize(): void {
        this.renderLinks();
        this.setupEventListeners();
    }

    private getElement<T extends HTMLElement>(id: string): T {
        const el = document.getElementById(id) as T;
        if (!el) {
            throw new Error(`Element with ID ${id} not found`);
        }
        return el;
    }

    private renderLinks(): void {
        const links = this.linkManager.getLinks();
        this.ulEl.innerHTML = links.length ? links.map(link => this.renderLink(link)).join('') : "<li>No links available</li>";
    }

    private renderLink(link: Item): string {
        return `
            <li>
                <a target='_blank' href='${link.getUrl()}'>${link.getDescription()}</a>
            </li>
        `;
    }

    private setupEventListeners(): void {
        this.addClickListener("input-btn", () => this.handleAddLink());
        this.addDoubleClickListener("delete-btn", () => this.handleClearLinks());
        this.addClickListener("tab-btn", () => this.handleAddCurrentTab());
        this.ulEl.addEventListener('dblclick', (event) => this.handleRemoveLink(event));
    }

    private addClickListener(id: string, handler: () => void): void {
        const el = this.getElement<HTMLElement>(id);
        el.addEventListener("click", handler);
    }

    private addDoubleClickListener(id: string, handler: () => void): void {
        const el = this.getElement<HTMLElement>(id);
        el.addEventListener("dblclick", handler);
    }

    private handleAddLink(): void {
        try {
            this.clearInputError();
            const item = new Item(this.linkInputEl.value, this.descriptionInputEl.value);
            this.linkManager.addLink(item);
            this.resetInputFields();
            this.renderLinks();
        } catch (err) {
            this.displayInputError((err as Error).message);
        }
    }

    private handleClearLinks(): void {
        if (confirm("Are you sure you want to clear all links?")) {
            this.linkManager.clearAllLinks();
            this.renderLinks();
        }
    }

    private handleAddCurrentTab(): void {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabUrl = tabs[0]?.url;
            if (tabUrl) {
                try {
                    const item = new Item(tabUrl, this.descriptionInputEl.value);
                    this.linkManager.addLink(item);
                    this.renderLinks();
                } catch (error) {
                    this.displayInputError((error as Error).message);
                }
            } else {
                this.displayInputError("No active tab found!");
            }
        });
    }

    private handleRemoveLink(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (target.tagName === 'LI') {
            const linkHref = target.querySelector('a')?.getAttribute('href');
            const description = target.querySelector('a')?.textContent?.trim() || '';
            if (linkHref) {
                const item = new Item(linkHref, description, true);
                this.linkManager.removeLink(item);
                this.renderLinks();
            }
        }
    }

    private clearInputError(): void {
        this.linkInputEl.style.backgroundColor = "#ffffff";
    }

    private resetInputFields(): void {
        this.linkInputEl.value = "";
        this.descriptionInputEl.value = "";
    }

    private displayInputError(message: string): void {
        this.linkInputEl.style.backgroundColor = "#fa8072";
        alert(message);
    }
}
