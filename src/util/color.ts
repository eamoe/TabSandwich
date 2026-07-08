/** Mixes a hex color toward white by `amount` (0-1) — used to turn a saturated category color into a legible pastel row background. */
export function tintHex(hex: string, amount: number): string {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);

    const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
    const toHex = (n: number) => n.toString(16).padStart(2, "0");

    return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}
