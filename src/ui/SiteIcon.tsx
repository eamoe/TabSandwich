import { useState } from "preact/hooks";
import { localFaviconUrl } from "../util/favicon";
import { siteName } from "./main/listModel";
import styles from "./SiteIcon.module.css";

// A soft, stable color per site for the letter tile, so neighbouring rows don't all look alike.
const TILE_HUES = ["#4A90D9", "#6C63C5", "#2DBEA6", "#D47663", "#E8547E", "#E8B93A", "#6B8A68", "#7A8699"];

function tileColor(site: string): string {
    let h = 0;
    for (let i = 0; i < site.length; i++) h = (h * 31 + site.charCodeAt(i)) % 997;
    return `color-mix(in srgb, ${TILE_HUES[h % TILE_HUES.length]} var(--fav-mix), var(--surface))`;
}

/**
 * A site's icon from Chrome's own local cache (never the site itself), on a tinted tile that
 * shows the site's first letter if Chrome has nothing for it.
 */
export function SiteIcon({ url, large = false }: { url: string; large?: boolean }) {
    const [failed, setFailed] = useState(false);
    const site = siteName(url);
    return (
        <span class={large ? `${styles.tile} ${styles.large}` : styles.tile} style={{ background: tileColor(site) }} data-testid="favicon" aria-hidden="true">
            {failed ? site.charAt(0) : <img class={styles.img} src={localFaviconUrl(url)} alt="" onError={() => setFailed(true)} />}
        </span>
    );
}
