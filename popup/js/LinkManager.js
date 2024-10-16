export class LinkManager {
    constructor(storageService) {
        this.links = [];
        this.storageService = storageService;
        this.links = this.storageService.load();
    }
    addLink(item) {
        if (!this.isLinkInManager(item)) {
            this.links.push(item);
            this.updateStorage();
        }
        else {
            throw new Error('Link already exists in the list.');
        }
    }
    removeLink(item) {
        const initialLength = this.links.length;
        this.links = this.links.filter(link => link.getUrl() !== item.getUrl());
        if (this.links.length !== initialLength) {
            this.updateStorage();
        }
        else {
            throw new Error('Link not found for removal.');
        }
    }
    clearAllLinks() {
        this.links = [];
        this.updateStorage();
    }
    getLinks() {
        return [...this.links];
    }
    isLinkInManager(item) {
        return this.links.some(link => link.getUrl() === item.getUrl());
    }
    updateStorage() {
        this.storageService.save(this.links);
    }
}
