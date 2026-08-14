#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-live-search-findability.cjs');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/search/LIVE_SEARCH_FINDABILITY_EVIDENCE_2026-08-14.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-live-search-'));

function run(name, value) {
    const file = path.join(temp, `${name}.json`);
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    return spawnSync(process.execPath, [validator, file], { cwd: root, encoding: 'utf8' });
}

try {
    if (run('valid', source).status !== 0) throw new Error('Valid live search evidence was rejected.');

    const inventedResult = structuredClone(source);
    inventedResult.publicSearchSample.ownedResultObserved = true;
    if (run('invented-result', inventedResult).status === 0) throw new Error('An invented search result was accepted.');

    const inventedConsole = structuredClone(source);
    inventedConsole.webmasterEvidence.googleSearchConsoleConnected = true;
    if (run('invented-console', inventedConsole).status === 0) throw new Error('Invented Search Console access was accepted.');

    const inventedStoryRelease = structuredClone(source);
    inventedStoryRelease.ownedCrawlFoundation.sitemapRoutes.push('/story/');
    inventedStoryRelease.ownedCrawlFoundation.sitemapRouteCount += 1;
    if (run('invented-story-release', inventedStoryRelease).status === 0) throw new Error('An invented live story route was accepted.');

    const submissionAuthority = structuredClone(source);
    submissionAuthority.authority.searchEngineSubmissionAuthorized = true;
    if (run('submission-authority', submissionAuthority).status === 0) throw new Error('Unauthorized search submission was accepted.');

    console.log('Live search findability tests passed: valid evidence plus 4 discovery and authority mutations checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
