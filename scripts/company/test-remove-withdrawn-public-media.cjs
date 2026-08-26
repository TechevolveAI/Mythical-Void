#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { readVisualPublicationRegister } = require('./visual-publication-policy.cjs');

const root = path.resolve(__dirname, '../..');
const script = path.join(__dirname, 'remove-withdrawn-public-media.cjs');
const register = readVisualPublicationRegister();
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-withdrawn-dist-'));

try {
    for (const prefix of register.withdrawnPathFamilies) {
        const file = path.join(temporary, prefix.replace(/^\/+/, ''), 'should-not-ship.bin');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, 'withdrawn');
    }
    for (const publicPath of register.withdrawnIndividualPaths) {
        const file = path.join(temporary, publicPath.replace(/^\/+/, ''));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, 'withdrawn');
    }
    const approved = path.join(temporary, 'marketing', 'mythical-void-emblem-v3.png');
    fs.mkdirSync(path.dirname(approved), { recursive: true });
    fs.writeFileSync(approved, 'approved');

    const result = spawnSync(process.execPath, [script, temporary], { cwd: root, encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    for (const prefix of register.withdrawnPathFamilies) {
        assert.strictEqual(fs.existsSync(path.join(temporary, prefix.replace(/^\/+/, ''))), false);
    }
    for (const publicPath of register.withdrawnIndividualPaths) {
        assert.strictEqual(fs.existsSync(path.join(temporary, publicPath.replace(/^\/+/, ''))), false);
    }
    assert.strictEqual(fs.readFileSync(approved, 'utf8'), 'approved');
    console.log(`Withdrawn production-media cleanup passed (${register.withdrawnPathFamilies.length + register.withdrawnIndividualPaths.length} targets removed; approved emblem preserved).`);
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
