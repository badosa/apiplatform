const fs = require('fs');
const Terser = require('terser');
const CleanCSS = require('clean-css');
const path = require('path');

async function minifyFiles() {
    try {
        // Define source and output directories
        const srcDir = path.join(__dirname, 'src');
        const distDir = path.join(__dirname, 'dist');

        // Minify JavaScript
        const jsContent = fs.readFileSync(path.join(srcDir, 'script.max.js'), 'utf8');
        const minifiedJs = await Terser.minify(jsContent);
        if (minifiedJs.error) throw minifiedJs.error;
        fs.writeFileSync(path.join(distDir, 'script.js'), minifiedJs.code);
        console.log('✓ JavaScript minified successfully');

        // Minify CSS
        const cssContent = fs.readFileSync(path.join(srcDir, 'style.max.css'), 'utf8');
        const minifiedCss = new CleanCSS().minify(cssContent);
        if (minifiedCss.errors.length > 0) throw minifiedCss.errors;
        fs.writeFileSync(path.join(distDir, 'style.css'), minifiedCss.styles);
        console.log('✓ CSS minified successfully');

    } catch (error) {
        console.error('Error during minification:', error);
        process.exit(1);
    }
}

minifyFiles();
