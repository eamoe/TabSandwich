import { Item } from './Item';

export class StorageService<T> {
    private storageKey: string;

    constructor(key: string) {
        this.storageKey = key;
    }

    public load(): T[] {
        try {
            const items = JSON.parse(localStorage.getItem(this.storageKey) || "[]");
            return items.map((item: any) => new Item(item.url, item.description, item.checked));
        } catch {
            return [];
        }
    }

    public save(data: T[]): void {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    public clear(): void {
        localStorage.removeItem(this.storageKey);
    }
}
