#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-search-opportunity-map.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/search/search-opportunities.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a021-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.mapValid, true);
    assert.strictEqual(baseline.output.clusterCount, 6);
    assert.strictEqual(baseline.output.publicationReadyClusterCount, 0);
    assert.strictEqual(baseline.output.searchSubmissionReadyClusterCount, 0);
    assert.strictEqual(baseline.output.sampledBrandedResultObserved, false);
    assert.strictEqual(baseline.output.verifiedWebmasterSourceConnected, false);

    const publish = execute('publication-authorized', { ...source, publicationAuthorized: true });
    assert.strictEqual(publish.status, 1);
    assert(publish.output.failures.some(failure => failure.includes('publicationAuthorized')));

    const fabricatedRank = execute('fabricated-rank', {
        ...source,
        clusters: source.clusters.map((item, index) => index === 0 ? { ...item, rankingPosition: 1 } : item)
    });
    assert.strictEqual(fabricatedRank.status, 1);
    assert(fabricatedRank.output.failures.some(failure => failure.includes('rankingPosition')));

    const blockedClaim = execute('blocked-claim', {
        ...source,
        clusters: source.clusters.map((item, index) => index === 1 ? { ...item, claimIds: [...item.claimIds, 'CL-012'] } : item)
    });
    assert.strictEqual(blockedClaim.status, 1);
    assert(blockedClaim.output.failures.some(failure => failure.includes('blocked/restricted claims')));

    const unknownProof = execute('unknown-proof', {
        ...source,
        clusters: source.clusters.map((item, index) => index === 2 ? { ...item, proofIds: [...item.proofIds, 'PF-999'] } : item)
    });
    assert.strictEqual(unknownProof.status, 1);
    assert(unknownProof.output.failures.some(failure => failure.includes('PF-999')));

    const prematureReady = execute('premature-ready', {
        ...source,
        clusters: source.clusters.map((item, index) => index === 3 ? { ...item, publicationReady: true } : item)
    });
    assert.strictEqual(prematureReady.status, 1);
    assert(prematureReady.output.failures.some(failure => failure.includes('publicationReady')));

    const paidSearch = execute('paid-search', { ...source, paidSearchAuthorized: true });
    assert.strictEqual(paidSearch.status, 1);
    assert(paidSearch.output.failures.some(failure => failure.includes('paidSearchAuthorized')));

    console.log('A-021 search opportunity map evaluations passed (7 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
