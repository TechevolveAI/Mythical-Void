#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'dist-platform');
const errors = [];

function walk(directory) {
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const absolute = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(absolute) : [absolute];
    });
}

function read(file) {
    if (!fs.existsSync(file)) {
        errors.push(`${path.relative(root, file)} is missing`);
        return '';
    }
    return fs.readFileSync(file, 'utf8');
}

const index = read(path.join(output, 'index.html'));
const manifestSource = read(path.join(output, 'distribution-release.json'));
let manifest = {};
try {
    manifest = JSON.parse(manifestSource);
} catch (error) {
    errors.push(`distribution-release.json is invalid: ${error.message}`);
}

const files = walk(output);
const text = files
    .filter(file => /\.(?:html|js|css)$/.test(file))
    .map(file => fs.readFileSync(file, 'utf8'))
    .join('\n');
const details = files.map(file => ({ file, bytes: fs.statSync(file).size }));
const totalBytes = details.reduce((sum, item) => sum + item.bytes, 0);
const largestBytes = Math.max(0, ...details.map(item => item.bytes));

if (!index.includes('var isDistributionBuild = true')) errors.push('analytics distribution guard was not compiled on');
if (!index.includes('src="./assets/')) errors.push('entry script is not relative');
if (/(?:src|href)="\//.test(index)) errors.push('index.html still contains root-absolute asset or link paths');
if (/["']\/(?:game|audio)\//.test(text) || /url\(\/(?:game|audio)\//.test(text)) {
    errors.push('portable bundle still contains root-absolute game or audio paths');
}
for (const [key, expected] of Object.entries({
    kind: 'portable-browser-game',
    relativeAssetPaths: true,
    optionalApiFeatures: false,
    aiPortraits: false,
    aiVideos: false,
    cloudSaves: false,
    observabilityDelivery: false,
    localProgress: true,
    publishingAuthorized: false
})) {
    if (manifest[key] !== expected) errors.push(`manifest ${key} must be ${JSON.stringify(expected)}`);
}
if (totalBytes > 500 * 1024 * 1024) errors.push('portable build exceeds itch.io published extracted-size ceiling');
if (files.length > 1000) errors.push('portable build exceeds itch.io published file-count ceiling');
if (largestBytes > 200 * 1024 * 1024) errors.push('portable build exceeds itch.io published single-file ceiling');

const mainSource = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const errorHandlerSource = fs.readFileSync(path.join(root, 'src/systems/ErrorHandler.js'), 'utf8');
if (!mainSource.includes('window.__MYTHICAL_DISABLE_OBSERVABILITY__ = isDistributionBuild')) {
    errors.push('portable entry does not disable website-only observability delivery');
}
if (!errorHandlerSource.includes('window.__MYTHICAL_DISABLE_OBSERVABILITY__ !== true')) {
    errors.push('error handler does not honour the portable observability boundary');
}

if (errors.length) {
    console.error('Portable browser build is not ready:\n');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    output: 'dist-platform',
    totalMiB: Number((totalBytes / 1024 / 1024).toFixed(2)),
    fileCount: files.length,
    largestFileMiB: Number((largestBytes / 1024 / 1024).toFixed(2)),
    rootAbsoluteGameOrAudioPaths: 0,
    analyticsGuard: 'on',
    hostedExtras: 'off',
    cloudSaves: 'off',
    observabilityDelivery: 'off',
    publicationAuthorized: false
}, null, 2));
