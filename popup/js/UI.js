import { Item } from './Item.js';
import { DOMHelper } from './DOMHelper.js';
import { LinkRenderer } from './LinkRenderer.js';
export class UI {
    constructor(linkManager, domHelper = new DOMHelper()) {
        this.domHelper = domHelper;
        this.linkManager = linkManager;
        this.linkInputEl = this.domHelper.getElement("link-input-el");
        this.descriptionInputEl = this.domHelper.getElement("description-input-el");
        const ulEl = this.domHelper.getElement("ul-el");
        this.linkRenderer = new LinkRenderer(ulEl);
        this.initialize();
    }
    initialize() {
        this.renderLinks();
        this.setupEventListeners();
    }
    renderLinks() {
        const links = this.linkManager.getLinks();
        this.linkRenderer.renderLinks(links);
    }
    setupEventListeners() {
        this.addClickListener("input-btn", () => this.handleAddLink());
        this.addClickListener("delete-btn", () => this.handleClearLinks());
        this.addClickListener("tab-btn", () => this.handleAddCurrentTab());
        this.addDoubleClickListener("ul-el", (event) => this.handleRemoveLink(event));
    }
    addClickListener(id, handler) {
        const el = this.domHelper.getElement(id);
        el.addEventListener("click", handler);
    }
    addDoubleClickListener(id, handler) {
        const el = this.domHelper.getElement(id);
        el.addEventListener("dblclick", handler);
    }
    handleAddLink() {
        try {
            this.domHelper.clearInputError(this.linkInputEl);
            const item = new Item(this.linkInputEl.value, this.descriptionInputEl.value);
            this.linkManager.addLink(item);
            this.resetInputFields();
            this.renderLinks();
        }
        catch (err) {
            this.domHelper.displayInputError(this.linkInputEl, err.message);
        }
    }
    handleAddCurrentTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab?.id && tab?.url && !tab.url.startsWith('chrome://')) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => document.title,
                }, (results) => {
                    const pageTitle = results?.[0]?.result || '';
                    const tabUrl = tab.url;
                    if (tabUrl) {
                        try {
                            const item = new Item(tabUrl, pageTitle || this.descriptionInputEl.value);
                            this.linkManager.addLink(item);
                            this.renderLinks();
                        }
                        catch (error) {
                            this.domHelper.displayInputError(this.linkInputEl, error.message);
                        }
                    }
                    else {
                        this.domHelper.displayInputError(this.linkInputEl, "No active tab found!");
                    }
                });
            }
            else {
                this.domHelper.displayInputError(this.linkInputEl, "Cannot add links from a restricted or unsupported page.");
            }
        });
    }
    handleClearLinks() {
        if (confirm("Are you sure you want to clear all links?")) {
            this.linkManager.clearAllLinks();
            this.renderLinks();
        }
    }
    handleRemoveLink(event) {
        const target = event.target;
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
    resetInputFields() {
        this.linkInputEl.value = "";
        this.descriptionInputEl.value = "";
    }
}
