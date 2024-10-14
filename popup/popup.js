var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var Item = /** @class */ (function () {
    function Item(url, description, checked) {
        if (description === void 0) { description = ''; }
        if (checked === void 0) { checked = false; }
        this.url = this.validateUrl(url);
        this.description = description.trim() || url;
        this.checked = checked;
    }
    Item.prototype.validateUrl = function (url) {
        try {
            var validatedUrl = new URL(url);
            return validatedUrl.href;
        }
        catch (error) {
            throw new Error("Invalid URL format!");
        }
    };
    Item.prototype.getUrl = function () {
        return this.url;
    };
    Item.prototype.getDescription = function () {
        return this.description;
    };
    Item.prototype.isChecked = function () {
        return this.checked;
    };
    return Item;
}());
var StorageService = /** @class */ (function () {
    function StorageService(key) {
        this.storageKey = key;
    }
    StorageService.prototype.load = function () {
        try {
            var items = JSON.parse(localStorage.getItem(this.storageKey) || "[]");
            return items.map(function (item) { return new Item(item.url, item.description, item.checked); });
        }
        catch (_a) {
            return [];
        }
    };
    StorageService.prototype.save = function (data) {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    };
    StorageService.prototype.clear = function () {
        localStorage.removeItem(this.storageKey);
    };
    return StorageService;
}());
var LinkManager = /** @class */ (function () {
    function LinkManager(storageService) {
        this.links = [];
        this.storageService = storageService;
        this.links = this.storageService.load();
    }
    LinkManager.prototype.addLink = function (item) {
        if (!this.isLinkInManager(item)) {
            this.links.push(item);
            this.updateStorage();
        }
        else {
            console.warn('Link already exists in manager');
        }
    };
    LinkManager.prototype.removeLink = function (item) {
        var initialLength = this.links.length;
        this.links = this.links.filter(function (link) { return link.getUrl() !== item.getUrl(); });
        if (this.links.length !== initialLength) {
            this.updateStorage();
        }
        else {
            console.warn('Link not found for removal');
        }
    };
    LinkManager.prototype.clearAllLinks = function () {
        this.links = [];
        this.updateStorage();
    };
    LinkManager.prototype.getLinks = function () {
        return __spreadArray([], this.links, true);
    };
    LinkManager.prototype.isLinkInManager = function (item) {
        return this.links.some(function (link) { return link.getUrl() === item.getUrl(); });
    };
    LinkManager.prototype.updateStorage = function () {
        this.storageService.save(this.links);
    };
    return LinkManager;
}());
var UI = /** @class */ (function () {
    function UI(linkManager) {
        this.linkManager = linkManager;
        this.linkInputEl = this.getElement("link-input-el");
        this.descriptionInputEl = this.getElement("description-input-el");
        this.ulEl = this.getElement("ul-el");
        this.initialize();
    }
    UI.prototype.initialize = function () {
        this.renderLinks();
        this.setupEventListeners();
    };
    UI.prototype.getElement = function (id) {
        var el = document.getElementById(id);
        if (!el) {
            throw new Error("Element with ID ".concat(id, " not found"));
        }
        return el;
    };
    UI.prototype.renderLinks = function () {
        var _this = this;
        var links = this.linkManager.getLinks();
        this.ulEl.innerHTML = links.length ? links.map(function (link) { return _this.renderLink(link); }).join('') : "<li>No links available</li>";
    };
    UI.prototype.renderLink = function (link) {
        return "\n            <li>\n                <a target='_blank' href='".concat(link.getUrl(), "'>").concat(link.getDescription(), "</a>\n            </li>\n        ");
    };
    UI.prototype.setupEventListeners = function () {
        var _this = this;
        this.addClickListener("input-btn", function () { return _this.handleAddLink(); });
        this.addDoubleClickListener("delete-btn", function () { return _this.handleClearLinks(); });
        this.addClickListener("tab-btn", function () { return _this.handleAddCurrentTab(); });
        this.ulEl.addEventListener('dblclick', function (event) { return _this.handleRemoveLink(event); });
    };
    UI.prototype.addClickListener = function (id, handler) {
        var el = this.getElement(id);
        el.addEventListener("click", handler);
    };
    UI.prototype.addDoubleClickListener = function (id, handler) {
        var el = this.getElement(id);
        el.addEventListener("dblclick", handler);
    };
    UI.prototype.handleAddLink = function () {
        try {
            this.clearInputError();
            var item = new Item(this.linkInputEl.value, this.descriptionInputEl.value);
            this.linkManager.addLink(item);
            this.resetInputFields();
            this.renderLinks();
        }
        catch (err) {
            this.displayInputError(err.message);
        }
    };
    UI.prototype.handleClearLinks = function () {
        if (confirm("Are you sure you want to clear all links?")) {
            this.linkManager.clearAllLinks();
            this.renderLinks();
        }
    };
    UI.prototype.handleAddCurrentTab = function () {
        var _this = this;
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            var _a;
            var tabUrl = (_a = tabs[0]) === null || _a === void 0 ? void 0 : _a.url;
            if (tabUrl) {
                try {
                    var item = new Item(tabUrl, _this.descriptionInputEl.value);
                    _this.linkManager.addLink(item);
                    _this.renderLinks();
                }
                catch (error) {
                    _this.displayInputError("Invalid tab URL!");
                }
            }
            else {
                _this.displayInputError("No active tab found!");
            }
        });
    };
    UI.prototype.handleRemoveLink = function (event) {
        var _a, _b, _c;
        var target = event.target;
        if (target.tagName === 'LI') {
            var linkHref = (_a = target.querySelector('a')) === null || _a === void 0 ? void 0 : _a.getAttribute('href');
            var description = ((_c = (_b = target.querySelector('a')) === null || _b === void 0 ? void 0 : _b.textContent) === null || _c === void 0 ? void 0 : _c.trim()) || '';
            if (linkHref) {
                var item = new Item(linkHref, description, true);
                this.linkManager.removeLink(item);
                this.renderLinks();
            }
        }
    };
    UI.prototype.clearInputError = function () {
        this.linkInputEl.style.backgroundColor = "#ffffff";
    };
    UI.prototype.resetInputFields = function () {
        this.linkInputEl.value = "";
        this.descriptionInputEl.value = "";
    };
    UI.prototype.displayInputError = function (message) {
        this.linkInputEl.style.backgroundColor = "#fa8072";
        alert(message);
    };
    return UI;
}());
var storageService = new StorageService('links');
var linkManager = new LinkManager(storageService);
var ui = new UI(linkManager);
