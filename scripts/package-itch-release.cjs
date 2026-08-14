#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const buildDirectory = path.join(root, 'dist-platform');
const releaseDirectory = path.join(root, 'release-artifacts');
const archive = path.join(releaseDirectory, 'mythical-void-itch-private-test.zip');
const manifestPath = path.join(releaseDirectory, 'mythical-void-itch-private-test.json');

if (!fs.existsSync(path.join(buildDirectory, 'index.html'))) {
    console.error('Itch package failed: run npm run build:portable first.');
    process.exit(1);
}

fs.mkdirSync(releaseDirectory, { recursive: true });
for (const generatedFile of [archive, manifestPath]) {
    if (fs.existsSync(generatedFile)) fs.unlinkSync(generatedFile);
}

const zip = spawnSync('zip', ['-q', '-r', archive, '.'], {
    cwd: buildDirectory,
    encoding: 'utf8'
});
if (zip.status !== 0) {
    console.error(`Itch package failed: ${zip.stderr || 'zip command failed'}`);
    process.exit(1);
}

const listing = spawnSync('unzip', ['-Z1', archive], { encoding: 'utf8' });
if (listing.status !== 0) {
    console.error(`Itch package failed: ${listing.stderr || 'archive could not be inspected'}`);
    process.exit(1);
}
const entries = listing.stdout.split(/\r?\n/).filter(Boolean);
if (!entries.includes('index.html')) {
    console.error('Itch package failed: index.html is not at the archive root.');
    process.exit(1);
}
if (entries.some(entry => entry.startsWith('dist-platform/'))) {
    console.error('Itch package failed: the build directory was wrapped around the archive contents.');
    process.exit(1);
}

const archiveBytes = fs.readFileSync(archive);
const manifest = {
    schemaVersion: 1,
    kind: 'itch-private-test-archive',
    builtAt: new Date().toISOString(),
    file: path.relative(root, archive),
    bytes: archiveBytes.length,
    mib: Number((archiveBytes.length / 1024 / 1024).toFixed(2)),
    sha256: crypto.createHash('sha256').update(archiveBytes).digest('hex'),
    entryCount: entries.length,
    indexAtArchiveRoot: true,
    publicationAuthorized: false,
    note: 'Internal upload artifact for a private platform test only.'
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(manifest, null, 2));
