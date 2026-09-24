// Inline the same audited, synchronous gate on both entry surfaces. No extra request before consent.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const core = fs.readFileSync(path.join(__dirname, 'website-analytics-core.txt'), 'utf8').trim();
for (const file of ['index.html', 'public/discovery.js']) {
    const filename = path.join(root, file);
    const original = fs.readFileSync(filename, 'utf8');
    const updated = original.replace(/\/\* WEBSITE ANALYTICS CORE START \*\/[\s\S]*?\/\* WEBSITE ANALYTICS CORE END \*\//, `/* WEBSITE ANALYTICS CORE START */\n${core}\n/* WEBSITE ANALYTICS CORE END */`);
    if (!original.includes('/* WEBSITE ANALYTICS CORE START */')) throw new Error(`Missing core boundary: ${file}`);
    if (process.argv.includes('--check')) {
        if (updated !== original) throw new Error(`Stale embedded analytics: ${file}`);
    } else fs.writeFileSync(filename, updated);
}
