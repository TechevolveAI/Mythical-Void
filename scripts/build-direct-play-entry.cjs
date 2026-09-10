#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const HOME_URL = 'https://mythicalvoid.com/';
const PLAY_URL = 'https://mythicalvoid.com/play/';
const HOME_TITLE = 'Mythical Void | Free Creature Adventure Browser Game';
const PLAY_TITLE = 'Play Mythical Void Free | Alien Creature Browser Game';
const HOME_DESCRIPTION = 'Play Mythical Void free in your browser. Hatch a varied alien creature, explore six living realms, restore their guardians and decide what your mission should tell Earth.';
const PLAY_DESCRIPTION = 'Start Mythical Void free in your browser. Hatch an alien creature, explore six strange worlds and restore their Guardians. No download or account needed.';
const HOME_SHARE_DESCRIPTION = 'Hatch a varied alien creature, explore six living realms and decide what your mission should tell Earth. Play free in your browser.';
const PLAY_SHARE_DESCRIPTION = 'Hatch an alien creature and explore six strange worlds. Play Mythical Void free in your browser — no download or account needed.';

function buildDirectPlayHtml(source) {
    if (typeof source !== 'string' || source.length === 0) {
        throw new Error('Built homepage HTML is empty');
    }

    const canonical = `<link rel="canonical" href="${HOME_URL}">`;
    const openGraphUrl = `<meta property="og:url" content="${HOME_URL}">`;
    const anchors = [
        canonical,
        openGraphUrl,
        `<title>${HOME_TITLE}</title>`,
        `<meta name="description" content="${HOME_DESCRIPTION}">`,
        `<meta property="og:title" content="${HOME_TITLE}">`,
        `<meta property="og:description" content="${HOME_SHARE_DESCRIPTION}">`,
        `<meta name="twitter:title" content="${HOME_TITLE}">`,
        `<meta name="twitter:description" content="${HOME_SHARE_DESCRIPTION}">`,
        '"mainEntityOfPage": { "@id": "https://mythicalvoid.com/#website" }',
        '<h1>Opening the Void…</h1>',
        '<p class="game-entry-loader__copy">Preparing your creature and the worlds beyond.</p>'
    ];
    if (anchors.some(anchor => !source.includes(anchor))) {
        throw new Error('Built homepage metadata anchors are missing');
    }

    const output = source
        .replace(canonical, `<link rel="canonical" href="${PLAY_URL}">`)
        .replace(openGraphUrl, `<meta property="og:url" content="${PLAY_URL}">`)
        .replace(`<title>${HOME_TITLE}</title>`, `<title>${PLAY_TITLE}</title>`)
        .replace(
            `<meta name="description" content="${HOME_DESCRIPTION}">`,
            `<meta name="description" content="${PLAY_DESCRIPTION}">`
        )
        .replace(
            `<meta property="og:title" content="${HOME_TITLE}">`,
            `<meta property="og:title" content="${PLAY_TITLE}">`
        )
        .replace(
            `<meta property="og:description" content="${HOME_SHARE_DESCRIPTION}">`,
            `<meta property="og:description" content="${PLAY_SHARE_DESCRIPTION}">`
        )
        .replace(
            `<meta name="twitter:title" content="${HOME_TITLE}">`,
            `<meta name="twitter:title" content="${PLAY_TITLE}">`
        )
        .replace(
            `<meta name="twitter:description" content="${HOME_SHARE_DESCRIPTION}">`,
            `<meta name="twitter:description" content="${PLAY_SHARE_DESCRIPTION}">`
        )
        .replace(
            '"mainEntityOfPage": { "@id": "https://mythicalvoid.com/#website" }',
            `"mainEntityOfPage": { "@id": "${PLAY_URL}" }`
        )
        .replace('<h1>Opening the Void…</h1>', '<h1>Play Mythical Void</h1>')
        .replace(
            '<p class="game-entry-loader__copy">Preparing your creature and the worlds beyond.</p>',
            '<p class="game-entry-loader__copy">Hatch an alien creature and begin your journey through six strange worlds.</p>'
        )
        .replace(
            '<meta name="theme-color" content="#090711">',
            '<meta name="theme-color" content="#090711">\n    <meta name="mythical-entry" content="direct-play">'
        );

    if (
        !output.includes(`<link rel="canonical" href="${PLAY_URL}">`)
        || !output.includes(`<meta property="og:url" content="${PLAY_URL}">`)
        || !output.includes('<meta name="mythical-entry" content="direct-play">')
        || !output.includes(`<title>${PLAY_TITLE}</title>`)
        || !output.includes(`<meta name="description" content="${PLAY_DESCRIPTION}">`)
        || !output.includes(`<meta property="og:title" content="${PLAY_TITLE}">`)
        || !output.includes(`<meta name="twitter:title" content="${PLAY_TITLE}">`)
        || !output.includes(`"mainEntityOfPage": { "@id": "${PLAY_URL}" }`)
        || !output.includes('<h1>Play Mythical Void</h1>')
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
    HOME_DESCRIPTION,
    HOME_SHARE_DESCRIPTION,
    HOME_TITLE,
    PLAY_URL,
    PLAY_DESCRIPTION,
    PLAY_SHARE_DESCRIPTION,
    PLAY_TITLE,
    buildDirectPlayHtml,
    writeDirectPlayEntry
};
