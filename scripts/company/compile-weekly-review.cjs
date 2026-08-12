#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const statePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(repositoryRoot, 'docs', 'company', 'operations', 'current-state.json');
const decisionQueuePath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(repositoryRoot, 'docs', 'company', 'operations', 'decision-queue.json');

function fail(message) {
    console.error(`Weekly company review compilation failed: ${message}`);
    process.exit(1);
}

if (!fs.existsSync(statePath)) fail(`state file not found: ${statePath}`);
if (!fs.existsSync(decisionQueuePath)) fail(`decision queue file not found: ${decisionQueuePath}`);

let state;
let decisionQueue;
try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    decisionQueue = JSON.parse(fs.readFileSync(decisionQueuePath, 'utf8'));
} catch (error) {
    fail(`invalid JSON: ${error.message}`);
}

function requireText(value, field) {
    if (typeof value !== 'string' || value.trim() === '') {
        fail(`${field} must be explicit; use "Not instrumented" or "Not available" rather than leaving it blank`);
    }
    return value.trim();
}

function cell(value, field) {
    return requireText(value, field).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

if (state.schemaVersion !== 1) fail('schemaVersion must be 1');
requireText(state.weekEnding, 'weekEnding');
requireText(state.preparedBy, 'preparedBy');
requireText(state.evidenceFreshness, 'evidenceFreshness');

const executiveFields = ['outcome', 'materialChange', 'biggestLearning', 'biggestRisk', 'recommendation'];
executiveFields.forEach(field => requireText(state.executive?.[field], `executive.${field}`));

const lines = [
    `# Mythical Weekly Company Review — ${state.weekEnding}`,
    '',
    `**Prepared by:** ${state.preparedBy}  `,
    `**Evidence freshness:** ${state.evidenceFreshness}`,
    '',
    '## Executive readout',
    '',
    `- **Outcome:** ${state.executive.outcome}`,
    `- **Material change:** ${state.executive.materialChange}`,
    `- **Biggest learning:** ${state.executive.biggestLearning}`,
    `- **Biggest risk:** ${state.executive.biggestRisk}`,
    `- **Recommendation:** ${state.executive.recommendation}`,
    '',
    '## Scorecard',
    '',
    '| Measure | Current | Target | Trend | Confidence | Decision/owner |',
    '| --- | --- | --- | --- | --- | --- |'
];

if (!Array.isArray(state.scorecard) || state.scorecard.length === 0) {
    fail('scorecard must contain explicit measures');
}
state.scorecard.forEach((item, index) => {
    lines.push(`| ${cell(item.measure, `scorecard[${index}].measure`)} | ${cell(item.current, `scorecard[${index}].current`)} | ${cell(item.target, `scorecard[${index}].target`)} | ${cell(item.trend, `scorecard[${index}].trend`)} | ${cell(item.confidence, `scorecard[${index}].confidence`)} | ${cell(item.decisionOwner, `scorecard[${index}].decisionOwner`)} |`);
});

lines.push('', '## Customer and market evidence', '', '| Evidence | Source | Confidence | Implication | Follow-up |', '| --- | --- | --- | --- | --- |');
(state.evidence || []).forEach((item, index) => {
    lines.push(`| ${cell(item.evidence, `evidence[${index}].evidence`)} | ${cell(item.source, `evidence[${index}].source`)} | ${cell(item.confidence, `evidence[${index}].confidence`)} | ${cell(item.implication, `evidence[${index}].implication`)} | ${cell(item.followUp, `evidence[${index}].followUp`)} |`);
});

lines.push('', '## Experiments', '', '| ID | Result/leading signal | Guardrail status | Recommendation |', '| --- | --- | --- | --- |');
(state.experiments || []).forEach((item, index) => {
    lines.push(`| ${cell(item.id, `experiments[${index}].id`)} | ${cell(item.signal, `experiments[${index}].signal`)} | ${cell(item.guardrail, `experiments[${index}].guardrail`)} | ${cell(item.recommendation, `experiments[${index}].recommendation`)} |`);
});

lines.push('', '## Game Development handoffs', '', '| ID | Request | Evidence | Expected outcome | Priority | Status |', '| --- | --- | --- | --- | --- | --- |');
(state.handoffs || []).forEach((item, index) => {
    lines.push(`| ${cell(item.id, `handoffs[${index}].id`)} | ${cell(item.request, `handoffs[${index}].request`)} | ${cell(item.evidence, `handoffs[${index}].evidence`)} | ${cell(item.expectedOutcome, `handoffs[${index}].expectedOutcome`)} | ${cell(item.priority, `handoffs[${index}].priority`)} | ${cell(item.status, `handoffs[${index}].status`)} |`);
});

lines.push('', '## Operations and automations', '');
['runs', 'exceptions', 'spend', 'accessChanges', 'incidents', 'promotion'].forEach(field => {
    lines.push(`- **${field}:** ${requireText(state.operations?.[field], `operations.${field}`)}`);
});

lines.push('', '## Kevin decision queue', '');
if (decisionQueue.schemaVersion !== 1 || decisionQueue.status !== 'active_review_queue') {
    fail('decision queue must be an active schemaVersion 1 queue');
}
if (!Array.isArray(decisionQueue.packets) || decisionQueue.packets.length === 0 || decisionQueue.packets.length > 5) {
    fail('decision queue must contain one to five packets');
}
[...decisionQueue.packets].sort((left, right) => left.priority - right.priority).forEach((item, index) => {
    const options = (item.optionsAndTradeoffs || []).map(option =>
        `${option.recommended ? 'Recommended — ' : ''}${option.option}: ${option.upside} Tradeoff: ${option.tradeoff}`
    ).join(' | ');
    lines.push(
        `${index + 1}. **${requireText(item.decision, `decisionQueue.packets[${index}].decision`)}**`,
        `   - Packet/decision: ${requireText(item.id, `decisionQueue.packets[${index}].id`)} / ${requireText(item.decisionId, `decisionQueue.packets[${index}].decisionId`)}`,
        `   - Recommendation: ${requireText(item.recommendation, `decisionQueue.packets[${index}].recommendation`)}`,
        `   - Why now: ${requireText(item.whyNow, `decisionQueue.packets[${index}].whyNow`)}`,
        `   - Evidence: ${(item.evidenceRefs || []).join(', ')}`,
        `   - Options: ${requireText(options, `decisionQueue.packets[${index}].optionsAndTradeoffs`)}`,
        `   - Risk if deferred: ${requireText(item.riskIfDeferred, `decisionQueue.packets[${index}].riskIfDeferred`)}`,
        `   - Scope/cost: ${requireText(item.scopeAndCost, `decisionQueue.packets[${index}].scopeAndCost`)}`,
        `   - Review boundary: ${requireText(item.approvalExpiry, `decisionQueue.packets[${index}].approvalExpiry`)}`,
        `   - Reversal: ${requireText(item.rollbackOrReversal, `decisionQueue.packets[${index}].rollbackOrReversal`)}`,
        '   - Authority: Decision response only; no external action is authorized.'
    );
});

lines.push('', '## Next week', '');
['continue', 'stop', 'start', 'ownerDeadline'].forEach(field => {
    lines.push(`- **${field}:** ${requireText(state.nextWeek?.[field], `nextWeek.${field}`)}`);
});

process.stdout.write(`${lines.join('\n')}\n`);
