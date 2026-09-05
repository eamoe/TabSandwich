const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "popup", "js");

// tsc re-emits every changed file with its extension-less import specifiers on each
// incremental compile — fix-extensions.js isn't something tsc itself knows to re-run. A
// bare `tsc --watch` would compile cleanly and then silently ship broken imports on the
// very first edit, since the browser's native ESM resolution requires the `.js` suffix
// `npm run build` normally adds as a separate step.
let fixTimer = null;
function scheduleFix() {
    clearTimeout(fixTimer);
    // Debounced: one compile emits several files in quick succession, and running the
    // fixer once per burst is both cheaper and avoids it racing tsc's own writes.
    fixTimer = setTimeout(() => {
        spawn(process.execPath, [path.join(__dirname, "fix-extensions.js")], { stdio: "inherit" });
    }, 150);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.watch(OUT_DIR, { recursive: true }, (_event, filename) => {
    if (filename && filename.endsWith(".js")) scheduleFix();
});

const tsc = spawn(path.join(__dirname, "node_modules", ".bin", "tsc"), ["--watch", "--preserveWatchOutput"], {
    stdio: "inherit",
});
tsc.on("exit", (code) => process.exit(code ?? 0));
