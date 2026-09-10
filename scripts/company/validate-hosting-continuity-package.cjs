#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const defaultOutputDir = path.join(root, 'dist-continuity');
const MAX_FILES = 20_000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const requiredFiles = [
    'index.html',
    '404.html',
    'play/index.html',
    'game/index.html',
    'privacy/index.html',
    'terms/index.html',
    'sitemap.xml',
    'robots.txt',
    'updates/feed.xml',
    'updates/feed.json',
    'api/unavailable.json',
    '_redirects',
    '_headers',
    'hosting-continuity.json'
];
const withdrawnPaths = [
    'press/gameplay',
    'press/gameplay-video',
    'press/social',
    'press/social-video',
    'press/creator-kit',
    'resources/mythical-void-play-share-card.pdf',
    'resources/previews/play-share-card.png'
];

function listFiles(directory, relative = '') {
    return fs.readdirSync(path.join(directory, relative), { withFileTypes: true })
        .flatMap(entry => {
            const next = path.join(relative, entry.name);
            return entry.isDirectory() ? listFiles(directory, next) : [next];
        });
}

function validateContinuityPackage(outputDir = defaultOutputDir) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    requireValue(fs.existsSync(outputDir), 'The continuity build directory does not exist.');
    if (!fs.existsSync(outputDir)) return { ready: false, failures, fileCount: 0, largestFileBytes: 0 };

    requiredFiles.forEach(file => requireValue(fs.existsSync(path.join(outputDir, file)), `Missing required continuity file: ${file}`));
    withdrawnPaths.forEach(file => requireValue(!fs.existsSync(path.join(outputDir, file)), `Withdrawn public media remains in continuity package: ${file}`));
    const files = listFiles(outputDir);
    const measured = files.map(file => ({ file, bytes: fs.statSync(path.join(outputDir, file)).size }));
    const largest = measured.reduce((best, item) => item.bytes > best.bytes ? item : best, { file: null, bytes: 0 });
    requireValue(files.length <= MAX_FILES, `Continuity package has ${files.length} files; the portable limit is ${MAX_FILES}.`);
    requireValue(largest.bytes <= MAX_FILE_BYTES, `Largest file ${largest.file} is ${largest.bytes} bytes; the portable limit is ${MAX_FILE_BYTES}.`);

    if (fs.existsSync(path.join(outputDir, 'index.html'))) {
        const index = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8');
        requireValue(index.includes('data-hosting-continuity="static"'), 'Built entry does not identify static continuity mode.');
        requireValue(!index.includes('googletagmanager.com'), 'Website analytics must be disabled in the emergency copy.');
    }

    if (fs.existsSync(path.join(outputDir, '_redirects'))) {
        const redirects = fs.readFileSync(path.join(outputDir, '_redirects'), 'utf8');
        requireValue(redirects.includes('/api/* /api/unavailable.json 200'), 'Optional APIs do not fail into the honest unavailable response.');
        requireValue(redirects.includes('/* /index.html 200'), 'Portable SPA fallback is missing.');
        requireValue(!redirects.includes('/.netlify/functions/:splat'), 'Continuity redirects still depend on the failed primary host runtime.');
    }

    if (fs.existsSync(path.join(outputDir, 'hosting-continuity.json'))) {
        const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, 'hosting-continuity.json'), 'utf8'));
        requireValue(manifest.mode === 'static_continuity', 'Continuity manifest mode is invalid.');
        requireValue(manifest.capabilities?.website === 'available', 'Website availability is not recorded.');
        requireValue(manifest.capabilities?.browserGame === 'available', 'Browser game availability is not recorded.');
        requireValue(manifest.capabilities?.livePresence === 'unavailable', 'Live presence must not be claimed in static continuity mode.');
        requireValue(manifest.capabilities?.adultFeedbackSending === 'unavailable', 'Feedback sending must not be claimed in static continuity mode.');
        requireValue(manifest.capabilities?.websiteAnalytics === 'disabled', 'Analytics must be recorded as disabled in static continuity mode.');
        requireValue(manifest.externalActionTaken === false, 'The local package must not claim an external action.');
        requireValue(manifest.deploymentAuthorized === false, 'The local package must not claim deployment approval.');
        requireValue(manifest.customDomainChangeAuthorized === false, 'The local package must not claim domain-change approval.');
    }

    return {
        ready: failures.length === 0,
        failures,
        fileCount: files.length,
        largestFile: largest.file,
        largestFileBytes: largest.bytes,
        outputDir
    };
}

if (require.main === module) {
    const assessment = validateContinuityPackage(process.argv[2] ? path.resolve(process.argv[2]) : defaultOutputDir);
    process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
    if (!assessment.ready) process.exitCode = 1;
}

module.exports = {
    MAX_FILE_BYTES,
    MAX_FILES,
    requiredFiles,
    withdrawnPaths,
    validateContinuityPackage
};
