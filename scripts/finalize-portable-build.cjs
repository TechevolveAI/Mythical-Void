#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist-platform');

if (!fs.existsSync(path.join(output, 'index.html'))) {
    console.error('Portable build finalization failed: dist-platform/index.html is missing.');
    process.exit(1);
}

function walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const absolute = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(absolute) : [absolute];
    });
}

const textFiles = walk(output).filter(file => /\.(?:html|js|css)$/.test(file));
const publicRoots = ['game', 'audio'];

for (const file of textFiles) {
    let source = fs.readFileSync(file, 'utf8');
    for (const rootName of publicRoots) {
        source = source
            .replaceAll(`"/${rootName}/`, `"./${rootName}/`)
            .replaceAll(`'/${rootName}/`, `'./${rootName}/`)
            .replaceAll(`url(/${rootName}/`, `url(./${rootName}/`);
    }
    fs.writeFileSync(file, source, 'utf8');
}

const manifest = {
    schemaVersion: 1,
    kind: 'portable-browser-game',
    builtAt: new Date().toISOString(),
    entry: 'index.html',
    relativeAssetPaths: true,
    optionalApiFeatures: false,
    aiPortraits: false,
    aiVideos: false,
    cloudSaves: false,
    observabilityDelivery: false,
    localProgress: true,
    publishingAuthorized: false,
    note: 'Internal test artifact. Platform publication still requires Kevin approval.'
};

fs.writeFileSync(
    path.join(output, 'distribution-release.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
);

console.log(JSON.stringify({
    finalized: true,
    output: path.relative(root, output),
    rewrittenTextFiles: textFiles.length,
    ...manifest
}, null, 2));
