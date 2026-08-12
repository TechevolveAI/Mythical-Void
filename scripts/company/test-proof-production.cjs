#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-proof-production.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/content/proof-production.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a027-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

function replaceBrief(id, changes) {
    return source.briefs.map(brief => brief.id === id ? { ...brief, ...changes(brief) } : brief);
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.proofProductionPlanValid, true);
    assert.strictEqual(baseline.output.stableBuildRecorded, false);
    assert.strictEqual(baseline.output.briefCount, 3);
    assert.strictEqual(baseline.output.internalBriefReadyCount, 3);
    assert.strictEqual(baseline.output.captureReadyCount, 0);
    assert.strictEqual(baseline.output.proofApprovalReadyCount, 0);
    assert.strictEqual(baseline.output.publicationReadyCount, 0);

    const publicationAuthority = execute('publication-authority', {
        ...source,
        authority: { ...source.authority, publicationAuthorized: true }
    });
    assert.strictEqual(publicationAuthority.status, 1);
    assert(publicationAuthority.output.failures.some(failure => failure.includes('publicationAuthorized')));

    const syntheticGameplay = execute('synthetic-gameplay', {
        ...source,
        authority: { ...source.authority, syntheticGameplayPermitted: true }
    });
    assert.strictEqual(syntheticGameplay.status, 1);
    assert(syntheticGameplay.output.failures.some(failure => failure.includes('syntheticGameplayPermitted')));

    const personalData = execute('personal-data', {
        ...source,
        authority: { ...source.authority, personalDataInCapturePermitted: true }
    });
    assert.strictEqual(personalData.status, 1);
    assert(personalData.output.failures.some(failure => failure.includes('personalDataInCapturePermitted')));

    const montageSubstitution = execute('montage-substitution', {
        ...source,
        productionPolicy: { ...source.productionPolicy, montageMayReplaceContinuousEvidence: true }
    });
    assert.strictEqual(montageSubstitution.status, 1);
    assert(montageSubstitution.output.failures.some(failure => failure.includes('montageMayReplaceContinuousEvidence')));

    const prematureCapture = execute('premature-capture', {
        ...source,
        briefs: replaceBrief('PB-001', () => ({ captureReady: true }))
    });
    assert.strictEqual(prematureCapture.status, 1);
    assert(prematureCapture.output.failures.some(failure => failure.includes('PB-001 claims capture readiness')));

    const prematureApproval = execute('premature-approval', {
        ...source,
        briefs: replaceBrief('PB-002', () => ({ proofApprovalReady: true }))
    });
    assert.strictEqual(prematureApproval.status, 1);
    assert(prematureApproval.output.failures.some(failure => failure.includes('PB-002 claims proof approval readiness')));

    const unknownClaim = execute('unknown-claim', {
        ...source,
        briefs: replaceBrief('PB-003', brief => ({ claimRefs: [...brief.claimRefs, 'CL-999'] }))
    });
    assert.strictEqual(unknownClaim.status, 1);
    assert(unknownClaim.output.failures.some(failure => failure.includes('CL-999')));

    const duplicateProof = execute('duplicate-proof', {
        ...source,
        briefs: replaceBrief('PB-003', () => ({ proofId: 'PF-004' }))
    });
    assert.strictEqual(duplicateProof.status, 1);
    assert(duplicateProof.output.failures.some(failure => failure.includes('PF-004 must be assigned to exactly one')));

    const weakNonClaims = execute('weak-non-claims', {
        ...source,
        briefs: replaceBrief('PB-001', brief => ({ doesNotProve: brief.doesNotProve.slice(0, 1) }))
    });
    assert.strictEqual(weakNonClaims.status, 1);
    assert(weakNonClaims.output.failures.some(failure => failure.includes('explicit non-claims')));

    console.log('A-027 proof-production evaluations passed (10 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

