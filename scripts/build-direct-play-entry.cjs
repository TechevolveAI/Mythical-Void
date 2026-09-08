#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const HOME_URL = 'https://mythicalvoid.com/';
const PLAY_URL = 'https://mythicalvoid.com/play/';

function buildDirectPlayHtml(source) {
    if (typeof source !== 'string' || source.length === 0) {
        throw new Error('Built homepage HTML is empty');
    }

    const canonical = `<link rel="canonical" href="${HOME_URL}">`;
    const openGraphUrl = `<meta property="og:url" content="${HOME_URL}">`;
    if (!source.includes(canonical) || !source.includes(openGraphUrl)) {
        throw new Error('Built homepage metadata anchors are missing');
    }

    const output = source
        .replace(canonical, `<link rel="canonical" href="${PLAY_URL}">`)
        .replace(openGraphUrl, `<meta property="og:url" content="${PLAY_URL}">`)
        .replace(
            '<meta name="theme-color" content="#090711">',
            '<meta name="theme-color" content="#090711">\n    <meta name="mythical-entry" content="direct-play">'
        );

    if (
        !output.includes(`<link rel="canonical" href="${PLAY_URL}">`)
        || !output.includes(`<meta property="og:url" content="${PLAY_URL}">`)
        || !output.includes('<meta name="mythical-entry" content="direct-play">')
    ) {
        throw new Error('Direct Play metadata was not written');
    }
    return output;
}

function writeDirectPlayEntry(distDir = path.resolve(__dirname, '../dist')) {
    const sourcePath = path.join(distDir, 'index.html');
    const outputPath = path.join(distDir, 'play', 'index.html');
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Built homepage not found: ${sourcePath}`);
    }

    const output = buildDirectPlayHtml(fs.readFileSync(sourcePath, 'utf8'));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, output, 'utf8');
    return { sourcePath, outputPath, bytes: Buffer.byteLength(output) };
}

if (require.main === module) {
    try {
        const result = writeDirectPlayEntry();
        process.stdout.write(`${JSON.stringify({ valid: true, ...result })}\n`);
    } catch (error) {
        process.stderr.write(`[direct-play-entry] ${error.message}\n`);
        process.exitCode = 1;
    }
}

module.exports = {
    HOME_URL,
    PLAY_URL,
    buildDirectPlayHtml,
    writeDirectPlayEntry
};
