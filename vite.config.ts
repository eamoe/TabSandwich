import { defineConfig, type Plugin } from "vite";
import { cpSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const OUT_DIR = resolve(ROOT, "dist");

/**
 * Everything Chrome needs besides the bundled popup: the manifest and the icons it points at.
 * Copied on every build, including each rebuild under `pnpm watch`, so `dist/` is always a
 * complete, loadable extension — and the same folder the release zip is made from.
 */
function copyExtensionFiles(): Plugin {
    return {
        name: "copy-extension-files",
        buildStart() {
            this.addWatchFile(resolve(ROOT, "manifest.json"));
        },
        writeBundle() {
            cpSync(resolve(ROOT, "manifest.json"), resolve(OUT_DIR, "manifest.json"));
            cpSync(resolve(ROOT, "images"), resolve(OUT_DIR, "images"), {
                recursive: true,
                // Finder litters folders with .DS_Store; it has no place in a shipped extension.
                filter: (src) => basename(src) !== ".DS_Store",
            });
        },
    };
}

export default defineConfig({
    // Nothing in the repo root is meant to be served or copied verbatim — the plugin above
    // picks exactly what the extension needs.
    publicDir: false,
    plugins: [copyExtensionFiles()],
    // Preact components are plain JSX compiled with Preact's automatic runtime — the same
    // settings tsconfig.json type-checks with, so the two can't disagree. (`oxc` is Vite 8's
    // transformer; it replaced the older `esbuild` option.)
    oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
    build: {
        outDir: OUT_DIR,
        emptyOutDir: true,
        target: "es2022",
        // Unminified on purpose: the bundle is a few dozen KB either way, and Chrome Web Store
        // review is easier when the shipped code reads like the source.
        minify: false,
        // Vite's preload polyfill is injected as an inline <script>, which an MV3 extension
        // page's content security policy refuses to run.
        modulePreload: { polyfill: false },
        rollupOptions: {
            input: resolve(ROOT, "popup/popup.html"),
        },
    },
});
