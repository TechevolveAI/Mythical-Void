#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultQueuePath = path.join(repositoryRoot, 'docs', 'company', 'operations', 'decision-queue.json');
const queuePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultQueuePath;
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

const queue = load(queuePath, 'Decision queue');
const objectives = load(path.join(repositoryRoot, 'docs/company/operations/objectives.json'), 'Objectives');
const riskRegister = load(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risks');
const registry = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const releaseManifest = load(path.join(repositoryRoot, 'docs/company/operations/release-manifests/DISCOVERY_SAFETY_2026-08-11.json'), 'Release manifest');
const decisionText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const handoffText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/handoffs/GAME_DEVELOPMENT_HANDOFFS.md'), 'utf8');

const decisionIds = new Set([...decisionText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
const actions = (objectives.objectives || []).flatMap(objective => objective.actions || []);
const actionIds = new Set(actions.map(action => action.id));
const risks = new Map((riskRegister.risks || []).map(risk => [risk.id, risk]));
const knownEvidenceRefs = new Set([
    ...decisionIds,
    ...actionIds,
    ...risks.keys(),
    ...(registry.workflows || []).map(workflow => workflow.id),
    ...[...handoffText.matchAll(/## (GDH-\d{3})/g)].map(match => match[1]),
    releaseManifest.id
]);

if (queue.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (queue.status !== 'active_review_queue') failures.push('status must be active_review_queue');
if (!/^\d{4}-\d{2}-\d{2}$/.test(queue.asOf || '')) failures.push('asOf must be an ISO date');
if (!Number.isInteger(queue.maximumPackets) || queue.maximumPackets < 1 || queue.maximumPackets > 5) failures.push('maximumPackets must be an integer from 1 to 5');
if (queue.deliveryConfigured !== false) failures.push('deliveryConfigured must remain false until an authenticated route is verified');
if (queue.deliveryRoute !== null) failures.push('deliveryRoute must remain null until authenticated');
for (const field of ['conversationIsAuthorization', 'externalActionsAuthorized', 'sensitiveValuesIncluded']) {
    if (queue[field] !== false) failures.push(`${field} must remain false`);
}
if (!Array.isArray(queue.packets) || queue.packets.length === 0) failures.push('packets must not be empty');
if ((queue.packets || []).length > queue.maximumPackets) failures.push(`packet count exceeds maximumPackets ${queue.maximumPackets}`);

const packetIds = new Set();
const priorities = new Set();
const queuedDecisionIds = new Set();
const queuedActionIds = new Set();
const coveredRiskIds = new Set();
const severityRank = { low: 1, medium: 2, high: 3, critical: 4 };

for (const [index, packet] of (queue.packets || []).entries()) {
    const label = packet?.id || `packets[${index}]`;
    if (!/^KDP-\d{3}$/.test(packet?.id || '')) failures.push(`${label} has invalid ID`);
    if (packetIds.has(packet?.id)) failures.push(`duplicate packet ID ${packet.id}`);
    packetIds.add(packet?.id);
    if (!Number.isInteger(packet?.priority) || packet.priority < 1 || packet.priority > queue.maximumPackets) failures.push(`${label} has invalid priority`);
    if (priorities.has(packet?.priority)) failures.push(`duplicate packet priority ${packet.priority}`);
    priorities.add(packet?.priority);
    if (!['critical', 'high', 'medium', 'low'].includes(packet?.severity)) failures.push(`${label} has invalid severity`);
    if (packet?.status !== 'awaiting_kevin') failures.push(`${label}.status must remain awaiting_kevin until a decision is recorded`);
    if (!decisionIds.has(packet?.decisionId)) failures.push(`${label} references unknown decision ${packet?.decisionId}`);
    if (queuedDecisionIds.has(packet?.decisionId)) failures.push(`duplicate queued decision ${packet.decisionId}`);
    queuedDecisionIds.add(packet?.decisionId);
    if (!actionIds.has(packet?.objectiveActionId)) failures.push(`${label} references unknown objective action ${packet?.objectiveActionId}`);
    if (queuedActionIds.has(packet?.objectiveActionId)) failures.push(`duplicate queued objective action ${packet.objectiveActionId}`);
    queuedActionIds.add(packet?.objectiveActionId);
    const linkedAction = actions.find(action => action.id === packet.objectiveActionId);
    if (linkedAction && !['kevin_decision', 'kevin_input'].includes(linkedAction.mode)) failures.push(`${label} objective action is not a Kevin decision/input`);
    if (linkedAction?.status === 'completed') failures.push(`${label} references a completed objective action`);
    if (!Array.isArray(packet?.riskIds) || packet.riskIds.length === 0) failures.push(`${label}.riskIds must be non-empty`);
    let highestRiskRank = 0;
    for (const riskId of packet.riskIds || []) {
        const risk = risks.get(riskId);
        if (!risk) failures.push(`${label} references unknown risk ${riskId}`);
        else {
            coveredRiskIds.add(riskId);
            highestRiskRank = Math.max(highestRiskRank, severityRank[risk.severity] || 0);
        }
    }
    if (highestRiskRank && severityRank[packet.severity] !== highestRiskRank) failures.push(`${label}.severity does not match its highest linked risk`);
    for (const field of ['decision', 'recommendation', 'whyNow', 'riskIfDeferred', 'scopeAndCost', 'approvalExpiry', 'rollbackOrReversal', 'decisionOwner']) {
        if (typeof packet?.[field] !== 'string' || !packet[field].trim()) failures.push(`${label} lacks ${field}`);
    }
    if (!Array.isArray(packet?.evidenceRefs) || packet.evidenceRefs.length < 3) failures.push(`${label}.evidenceRefs needs at least three references`);
    for (const ref of packet.evidenceRefs || []) if (!knownEvidenceRefs.has(ref)) failures.push(`${label} references unknown evidence ${ref}`);
    if (!Array.isArray(packet?.optionsAndTradeoffs) || packet.optionsAndTradeoffs.length < 2) failures.push(`${label} needs at least two options`);
    const recommendedCount = (packet.optionsAndTradeoffs || []).filter(option => option.recommended === true).length;
    if (recommendedCount !== 1) failures.push(`${label} must have exactly one recommended option`);
    for (const [optionIndex, option] of (packet.optionsAndTradeoffs || []).entries()) {
        for (const field of ['option', 'upside', 'tradeoff']) if (typeof option?.[field] !== 'string' || !option[field].trim()) failures.push(`${label}.optionsAndTradeoffs[${optionIndex}] lacks ${field}`);
        if (typeof option?.recommended !== 'boolean') failures.push(`${label}.optionsAndTradeoffs[${optionIndex}].recommended must be boolean`);
    }
    if (!Array.isArray(packet?.requiredReviewers) || packet.requiredReviewers.length === 0) failures.push(`${label}.requiredReviewers must be non-empty`);
    for (const field of ['decisionIsAuthorization', 'externalActionAuthorized', 'containsRestrictedData', 'mayExecuteOnResponse']) {
        if (packet[field] !== false) failures.push(`${label}.${field} must remain false`);
    }
}

const criticalOpenRiskIds = [...risks.values()]
    .filter(risk => risk.status === 'open' && risk.severity === 'critical')
    .map(risk => risk.id);
for (const riskId of criticalOpenRiskIds) if (!coveredRiskIds.has(riskId)) failures.push(`critical open risk ${riskId} is absent from the decision queue`);
const firstPacket = (queue.packets || []).find(packet => packet.priority === 1);
if (criticalOpenRiskIds.length && (!firstPacket || firstPacket.severity !== 'critical' || !firstPacket.riskIds.some(id => criticalOpenRiskIds.includes(id)))) {
    failures.push('priority 1 must represent the critical open risk');
}
for (let priority = 1; priority <= (queue.packets || []).length; priority += 1) {
    if (!priorities.has(priority)) failures.push(`packet priorities must be contiguous; missing ${priority}`);
}

const awaitingDecisionCount = (queue.packets || []).filter(packet => packet.status === 'awaiting_kevin').length;
const highOrCriticalOpenRiskIds = [...risks.values()]
    .filter(risk => risk.status === 'open' && ['critical', 'high'].includes(risk.severity))
    .map(risk => risk.id);
const coveredHighOrCriticalRiskCount = highOrCriticalOpenRiskIds.filter(id => coveredRiskIds.has(id)).length;
const queueReadyForReview = failures.length === 0 && awaitingDecisionCount > 0;
const automatedDeliveryReady = false;

console.log(JSON.stringify({
    workflow: 'A-025',
    mode: 'internal Kevin decision queue assurance; no delivery or authorization',
    queueValid: failures.length === 0,
    queueReadyForReview,
    automatedDeliveryReady,
    packetCount: (queue.packets || []).length,
    maximumPackets: queue.maximumPackets,
    awaitingDecisionCount,
    criticalOpenRiskCount: criticalOpenRiskIds.length,
    criticalOpenRiskCoverageCount: criticalOpenRiskIds.filter(id => coveredRiskIds.has(id)).length,
    highOrCriticalOpenRiskCount: highOrCriticalOpenRiskIds.length,
    coveredHighOrCriticalRiskCount,
    deliveryConfigured: false,
    conversationIsAuthorization: false,
    externalActionsAuthorized: false,
    sensitiveValuesIncluded: false,
    failures,
    nextAction: 'Kevin answers a packet by decision ID and conditions; record the answer in the Decision Register. Do not execute from the response or this queue.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (awaitingDecisionCount > 0 || !automatedDeliveryReady) process.exitCode = 2;

