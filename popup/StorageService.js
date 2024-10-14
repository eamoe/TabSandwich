import { Item } from './Item.js';
export class StorageService {
    constructor(key) {
        this.storageKey = key;
    }
    load() {
        try {
            const items = JSON.parse(localStorage.getItem(this.storageKey) || "[]");
            return items.map((item) => new Item(item.url, item.description, item.checked));
        }
        catch (_a) {
            return [];
        }
    }
    save(data) {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }
    clear() {
        localStorage.removeItem(this.storageKey);
    }
}
