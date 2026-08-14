#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const recorder = path.join(__dirname, 'record-search-console-evidence.cjs');
const validator = path.join(__dirname, 'validate-search-console-connection.cjs');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/search/SEARCH_CONSOLE_CONNECTION.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-search-console-'));

function write(name, value = source) {
    const file = path.join(temp, `${name}.json`);
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    return file;
}

function record(name, args, initial = source) {
    const connection = write(name, initial);
    const result = spawnSync(process.execPath, [recorder, '--connection', connection, '--skip-dashboard', ...args], { cwd: root, encoding: 'utf8' });
    return { connection, result };
}

try {
    const current = write('current');
    if (spawnSync(process.execPath, [validator, current], { cwd: root }).status !== 0) throw new Error('Current Search Console state was rejected.');

    const verified = record('verified', ['--stage', 'property', '--property-type', 'domain', '--property', 'mythicalvoid.com', '--verified-by', 'Kevin Murphy', '--verified-at', '2026-08-14T19:30:00Z', '--apply']);
    if (verified.result.status !== 0 || spawnSync(process.execPath, [validator, verified.connection], { cwd: root }).status !== 0) throw new Error(`Valid Domain verification failed: ${verified.result.stderr}`);
    const verifiedState = JSON.parse(fs.readFileSync(verified.connection, 'utf8'));

    const sitemap = record('sitemap', ['--stage', 'sitemap', '--verified-by', 'Kevin Murphy', '--sitemap-url', 'https://mythicalvoid.com/sitemap.xml', '--sitemap-status', 'Success', '--submitted-at', '2026-08-14T19:35:00Z', '--last-read-at', 'not shown', '--discovered-urls', '9', '--apply'], verifiedState);
    if (sitemap.result.status !== 0 || spawnSync(process.execPath, [validator, sitemap.connection], { cwd: root }).status !== 0) throw new Error(`Valid sitemap evidence failed: ${sitemap.result.stderr}`);

    const fakeProperty = record('fake-property', ['--stage', 'property', '--property-type', 'url-prefix', '--property', 'https://mythicalvoid.com/', '--verified-by', 'Kevin Murphy', '--verified-at', '2026-08-14T19:30:00Z', '--apply']);
    if (fakeProperty.result.status === 0) throw new Error('Unapproved property type was accepted.');

    const wrongConfirmer = record('wrong-confirmer', ['--stage', 'property', '--property-type', 'domain', '--property', 'mythicalvoid.com', '--verified-by', 'Studio Agent', '--verified-at', '2026-08-14T19:30:00Z', '--apply']);
    if (wrongConfirmer.result.status === 0) throw new Error('Non-Kevin verification was accepted.');

    const earlySitemap = record('early-sitemap', ['--stage', 'sitemap', '--verified-by', 'Kevin Murphy', '--sitemap-url', 'https://mythicalvoid.com/sitemap.xml', '--sitemap-status', 'Success', '--submitted-at', '2026-08-14T19:35:00Z', '--apply']);
    if (earlySitemap.result.status === 0) throw new Error('Sitemap submission before property verification was accepted.');

    const inventedRanking = structuredClone(source);
    inventedRanking.reporting.rankingKnown = true;
    if (spawnSync(process.execPath, [validator, write('invented-ranking', inventedRanking)], { cwd: root }).status === 0) throw new Error('Invented ranking evidence was accepted.');

    console.log('Search Console connection tests passed: waiting state, Domain verification, sitemap success, plus 4 property, confirmer, sequence and claim failures checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
