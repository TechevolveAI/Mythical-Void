#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const detectorPath = path.join(repositoryRoot, 'scripts', 'company', 'detect-company-control-plane-changes.cjs');

function parseArguments(values) {
    if (values.length === 0) return { inputPath: null };
    if (values.length === 2 && values[0] === '--input') return { inputPath: path.resolve(values[1]) };
    throw new Error('Usage: node scripts/company/propose-control-plane-baseline-update.cjs [--input A015.json]');
}

function loadJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

let options;
try {
    options = parseArguments(process.argv.slice(2));
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

let comparison;
try {
    if (options.inputPath) {
        comparison = loadJson(options.inputPath);
    } else {
        const result = spawnSync(process.execPath, [detectorPath], {
            cwd: repositoryRoot,
            encoding: 'utf8',
            timeout: 150_000,
            maxBuffer: 5 * 1024 * 1024
        });
        if (![0, 2].includes(result.status)) throw new Error(`A-015 failed with exit ${result.status}: ${result.stderr.trim()}`);
        comparison = JSON.parse(result.stdout);
    }
} catch (error) {
    console.error(`Baseline proposal input failed: ${error.message}`);
    process.exit(1);
}

const failures = [];
if (comparison.workflow !== 'A-015') failures.push('Input workflow must be A-015');
if (comparison.comparisonValid !== true) failures.push('A-015 comparison must be valid');
if (!Array.isArray(comparison.changes)) failures.push('A-015 changes must be an array');
if (!comparison.currentSnapshot || comparison.currentSnapshot.schemaVersion !== 1) failures.push('A-015 must include a valid currentSnapshot');
if (comparison.currentSnapshot?.externalActionAuthorized !== false) failures.push('A baseline candidate may not contain externalActionAuthorized=true');
if (comparison.externalActionAuthorized !== false) failures.push('The proposal workflow must report no external action authorization');

const changes = comparison.changes || [];
const unsafeChanges = changes.filter(item =>
    ['critical', 'high'].includes(item.severity) ||
    item.category === 'authorization'
);
const reviewChanges = changes.filter(item => item.severity === 'medium');
const informationalChanges = changes.filter(item => item.severity === 'informational');
const unknownSeverities = changes.filter(item => !['informational', 'medium', 'high', 'critical'].includes(item.severity));
if (unknownSeverities.length) failures.push('A-015 contains an unknown change severity');

const proposalRequired = changes.length > 0;
const proposalEligible = failures.length === 0 &&
    proposalRequired &&
    unsafeChanges.length === 0 &&
    reviewChanges.length === 0 &&
    informationalChanges.length === changes.length;
const candidateJson = comparison.currentSnapshot
    ? `${JSON.stringify(comparison.currentSnapshot, null, 2)}\n`
    : null;
const candidateDigestSha256 = candidateJson
    ? crypto.createHash('sha256').update(candidateJson).digest('hex')
    : null;

let disposition;
if (!proposalRequired) {
    disposition = 'No baseline update is needed; suppress unchanged status.';
} else if (unsafeChanges.length) {
    disposition = 'Do not adopt this baseline. Investigate and resolve high/critical or authorization changes first.';
} else if (reviewChanges.length) {
    disposition = 'Do not adopt automatically. A human owner must disposition every medium change and provide evidence.';
} else if (proposalEligible) {
    disposition = 'Informational-only candidate may enter explicit human review; it is not approved or written.';
} else {
    disposition = 'Candidate is not eligible until validation failures are resolved.';
}

console.log(JSON.stringify({
    workflow: 'A-017',
    mode: 'baseline-update proposal only',
    proposalValid: failures.length === 0,
    proposalRequired,
    proposalEligible,
    baselineUpdateAuthorized: false,
    baselineWritten: false,
    changeCount: changes.length,
    unsafeChangeCount: unsafeChanges.length,
    reviewChangeCount: reviewChanges.length,
    informationalChangeCount: informationalChanges.length,
    candidateDigestSha256,
    candidateSnapshot: proposalEligible ? comparison.currentSnapshot : null,
    failures,
    blockedChanges: [...unsafeChanges, ...reviewChanges],
    disposition,
    approvalRequirement: proposalEligible
        ? 'Kevin or the named control-plane owner reviews the exact candidate digest and evidence before a separate controlled baseline update.'
        : null,
    externalActionAuthorized: false
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (proposalRequired) process.exitCode = 2;
