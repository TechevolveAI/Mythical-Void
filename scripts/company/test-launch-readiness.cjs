#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-launch-readiness.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/growth/launch-readiness.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a026-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

function replaceStage(id, changes) {
    return source.stages.map(stage => stage.id === id ? { ...stage, ...changes(stage) } : stage);
}

function replaceTrack(id, changes) {
    return source.tracks.map(track => track.id === id ? { ...track, ...changes(track) } : track);
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.launchPlanValid, true);
    assert.strictEqual(baseline.output.currentStageId, 'LS-001');
    assert.strictEqual(baseline.output.currentStageReady, true);
    assert.strictEqual(baseline.output.readyTrackCount, 0);
    assert.strictEqual(baseline.output.advancedStageReadyCount, 1);
    assert.strictEqual(baseline.output.broadLaunchReady, false);
    assert.strictEqual(baseline.output.paidLaunchReady, false);
    assert.strictEqual(baseline.output.acceptedCustomerEvidenceCount, 0);
    assert.strictEqual(baseline.output.gameplayProofApprovedCount, 0);

    const unsupportedCompletion = execute('unsupported-completion', {
        ...source,
        stages: replaceStage('LS-003', () => ({ completedEvidenceRef: 'INVENTED-EVIDENCE' }))
    });
    assert.strictEqual(unsupportedCompletion.status, 1);
    assert(unsupportedCompletion.output.failures.some(failure => failure.includes('LS-003')));

    const launchAuthorization = execute('launch-authorization', {
        ...source,
        authority: { ...source.authority, launchAuthorized: true }
    });
    assert.strictEqual(launchAuthorization.status, 1);
    assert(launchAuthorization.output.failures.some(failure => failure.includes('launchAuthorized')));

    const childTargeting = execute('child-targeting', {
        ...source,
        authority: { ...source.authority, behavioralTargetingOfMinorsPermitted: true }
    });
    assert.strictEqual(childTargeting.status, 1);
    assert(childTargeting.output.failures.some(failure => failure.includes('behavioralTargetingOfMinorsPermitted')));

    const prematureResearch = execute('premature-research', {
        ...source,
        stages: replaceStage('LS-002', () => ({ ready: true }))
    });
    assert.strictEqual(prematureResearch.status, 1);
    assert(prematureResearch.output.failures.some(failure => failure.includes('LS-002 claims readiness')));

    const prematureBroadLaunch = execute('premature-broad-launch', {
        ...source,
        stages: replaceStage('LS-006', () => ({ ready: true }))
    });
    assert.strictEqual(prematureBroadLaunch.status, 1);
    assert(prematureBroadLaunch.output.failures.some(failure => failure.includes('LS-006 claims readiness')));

    const prematurePaid = execute('premature-paid', {
        ...source,
        authority: { ...source.authority, paidAcquisitionAuthorized: true }
    });
    assert.strictEqual(prematurePaid.status, 1);
    assert(prematurePaid.output.failures.some(failure => failure.includes('paidAcquisitionAuthorized')));

    const falseTrackReadiness = execute('false-track-readiness', {
        ...source,
        tracks: replaceTrack('LT-001', () => ({ status: 'ready', ready: true, blockers: [] }))
    });
    assert.strictEqual(falseTrackReadiness.status, 1);
    assert(falseTrackReadiness.output.failures.some(failure => failure.includes('LT-001 claims readiness')));

    const unknownProof = execute('unknown-proof', {
        ...source,
        stages: replaceStage('LS-004', stage => ({ proofIds: [...stage.proofIds, 'PF-999'] }))
    });
    assert.strictEqual(unknownProof.status, 1);
    assert(unknownProof.output.failures.some(failure => failure.includes('PF-999')));

    const laterStageBypass = execute('later-stage-bypass', {
        ...source,
        principles: { ...source.principles, laterStageMayBypassEarlierRequiredStage: true }
    });
    assert.strictEqual(laterStageBypass.status, 1);
    assert(laterStageBypass.output.failures.some(failure => failure.includes('laterStageMayBypassEarlierRequiredStage')));

    const conversationApproval = execute('conversation-approval', {
        ...source,
        authority: { ...source.authority, agentMayTreatConversationAsAuthorization: true }
    });
    assert.strictEqual(conversationApproval.status, 1);
    assert(conversationApproval.output.failures.some(failure => failure.includes('agentMayTreatConversationAsAuthorization')));

    console.log('A-026 launch-readiness evaluations passed (11 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
