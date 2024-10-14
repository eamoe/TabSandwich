import { Item } from './Item';
import { StorageService } from './StorageService';

export class LinkManager {
    private links: Item[];
    private storageService: StorageService<Item>;

    constructor(storageService: StorageService<Item>) {
        this.links = [];
        this.storageService = storageService;
        this.links = this.storageService.load();
    }

    public addLink(item: Item): void {
        if (!this.isLinkInManager(item)) {
            this.links.push(item);
            this.updateStorage();
        } else {
            throw new Error('Link already exists in the list.');
        }
    }

    public removeLink(item: Item): void {
        const initialLength = this.links.length;
        this.links = this.links.filter(link => link.getUrl() !== item.getUrl());
        if (this.links.length !== initialLength) {
            this.updateStorage();
        } else {
            throw new Error('Link not found for removal.');
        }
    }

    public clearAllLinks(): void {
        this.links = [];
        this.updateStorage();
    }

    public getLinks(): Item[] {
        return [...this.links];
    }

    private isLinkInManager(item: Item): boolean {
        return this.links.some(link => link.getUrl() === item.getUrl());
    }

    private updateStorage(): void {
        this.storageService.save(this.links);
    }
}
