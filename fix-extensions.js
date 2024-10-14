(async () => {
    const replace = await import('replace-in-file');
  
    const options = {
      files: 'popup/**/*.js',  // Target transpiled JavaScript files
      from: /(import\s+.*?from\s+['"]\.\/.*?)(['"])/g, // Regex to match import paths
      to: '$1.js$2',          // Append .js before the closing quote
    };
  
    async function addJsExtensions() {
      try {
        const results = await replace.replaceInFile(options);
        console.log('Modified files:', results.map(r => r.file));
      } catch (error) {
        console.error('Error occurred:', error);
      }
    }
  
    await addJsExtensions();
})();
