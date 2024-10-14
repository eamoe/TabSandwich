export class Item {
    constructor(url, description = '', checked = false) {
        this.url = this.validateUrl(url);
        this.description = description.trim() || url;
        this.checked = checked;
    }
    validateUrl(url) {
        try {
            const validatedUrl = new URL(url);
            return validatedUrl.href;
        }
        catch (error) {
            throw new Error("Invalid URL format!");
        }
    }
    getUrl() {
        return this.url;
    }
    getDescription() {
        return this.description;
    }
    isChecked() {
        return this.checked;
    }
}
