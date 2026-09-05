(async () => {
    const replace = await import('replace-in-file');
  
    const options = {
      files: 'popup/**/*.js',  // Target transpiled JavaScript files
      // The negative lookbehind (?<!\.js) skips a specifier that's already suffixed, so
      // running this repeatedly — as `npm run watch` does, once per incremental compile —
      // is a no-op past the first pass instead of appending another ".js" every time.
      from: /(import\s+.*?from\s+['"]\.\.?\/.*?)(?<!\.js)(['"])/g,
      to: '$1.js$2',          // Append .js before the closing quote
    };
  
    async function addJsExtensions() {
      try {
        const results = await replace.replaceInFile(options);
        // replaceInFile returns one result per file matched by the glob, not per file
        // actually rewritten (`hasChanged` carries that) — logging the unfiltered list
        // reported every compiled file on every run, changed or not. That's misleading
        // once this runs repeatedly under `npm run watch`, where "nothing to fix" is the
        // expected, silent outcome most of the time.
        const changed = results.filter(r => r.hasChanged).map(r => r.file);
        if (changed.length > 0) console.log('Fixed imports in:', changed);
      } catch (error) {
        console.error('Error occurred:', error);
      }
    }
  
    await addJsExtensions();
})();
