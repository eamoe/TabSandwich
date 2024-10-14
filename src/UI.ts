import { LinkManager } from './LinkManager';
import { Item } from './Item';
import { DOMHelper } from './DOMHelper';
import { LinkRenderer } from './LinkRenderer';

export class UI {    
    private readonly linkManager: LinkManager;
    private readonly linkRenderer: LinkRenderer;
    private readonly linkInputEl: HTMLInputElement;
    private readonly descriptionInputEl: HTMLInputElement;

    constructor(linkManager: LinkManager, private domHelper: DOMHelper = new DOMHelper()) {
        this.linkManager = linkManager;

        this.linkInputEl = this.domHelper.getElement<HTMLInputElement>("link-input-el");
        this.descriptionInputEl = this.domHelper.getElement<HTMLInputElement>("description-input-el");

        const ulEl = this.domHelper.getElement<HTMLUListElement>("ul-el");
        this.linkRenderer = new LinkRenderer(ulEl);

        this.initialize();
    }

    private initialize(): void {
        this.renderLinks();
        this.setupEventListeners();
    }

    private renderLinks(): void {
        const links = this.linkManager.getLinks();
        this.linkRenderer.renderLinks(links);
    }

    private setupEventListeners(): void {
        this.addClickListener("input-btn", () => this.handleAddLink());
        this.addClickListener("delete-btn", () => this.handleClearLinks());
        this.addClickListener("tab-btn", () => this.handleAddCurrentTab());
        this.addDoubleClickListener("ul-el", (event) => this.handleRemoveLink(event));
    }

    private addClickListener(id: string, handler: () => void): void {
        const el = this.domHelper.getElement<HTMLElement>(id);
        el.addEventListener("click", handler);
    }

    private addDoubleClickListener(id: string, handler: (event: MouseEvent) => void): void {
        const el = this.domHelper.getElement<HTMLElement>(id);
        el.addEventListener("dblclick", handler);
    }

    private handleAddLink(): void {
        try {
            this.domHelper.clearInputError(this.linkInputEl);
            const item = new Item(this.linkInputEl.value, this.descriptionInputEl.value);
            this.linkManager.addLink(item);
            this.resetInputFields();
            this.renderLinks();
        } catch (err) {
            this.domHelper.displayInputError(this.linkInputEl, (err as Error).message);
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
                    this.domHelper.displayInputError(this.linkInputEl, (error as Error).message);
                }
            } else {
                this.domHelper.displayInputError(this.linkInputEl, "No active tab found!");
            }
        });
    }

    private handleClearLinks(): void {
        if (confirm("Are you sure you want to clear all links?")) {
            this.linkManager.clearAllLinks();
            this.renderLinks();
        }
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

    private resetInputFields(): void {
        this.linkInputEl.value = "";
        this.descriptionInputEl.value = "";
    }
}
