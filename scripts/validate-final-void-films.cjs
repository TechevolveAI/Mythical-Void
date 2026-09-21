const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function validateFinalVoidFilms(root, { requireReady = false } = {}) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/config/final-void-films.json'), 'utf8'));
    const problems = [];
    if (manifest.schemaVersion !== 1 || manifest.encounterId !== 'trumptopus') problems.push('Invalid finale manifest');
    if (typeof manifest.enabled !== 'boolean') problems.push('Enabled must be a boolean');
    let totalBytes = 0;
    for (const beat of ['arrival', 'victory']) {
        const definition = manifest.films?.[beat];
        if (definition?.approved !== true || !definition.asset) {
            if (requireReady || manifest.enabled) problems.push(`${beat}: reviewed film missing`);
            continue;
        }
        const asset = definition.asset;
        if (!/^\/game\/cinematics\/[a-z0-9/_.-]+\.mp4$/i.test(asset.url || '') || asset.url.includes('..')) {
            problems.push(`${beat}: invalid asset path`);
            continue;
        }
        const file = path.join(root, 'public', asset.url);
        if (!fs.existsSync(file)) { problems.push(`${beat}: file missing`); continue; }
        const bytes = fs.readFileSync(file);
        totalBytes += bytes.length;
        if (bytes.length !== asset.bytes || bytes.length > 8 * 1024 * 1024) problems.push(`${beat}: incorrect size/budget`);
        if (crypto.createHash('sha256').update(bytes).digest('hex') !== asset.sha256) problems.push(`${beat}: incorrect digest`);
        if (bytes.toString('ascii', 4, 8) !== 'ftyp') problems.push(`${beat}: not an MP4`);
        if (!(asset.durationSeconds > 0 && asset.durationSeconds <= 60)) problems.push(`${beat}: duration missing/invalid`);
        if (!definition.review?.reviewer || !definition.review?.provenancePath) problems.push(`${beat}: review/provenance missing`);
        else if (!fs.existsSync(path.resolve(root, definition.review.provenancePath))) problems.push(`${beat}: provenance file missing`);
    }
    if (totalBytes > 12 * 1024 * 1024) problems.push('Combined film budget exceeded');
    return { ready: problems.length === 0 && manifest.films?.arrival?.approved === true && manifest.films?.victory?.approved === true, enabled: manifest.enabled, totalBytes, problems };
}

if (require.main === module) {
    const report = validateFinalVoidFilms(path.resolve(__dirname, '..'), { requireReady: process.argv.includes('--require-ready') });
    console.log(JSON.stringify(report, null, 2));
    if (report.problems.length) process.exitCode = 1;
}
module.exports = { validateFinalVoidFilms };
