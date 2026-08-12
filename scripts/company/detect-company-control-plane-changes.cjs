#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultBaselinePath = path.join(repositoryRoot, 'docs', 'company', 'operations', 'control-plane-baseline.json');
const runnerPath = path.join(repositoryRoot, 'scripts', 'company', 'run-company-control-plane.cjs');
const riskPath = path.join(repositoryRoot, 'docs', 'company', 'operations', 'risks.json');

function parseArguments(argumentsList) {
    const parsed = { baselinePath: defaultBaselinePath, currentPath: null };
    for (let index = 0; index < argumentsList.length; index += 1) {
        const argument = argumentsList[index];
        if (argument === '--baseline' || argument === '--current') {
            const value = argumentsList[index + 1];
            if (!value) throw new Error(`${argument} requires a path`);
            if (argument === '--baseline') parsed.baselinePath = path.resolve(value);
            else parsed.currentPath = path.resolve(value);
            index += 1;
        } else {
            throw new Error(`Unknown argument ${argument}`);
        }
    }
    return parsed;
}

function loadJson(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        throw new Error(`${label} could not be read: ${error.message}`);
    }
}

function normalizeRun(controlPlane) {
    const risks = loadJson(riskPath, 'Risk register').risks || [];
    const runById = new Map((controlPlane.runs || []).map(run => [run.id, run]));
    return {
        schemaVersion: 1,
        capturedAt: controlPlane.generatedAt,
        onlinePublicReadIncluded: controlPlane.mode?.onlinePublicReadIncluded === true,
        controlPlaneHealthy: controlPlane.controlPlaneHealthy === true,
        externalActionAuthorized: controlPlane.externalActionAuthorized === true,
        controlStates: Object.fromEntries(
            (controlPlane.runs || [])
                .filter(run => run.id === 'FOUNDATION' || /^A-\d{3}$/.test(run.id))
                .map(run => [run.id, run.state])
        ),
        publicFootprint: runById.get('A-001')?.summary?.publicAudit || null,
        riskStates: Object.fromEntries(risks.map(risk => [risk.id, {
            severity: risk.severity,
            status: risk.status
        }])),
        signals: {
            acceptedEvidenceCount: runById.get('A-005')?.summary?.acceptedEvidenceCount ?? null,
            providerPolicyFindingCount: runById.get('A-010')?.summary?.findingCount ?? null,
            publicationReadyCount: runById.get('A-013')?.summary?.publicationReadyCount ?? null
        }
    };
}

function validateSnapshot(snapshot, label) {
    const failures = [];
    if (snapshot.schemaVersion !== 1) failures.push(`${label} schemaVersion must be 1`);
    if (typeof snapshot.capturedAt !== 'string' || Number.isNaN(Date.parse(snapshot.capturedAt))) failures.push(`${label} capturedAt is invalid`);
    if (snapshot.onlinePublicReadIncluded !== true) failures.push(`${label} must include the online public read`);
    if (typeof snapshot.controlPlaneHealthy !== 'boolean') failures.push(`${label} controlPlaneHealthy must be boolean`);
    if (typeof snapshot.externalActionAuthorized !== 'boolean') failures.push(`${label} externalActionAuthorized must be boolean`);
    if (!snapshot.controlStates || typeof snapshot.controlStates !== 'object') failures.push(`${label} lacks controlStates`);
    if (!snapshot.publicFootprint || typeof snapshot.publicFootprint.major !== 'number') failures.push(`${label} lacks publicFootprint counts`);
    if (!snapshot.riskStates || typeof snapshot.riskStates !== 'object') failures.push(`${label} lacks riskStates`);
    if (!snapshot.signals || typeof snapshot.signals !== 'object') failures.push(`${label} lacks signals`);
    return failures;
}

let argumentsValue;
try {
    argumentsValue = parseArguments(process.argv.slice(2));
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

let baseline;
let current;
try {
    baseline = loadJson(argumentsValue.baselinePath, 'Baseline snapshot');
    if (argumentsValue.currentPath) {
        current = loadJson(argumentsValue.currentPath, 'Current snapshot');
    } else {
        const result = spawnSync(process.execPath, [runnerPath, '--online'], {
            cwd: repositoryRoot,
            encoding: 'utf8',
            timeout: 120_000,
            maxBuffer: 5 * 1024 * 1024
        });
        if (![0, 2].includes(result.status)) {
            throw new Error(`A-012 live run failed with exit ${result.status}: ${result.stderr.trim()}`);
        }
        current = normalizeRun(JSON.parse(result.stdout));
    }
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

const failures = [
    ...validateSnapshot(baseline, 'baseline'),
    ...validateSnapshot(current, 'current')
];
const changes = [];

function change(id, severity, category, message, before, after) {
    changes.push({ id, severity, category, message, before, after });
}

if (baseline.externalActionAuthorized !== current.externalActionAuthorized) {
    change(
        'CHG-AUTH',
        current.externalActionAuthorized ? 'critical' : 'informational',
        'authorization',
        current.externalActionAuthorized
            ? 'An external action became authorized; immediate human verification is required.'
            : 'External action authorization returned to false.',
        baseline.externalActionAuthorized,
        current.externalActionAuthorized
    );
}

const controlIds = new Set([
    ...Object.keys(baseline.controlStates || {}),
    ...Object.keys(current.controlStates || {})
]);
for (const id of [...controlIds].sort()) {
    const before = baseline.controlStates?.[id] ?? null;
    const after = current.controlStates?.[id] ?? null;
    if (before === after) continue;
    let severity = 'medium';
    if (after === 'broken') severity = 'critical';
    else if (before === 'broken' && after !== 'broken') severity = 'informational';
    else if (before === 'gated' && after === 'passed') severity = 'informational';
    else if (before === null || after === null) severity = 'medium';
    change(`CHG-CONTROL-${id}`, severity, 'control', `${id} state changed from ${before} to ${after}.`, before, after);
}

for (const field of ['major', 'minor', 'findings']) {
    const before = baseline.publicFootprint?.[field];
    const after = current.publicFootprint?.[field];
    if (before === after) continue;
    const increased = after > before;
    const severity = field === 'major' && increased ? 'high' : increased ? 'medium' : 'informational';
    change(`CHG-PUBLIC-${field.toUpperCase()}`, severity, 'public_footprint', `Public-footprint ${field} changed from ${before} to ${after}.`, before, after);
}

const severityRank = { low: 1, medium: 2, high: 3, critical: 4 };
const riskIds = new Set([
    ...Object.keys(baseline.riskStates || {}),
    ...Object.keys(current.riskStates || {})
]);
for (const id of [...riskIds].sort()) {
    const before = baseline.riskStates?.[id] || null;
    const after = current.riskStates?.[id] || null;
    if (!before && after) {
        const severity = ['critical', 'high'].includes(after.severity) ? 'high' : 'medium';
        change(`CHG-RISK-${id}-NEW`, severity, 'risk', `New ${after.severity} risk ${id} entered the register.`, null, after);
        continue;
    }
    if (before && !after) {
        change(`CHG-RISK-${id}-REMOVED`, 'medium', 'risk', `Risk ${id} was removed; verify a disposition exists.`, before, null);
        continue;
    }
    if (before.severity !== after.severity) {
        const increased = severityRank[after.severity] > severityRank[before.severity];
        change(`CHG-RISK-${id}-SEVERITY`, increased ? 'high' : 'informational', 'risk', `Risk ${id} severity changed.`, before.severity, after.severity);
    }
    if (before.status !== after.status) {
        const opened = after.status === 'open' && before.status !== 'open';
        change(`CHG-RISK-${id}-STATUS`, opened ? 'high' : 'informational', 'risk', `Risk ${id} status changed.`, before.status, after.status);
    }
}

const signalRules = {
    acceptedEvidenceCount: { decrease: 'high', increase: 'informational' },
    providerPolicyFindingCount: { decrease: 'informational', increase: 'high' },
    publicationReadyCount: { decrease: 'medium', increase: 'informational' }
};
for (const [field, rule] of Object.entries(signalRules)) {
    const before = baseline.signals?.[field];
    const after = current.signals?.[field];
    if (before === after) continue;
    const severity = after > before ? rule.increase : rule.decrease;
    change(`CHG-SIGNAL-${field}`, severity, 'signal', `${field} changed from ${before} to ${after}.`, before, after);
}

const severityCounts = changes.reduce((counts, item) => {
    counts[item.severity] = (counts[item.severity] || 0) + 1;
    return counts;
}, {});
const alertRequired = changes.some(item => ['critical', 'high'].includes(item.severity));
const humanReviewRecommended = changes.some(item => ['critical', 'high', 'medium'].includes(item.severity));

console.log(JSON.stringify({
    workflow: 'A-015',
    mode: 'read-only snapshot comparison; no alert delivery',
    comparisonValid: failures.length === 0,
    baselineCapturedAt: baseline.capturedAt,
    currentCapturedAt: current.capturedAt,
    changeCount: changes.length,
    severityCounts,
    alertRequired,
    humanReviewRecommended,
    externalActionAuthorized: false,
    failures,
    changes,
    currentSnapshot: current,
    nextAction: alertRequired
        ? 'Human reviews the exact high/critical changes; no automated external response is authorized.'
        : humanReviewRecommended
            ? 'Include the bounded changes in the next internal review.'
            : 'No material change; suppress status noise and retain the comparison metadata in a future protected run store.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (alertRequired) process.exitCode = 2;
