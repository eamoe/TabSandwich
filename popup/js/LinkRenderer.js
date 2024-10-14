export class LinkRenderer {
    constructor(ulEl) {
        this.ulEl = ulEl;
    }
    renderLinks(links) {
        this.ulEl.innerHTML = links.length ? links.map(link => this.renderLink(link)).join('') : "<li>No links available</li>";
    }
    renderLink(link) {
        return `
            <li>
                <a target='_blank' href='${link.getUrl()}'>${link.getDescription()}</a>
            </li>
        `;
    }
}
