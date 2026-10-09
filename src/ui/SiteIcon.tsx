import { useState } from "preact/hooks";
import { localFaviconUrl } from "../util/favicon";
import { iconInk, type IconInk } from "../util/iconInk";
import { siteName } from "./main/listModel";
import styles from "./SiteIcon.module.css";

// A soft, stable color per site for the letter tile, so neighbouring rows don't all look alike.
const TILE_HUES = ["#4A90D9", "#6C63C5", "#2DBEA6", "#D47663", "#E8547E", "#E8B93A", "#6B8A68", "#7A8699"];

function tileColor(site: string): string {
    let h = 0;
    for (let i = 0; i < site.length; i++) h = (h * 31 + site.charCodeAt(i)) % 997;
    return `color-mix(in srgb, ${TILE_HUES[h % TILE_HUES.length]} var(--fav-mix), var(--surface))`;
}

/** Each icon is looked at once per popup, however many rows show it or however often they redraw. */
const inkSeen = new Map<string, IconInk>();

/** Reads a loaded icon's pixels (it comes from the extension's own origin, so the canvas may read it). */
function inkOf(img: HTMLImageElement): IconInk {
    const seen = inkSeen.get(img.src);
    if (seen !== undefined) return seen;
    let ink: IconInk = null;
    try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 16;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context) {
            context.drawImage(img, 0, 0, 16, 16);
            ink = iconInk(context.getImageData(0, 0, 16, 16).data);
        }
    } catch {
        // Unreadable pixels: show the icon as it is.
    }
    inkSeen.set(img.src, ink);
    return ink;
}

const INK_CLASS = { dark: styles.darkInk, light: styles.lightInk };

/**
 * A site's icon from Chrome's own local cache (never the site itself), on a tinted tile that
 * shows the site's first letter if Chrome has nothing for it. A one-color icon that would vanish
 * on this theme's tile (GitHub's black octocat in dark) is shown flipped (see iconInk).
 */
export function SiteIcon({ url, large = false, mini = false }: { url: string; large?: boolean; mini?: boolean }) {
    const [failed, setFailed] = useState(false);
    const src = localFaviconUrl(url);
    const [ink, setInk] = useState<IconInk>(() => inkSeen.get(src) ?? null);
    const site = siteName(url);
    return (
        <span
            class={`${styles.tile} ${large ? styles.large : ""} ${mini ? styles.mini : ""} ${ink ? INK_CLASS[ink] : ""}`}
            style={{ background: tileColor(site) }}
            data-testid="favicon"
            data-ink={ink ?? undefined}
            aria-hidden="true"
        >
            {failed ? (
                site.charAt(0)
            ) : (
                <img class={styles.img} src={src} alt="" onLoad={(e) => setInk(inkOf(e.currentTarget))} onError={() => setFailed(true)} />
            )}
        </span>
    );
}
