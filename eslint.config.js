import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/**
 * Lint rules that catch real mistakes, matched to how this codebase is already written rather
 * than reformatting it. Formatting itself (Prettier) is deliberately not enforced: adopting it
 * would rewrite most files in one commit for no behavioral gain.
 */
export default tseslint.config(
    { ignores: ["dist/", "node_modules/", "node_modules.nosync/", "popup/js/", "test-results/", "playwright-report/"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            // `_name` marks a value destructured out on purpose (e.g. dropping one key of an object).
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
        },
    },
    {
        files: ["src/**/*.{ts,tsx}"],
        languageOptions: { globals: { ...globals.browser, chrome: "readonly" } },
        rules: {
            // CLAUDE.md: all persistent data goes through chrome.storage.local (src/storage/chromeStorage.ts).
            // Until now this was a written rule only; this makes it a checked one.
            "no-restricted-globals": [
                "error",
                { name: "localStorage", message: "Use chrome.storage.local via src/storage/chromeStorage.ts." },
                { name: "sessionStorage", message: "Use chrome.storage.local via src/storage/chromeStorage.ts." },
            ],
            "no-restricted-properties": [
                "error",
                { object: "window", property: "localStorage", message: "Use chrome.storage.local via src/storage/chromeStorage.ts." },
                { object: "window", property: "sessionStorage", message: "Use chrome.storage.local via src/storage/chromeStorage.ts." },
            ],
        },
    },
    {
        // The one sanctioned exception: reading legacy localStorage data once, in order to migrate it away.
        files: ["src/storage/migration.ts"],
        rules: { "no-restricted-globals": "off" },
    },
    {
        files: ["tests/**/*.{ts,tsx}", "*.config.ts", "*.config.js"],
        languageOptions: { globals: { ...globals.node } },
    }
);
