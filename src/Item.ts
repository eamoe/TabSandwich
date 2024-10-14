export class Item {
    private url: string;
    private description: string;
    private checked: boolean;

    constructor(url: string, description: string = '', checked: boolean = false) {
        this.url = this.validateUrl(url);
        this.description = description.trim() || url;
        this.checked = checked;
    }

    private validateUrl(url: string): string {
        try {
            const validatedUrl = new URL(url);
            return validatedUrl.href;
        } catch (error) {
            throw new Error("Invalid URL format!");
        }
    }

    public getUrl(): string {
        return this.url;
    }

    public getDescription(): string {
        return this.description;
    }

    public isChecked(): boolean {
        return this.checked;
    }
}
