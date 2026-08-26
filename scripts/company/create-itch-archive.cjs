#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const packageDir = path.join(root, 'dist-itch');
const releaseDir = path.join(root, 'release');
const archivePath = path.join(releaseDir, 'mythical-void-itch-html5.zip');

fs.mkdirSync(releaseDir, { recursive: true });
if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);

const zip = spawnSync('zip', ['-q', '-r', archivePath, '.'], {
    cwd: packageDir,
    encoding: 'utf8'
});
if (zip.status !== 0) throw new Error(zip.stderr || 'zip command failed');

const listing = spawnSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' });
if (listing.status !== 0) throw new Error(listing.stderr || 'archive listing failed');
const entries = listing.stdout.trim().split(/\r?\n/).filter(Boolean);
if (!entries.includes('index.html')) throw new Error('archive does not contain top-level index.html');

const bytes = fs.statSync(archivePath).size;
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(archivePath)).digest('hex');
console.log(JSON.stringify({ archivePath, bytes, entryCount: entries.length, sha256 }, null, 2));
