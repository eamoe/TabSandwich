import { readFileSync } from "node:fs";

/** What the Store screenshots (store-assets.spec.ts) and the demo video (demo-video.spec.ts) both draw. */

// The icon, large, beside the name on the main screenshot: the tile only (the drawing's transparent margin cropped off).
export const ICON = readFileSync("branding/icon.svg", "utf8")
    .replace('viewBox="0 0 128 128"', 'viewBox="16 16 96 96"')
    .replace(/ width="\d+" height="\d+"/, ' width="112" height="112" style="display:block"');
/** The icon as Chrome shows an extension's, small, in the side panel's header. */
export const ICON_SMALL = ICON.replace(' width="112" height="112"', ' width="18" height="18"').replace('style="display:block"', 'style="display:block;border-radius:4px"');
export const BACKGROUNDS = {
    light: "radial-gradient(circle at 85% 15%, rgba(255,255,255,.18) 0 160px, transparent 161px), radial-gradient(circle at 70% 105%, rgba(255,194,75,.35) 0 120px, transparent 121px), linear-gradient(135deg, #7A71E0, #584FA3)",
    dark: "radial-gradient(circle at 85% 15%, rgba(255,255,255,.08) 0 160px, transparent 161px), radial-gradient(circle at 70% 105%, rgba(255,194,75,.18) 0 120px, transparent 121px), linear-gradient(135deg, #3B3488, #15122A)",
};

// The mark beside the name on the other screenshots: the icon without its tile, as in the popup header.
export const MARK = readFileSync("branding/mark.svg", "utf8").replace(/ width="\d+" height="\d+"/, ' width="36" height="30"');

export const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif";
export const SHADOW = "0 30px 80px rgba(0,0,0,.35),0 8px 20px rgba(0,0,0,.2)";
/** Chrome's own icons, redrawn plainly (stroke, 24-unit grid) for the window around the side panel. */
export const CHROME_ICON = {
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    forward: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    reload: '<path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"/>',
    tune: '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>',
    star: '<path d="M12 4l2.4 5 5.6.7-4.1 3.8 1.1 5.5L12 16.3 7 19l1.1-5.5L4 9.7l5.6-.7z"/>',
    panel: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M14 5v14"/>',
    // Material's "extension" piece, as Chrome's extensions button shows it, outlined.
    puzzle: '<path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4c-1.1 0-2 .9-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20c0 1.1.9 2 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17c1.1 0 2-.9 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/>',
    more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    pin: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
};
export const chromeIcon = (name: keyof typeof CHROME_ICON, size = 18, color = "#474A50") =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;display:block">${CHROME_ICON[name]}</svg>`;
export const CHROME = { frame: "#DEE3EA", toolbar: "#FFFFFF", omnibox: "#EDF1F6", line: "#D3D8E0", text: "#1F1F1F", muted: "#5F6368" };
