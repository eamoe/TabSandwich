import { Item } from "./Item";

export class LinkRenderer {
    private ulEl: HTMLElement;

    constructor(ulEl: HTMLUListElement) {
        this.ulEl = ulEl;
    }

    public renderLinks(links: Item[]): void {
        this.ulEl.innerHTML = links.length ? links.map(link => this.renderLink(link)).join('') : "<li>No links available</li>";
    }

    private renderLink(link: Item): string {
        return `
            <li>
                <a target='_blank' href='${link.getUrl()}'>${link.getDescription()}</a>
            </li>
        `;
    }
}
