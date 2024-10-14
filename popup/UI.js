import { Item } from './Item.js';
export class UI {
    constructor(linkManager) {
        this.linkManager = linkManager;
        this.linkInputEl = this.getElement("link-input-el");
        this.descriptionInputEl = this.getElement("description-input-el");
        this.ulEl = this.getElement("ul-el");
        this.initialize();
    }
    initialize() {
        this.renderLinks();
        this.setupEventListeners();
    }
    getElement(id) {
        const el = document.getElementById(id);
        if (!el) {
            throw new Error(`Element with ID ${id} not found`);
        }
        return el;
    }
    renderLinks() {
        const links = this.linkManager.getLinks();
        this.ulEl.innerHTML = links.length ? links.map(link => this.renderLink(link)).join('') : "<li>No links available</li>";
    }
    renderLink(link) {
        return `
            <li>
                <a target='_blank' href='${link.getUrl()}'>${link.getDescription()}</a>
            </li>
        `;
    }
    setupEventListeners() {
        this.addClickListener("input-btn", () => this.handleAddLink());
        this.addDoubleClickListener("delete-btn", () => this.handleClearLinks());
        this.addClickListener("tab-btn", () => this.handleAddCurrentTab());
        this.ulEl.addEventListener('dblclick', (event) => this.handleRemoveLink(event));
    }
    addClickListener(id, handler) {
        const el = this.getElement(id);
        el.addEventListener("click", handler);
    }
    addDoubleClickListener(id, handler) {
        const el = this.getElement(id);
        el.addEventListener("dblclick", handler);
    }
    handleAddLink() {
        try {
            this.clearInputError();
            const item = new Item(this.linkInputEl.value, this.descriptionInputEl.value);
            this.linkManager.addLink(item);
            this.resetInputFields();
            this.renderLinks();
        }
        catch (err) {
            this.displayInputError(err.message);
        }
    }
    handleClearLinks() {
        if (confirm("Are you sure you want to clear all links?")) {
            this.linkManager.clearAllLinks();
            this.renderLinks();
        }
    }
    handleAddCurrentTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            var _a;
            const tabUrl = (_a = tabs[0]) === null || _a === void 0 ? void 0 : _a.url;
            if (tabUrl) {
                try {
                    const item = new Item(tabUrl, this.descriptionInputEl.value);
                    this.linkManager.addLink(item);
                    this.renderLinks();
                }
                catch (error) {
                    this.displayInputError("Invalid tab URL!");
                }
            }
            else {
                this.displayInputError("No active tab found!");
            }
        });
    }
    handleRemoveLink(event) {
        var _a, _b, _c;
        const target = event.target;
        if (target.tagName === 'LI') {
            const linkHref = (_a = target.querySelector('a')) === null || _a === void 0 ? void 0 : _a.getAttribute('href');
            const description = ((_c = (_b = target.querySelector('a')) === null || _b === void 0 ? void 0 : _b.textContent) === null || _c === void 0 ? void 0 : _c.trim()) || '';
            if (linkHref) {
                const item = new Item(linkHref, description, true);
                this.linkManager.removeLink(item);
                this.renderLinks();
            }
        }
    }
    clearInputError() {
        this.linkInputEl.style.backgroundColor = "#ffffff";
    }
    resetInputFields() {
        this.linkInputEl.value = "";
        this.descriptionInputEl.value = "";
    }
    displayInputError(message) {
        this.linkInputEl.style.backgroundColor = "#fa8072";
        alert(message);
    }
}
