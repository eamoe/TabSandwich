/**
 * Some sites' icons are a single dark shape on a transparent ground (GitHub's black octocat),
 * drawn for light browser tabs: on a dark tile they all but vanish. A few are the reverse, white
 * on transparent, and vanish on a light tile. This tells which kind an icon is from its pixels,
 * so the tile can flip it in the theme where it would vanish.
 *
 * "dark" / "light": one color, no background of its own, and dark or mid-gray (GitHub's cat,
 * Chrome's own gray globe for a page it has no icon for) / very light. null for everything
 * else — colorful icons and icons that fill their square with their own background (Wikipedia's
 * white tile) — which read on either theme as they are. Pure: takes RGBA bytes, as a canvas's
 * getImageData gives.
 */
export type IconInk = "dark" | "light" | null;

/** Below this share of opaque pixels the icon is a shape on transparency, not a tile of its own. */
const MAX_COVERAGE = 0.7;
/** Average spread between a pixel's strongest and weakest channel: above this it's colorful. */
const MAX_CHROMA = 0.15;
/**
 * Average brightness (0 black – 1 white) below / above which a shape is dark / light ink. Dark
 * reaches up to mid-gray: Chrome's globe (about 0.39) sinks into a dark tile just like black does.
 */
const DARK_BELOW = 0.5;
const LIGHT_ABOVE = 0.8;

export function iconInk(rgba: ArrayLike<number>): IconInk {
    const pixels = Math.floor(rgba.length / 4);
    let opaque = 0;
    let luminance = 0;
    let chroma = 0;
    for (let i = 0; i < pixels * 4; i += 4) {
        if (rgba[i + 3] < 128) continue;
        const [r, g, b] = [rgba[i], rgba[i + 1], rgba[i + 2]];
        opaque++;
        luminance += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        chroma += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    }
    if (opaque === 0 || opaque / pixels > MAX_COVERAGE || chroma / opaque > MAX_CHROMA) return null;
    const brightness = luminance / opaque;
    if (brightness < DARK_BELOW) return "dark";
    if (brightness > LIGHT_ABOVE) return "light";
    return null;
}
