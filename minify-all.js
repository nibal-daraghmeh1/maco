const fs = require('fs');
const path = require('path');
const terser = require('terser');

const srcDir = path.join(__dirname, 'src');
const outDir = path.join(__dirname, 'dist', 'src');

function getJsFiles(dir) {
    let results = [];
    fs.readdirSync(dir, { withFileTypes: true }).forEach(dirent => {
        const fullPath = path.join(dir, dirent.name);
        if (dirent.isDirectory()) {
            results = results.concat(getJsFiles(fullPath));
        } else if (dirent.name.endsWith('.js')) {
            results.push(fullPath);
        }
    });
    return results;
}

fs.mkdirSync(outDir, { recursive: true });

const files = getJsFiles(srcDir);

files.forEach(file => {
    const relativePath = path.relative(srcDir, file);
    const outFile = path.join(outDir, relativePath);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });

    const code = fs.readFileSync(file, 'utf8');

    // Pass ES module format to Terser
    terser.minify(code, {
        compress: true,
        mangle: true,
        module: true,        // important for ES modules
        format: { comments: false },
    }).then(result => {
        if (result.error) {
            console.error(`Error minifying ${file}:`, result.error);
            return;
        }
        fs.writeFileSync(outFile, result.code, 'utf8');
        console.log(`Uglified: ${file} -> ${outFile}`);
    }).catch(err => {
        console.error(`Terser failed on ${file}:`, err);
    });
});
