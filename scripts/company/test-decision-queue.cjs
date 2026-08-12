#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-decision-queue.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/operations/decision-queue.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a025-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

function replacePacket(id, changes) {
    return source.packets.map(packet => packet.id === id ? { ...packet, ...changes(packet) } : packet);
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.queueValid, true);
    assert.strictEqual(baseline.output.queueReadyForReview, true);
    assert.strictEqual(baseline.output.packetCount, 5);
    assert.strictEqual(baseline.output.maximumPackets, 5);
    assert.strictEqual(baseline.output.awaitingDecisionCount, 5);
    assert.strictEqual(baseline.output.criticalOpenRiskCoverageCount, 1);
    assert.strictEqual(baseline.output.automatedDeliveryReady, false);
    assert.strictEqual(baseline.output.externalActionsAuthorized, false);

    const tooMany = execute('too-many', { ...source, packets: [...source.packets, { ...source.packets[4], id: 'KDP-006', priority: 5 }] });
    assert.strictEqual(tooMany.status, 1);
    assert(tooMany.output.failures.some(failure => failure.includes('exceeds maximumPackets')));

    const external = execute('external', { ...source, externalActionsAuthorized: true });
    assert.strictEqual(external.status, 1);
    assert(external.output.failures.some(failure => failure.includes('externalActionsAuthorized')));

    const conversation = execute('conversation', { ...source, conversationIsAuthorization: true });
    assert.strictEqual(conversation.status, 1);
    assert(conversation.output.failures.some(failure => failure.includes('conversationIsAuthorization')));

    const missingCritical = execute('missing-critical', { ...source, packets: source.packets.filter(packet => packet.id !== 'KDP-001').map((packet, index) => ({ ...packet, priority: index + 1 })) });
    assert.strictEqual(missingCritical.status, 1);
    assert(missingCritical.output.failures.some(failure => failure.includes('critical open risk R-001')));

    const unknownReference = execute('unknown-reference', { ...source, packets: replacePacket('KDP-002', packet => ({ evidenceRefs: [...packet.evidenceRefs, 'D-999'] })) });
    assert.strictEqual(unknownReference.status, 1);
    assert(unknownReference.output.failures.some(failure => failure.includes('unknown evidence D-999')));

    const twoRecommendations = execute('two-recommendations', { ...source, packets: replacePacket('KDP-003', packet => ({ optionsAndTradeoffs: packet.optionsAndTradeoffs.map(option => ({ ...option, recommended: true })) })) });
    assert.strictEqual(twoRecommendations.status, 1);
    assert(twoRecommendations.output.failures.some(failure => failure.includes('exactly one recommended option')));

    const executeOnResponse = execute('execute-on-response', { ...source, packets: replacePacket('KDP-004', () => ({ mayExecuteOnResponse: true })) });
    assert.strictEqual(executeOnResponse.status, 1);
    assert(executeOnResponse.output.failures.some(failure => failure.includes('mayExecuteOnResponse')));

    const restrictedData = execute('restricted-data', { ...source, packets: replacePacket('KDP-002', () => ({ containsRestrictedData: true })) });
    assert.strictEqual(restrictedData.status, 1);
    assert(restrictedData.output.failures.some(failure => failure.includes('containsRestrictedData')));

    const duplicatePriority = execute('duplicate-priority', { ...source, packets: replacePacket('KDP-005', () => ({ priority: 4 })) });
    assert.strictEqual(duplicatePriority.status, 1);
    assert(duplicatePriority.output.failures.some(failure => failure.includes('duplicate packet priority')));

    console.log('A-025 Kevin decision queue evaluations passed (10 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

