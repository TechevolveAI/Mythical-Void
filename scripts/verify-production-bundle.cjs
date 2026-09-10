#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REMOVABLE_CONSOLE_CALL = /\bconsole\.(?:log|info|debug)\s*\(/g;

function inspectProductionBundle(distDir) {
    const assetsDir = path.join(distDir, 'assets');
    if (!fs.existsSync(assetsDir)) {
        throw new Error(`Production assets directory not found: ${assetsDir}`);
    }

    const applicationChunks = fs.readdirSync(assetsDir)
        .filter(fileName => (
            fileName.endsWith('.js') &&
            !fileName.startsWith('vendor-')
        ));

    if (applicationChunks.length === 0) {
        throw new Error(`No production application chunks found in ${assetsDir}`);
    }

    const failures = applicationChunks.flatMap(fileName => {
        const source = fs.readFileSync(path.join(assetsDir, fileName), 'utf8');
        const matches = source.match(REMOVABLE_CONSOLE_CALL) || [];
        return matches.length > 0
            ? [{ fileName, count: matches.length }]
            : [];
    });

    const directPlayPath = path.join(distDir, 'play', 'index.html');
    const directPlayHtml = fs.existsSync(directPlayPath)
        ? fs.readFileSync(directPlayPath, 'utf8')
        : '';
    const directPlayMetadataValid = Boolean(
        directPlayHtml.includes('<meta name="mythical-entry" content="direct-play">')
        && directPlayHtml.includes('<link rel="canonical" href="https://mythicalvoid.com/play/">')
        && directPlayHtml.includes('<meta property="og:url" content="https://mythicalvoid.com/play/">')
        && directPlayHtml.includes('<title>Play Mythical Void Free | Alien Creature Browser Game</title>')
        && directPlayHtml.includes('<meta name="description" content="Start Mythical Void free in your browser.')
        && directPlayHtml.includes('"mainEntityOfPage": { "@id": "https://mythicalvoid.com/play/" }')
        && directPlayHtml.includes('https://mythicalvoid.com/marketing/mythical-void-brand-link-card-v1.png')
        && /brand art, not gameplay/i.test(directPlayHtml)
        && !directPlayHtml.includes('__BUILD_TIMESTAMP__')
    );

    return {
        applicationChunkCount: applicationChunks.length,
        removableConsoleCallCount: failures.reduce(
            (total, failure) => total + failure.count,
            0
        ),
        directPlayEntryPresent: Boolean(directPlayHtml),
        directPlayMetadataValid,
        failures
    };
}

function verifyProductionBundle(distDir = path.resolve(__dirname, '../dist')) {
    const result = inspectProductionBundle(distDir);
    if (result.failures.length > 0) {
        const details = result.failures
            .map(({ fileName, count }) => `${fileName}: ${count}`)
            .join(', ');
        throw new Error(
            `Production bundle retained console.log/info/debug calls (${details})`
        );
    }
    if (!result.directPlayEntryPresent) {
        throw new Error('Production bundle is missing play/index.html');
    }
    if (!result.directPlayMetadataValid) {
        throw new Error('Production direct Play metadata is missing or misleading');
    }
    return result;
}

if (require.main === module) {
    try {
        const result = verifyProductionBundle();
        process.stdout.write(`${JSON.stringify({
            valid: true,
            ...result
        })}\n`);
    } catch (error) {
        process.stderr.write(`[production-bundle] ${error.message}\n`);
        process.exitCode = 1;
    }
}

module.exports = {
    REMOVABLE_CONSOLE_CALL,
    inspectProductionBundle,
    verifyProductionBundle
};
