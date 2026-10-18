const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const manifest = require('../fixtures/pinned-source/manifest.json');
const folder = path.join(__dirname, '../fixtures/pinned-source');

// These are immutable regression controls, never a fallback to today's code.
function readPinnedSource(reference) {
    const entry = manifest.entries.find(item => item.reference === reference);
    if (!entry || !/^[a-f0-9]{64}\.source$/.test(entry.fixture) ||
        entry.fixture !== `${entry.sha256}.source`) throw Error('PINNED_SOURCE_UNKNOWN');
    let bytes;
    try { bytes = fs.readFileSync(path.join(folder, entry.fixture)); }
    catch (error) { throw Error('PINNED_SOURCE_MISSING', { cause: error }); }
    if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
        throw Error('PINNED_SOURCE_CHANGED');
    }
    return bytes.toString('utf8');
}

module.exports = { readPinnedSource };
