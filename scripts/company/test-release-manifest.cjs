#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-release-manifest.cjs');
const manifestPath = path.join(repositoryRoot, 'docs', 'company', 'operations', 'release-manifests', 'SHOP_WINDOW_OVERHAUL_2026-08-11.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a018-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', manifest);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.manifestValid, true);
    assert.strictEqual(baseline.output.releaseReady, false);
    assert.strictEqual(baseline.output.deploymentAuthorized, false);
    assert.strictEqual(baseline.output.isolatableFromCurrentWorkingTree, true);
    assert.strictEqual(baseline.output.isolatedArtifactReadyForReview, true);
    assert.strictEqual(baseline.output.artifactDigestValid, true);
    assert.strictEqual(baseline.output.baseApplicationValid, true);
    assert.strictEqual(baseline.output.isolatedResultDigestsValid, true);
    assert.strictEqual(baseline.output.unrelatedStorefrontHunksExcluded, true);
    assert.strictEqual(baseline.output.gameBoundaryPreserved, true);
    assert.strictEqual(baseline.output.socialImageValid, true);
    assert(baseline.output.playLinkCount >= 2);

    const digestMismatch = execute('digest', {
        ...manifest,
        files: manifest.files.map((file, index) => index === 0
            ? { ...file, sha256: '0'.repeat(64) }
            : file)
    });
    assert.strictEqual(digestMismatch.status, 1);
    assert(digestMismatch.output.failures.some(failure => failure.includes('SHA-256 changed')));

    const deployment = execute('deployment', { ...manifest, deploymentAuthorized: true });
    assert.strictEqual(deployment.status, 1);
    assert(deployment.output.failures.some(failure => failure.includes('deploymentAuthorized')));

    const extraFile = execute('extra-file', {
        ...manifest,
        files: [...manifest.files, { ...manifest.files[0], path: 'src/game.js' }]
    });
    assert.strictEqual(extraFile.status, 1);
    assert(extraFile.output.failures.some(failure => failure.includes('out-of-scope file')));

    const prematureReady = execute('ready', { ...manifest, releaseReady: true });
    assert.strictEqual(prematureReady.status, 1);
    assert(prematureReady.output.failures.some(failure => failure.includes('releaseReady')));

    const artifactMismatch = execute('artifact-digest', {
        ...manifest,
        artifact: { ...manifest.artifact, sha256: '0'.repeat(64) }
    });
    assert.strictEqual(artifactMismatch.status, 1);
    assert(artifactMismatch.output.failures.some(failure => failure.includes('artifact SHA-256')));

    const isolatedResultMismatch = execute('isolated-result', {
        ...manifest,
        files: manifest.files.map((file, index) => index === 4
            ? { ...file, isolatedResultSha256: '0'.repeat(64) }
            : file)
    });
    assert.strictEqual(isolatedResultMismatch.status, 1);
    assert(isolatedResultMismatch.output.failures.some(failure => failure.includes('isolated-result')));

    console.log('A-018 release-manifest evaluations passed (7 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
