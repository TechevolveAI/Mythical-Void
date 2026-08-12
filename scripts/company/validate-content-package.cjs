#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const packagePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(repositoryRoot, 'docs', 'company', 'content', 'drafts', 'PROJECT_BEACON_INTRO.json');
const claimsPath = path.join(repositoryRoot, 'docs', 'company', 'content', 'claims.json');
const proofsPath = path.join(repositoryRoot, 'docs', 'company', 'content', 'proof-library.json');
const failures = [];
const warnings = [];

function parseJson(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

const contentPackage = parseJson(packagePath, 'Content package');
const claims = parseJson(claimsPath, 'Claims library').claims || [];
const proofs = parseJson(proofsPath, 'Proof library').proofs || [];
const claimById = new Map(claims.map(claim => [claim.id, claim]));
const proofById = new Map(proofs.map(proof => [proof.id, proof]));

if (contentPackage.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (contentPackage.status !== 'draft') failures.push('Only draft packages may enter A-003 validation');
if (!contentPackage.approval?.required) failures.push('Public content must require approval');
if (contentPackage.approval?.approved) warnings.push('Approval is recorded; publication still requires destination, time, and expiry validation by the executor');
if (!contentPackage.copy || typeof contentPackage.copy !== 'string') failures.push('copy is required');
if (!contentPackage.audience) failures.push('audience is required');
if (!contentPackage.objective) failures.push('objective is required');
if (!contentPackage.measurement) failures.push('measurement is required');

const blockedPatterns = [
    [/\b1\s*of\s*1\b/i, 'Absolute 1 of 1 claim is blocked'],
    [/\bevery creature is unique\b/i, 'Absolute creature uniqueness claim is blocked'],
    [/\bno two (?:creatures|companions) are (?:the same|alike)\b/i, 'Collision-free uniqueness claim is blocked'],
    [/\b(?:fully autonomous|sentient|truly alive)\b/i, 'Unsubstantiated AI/autonomy claim is blocked'],
    [/\b(?:completely safe|100% safe|fully compliant|guaranteed secure)\b/i, 'Absolute safety/compliance/security claim is blocked'],
    [/\bfree forever\b/i, 'Unbounded future pricing claim is blocked']
];
blockedPatterns.forEach(([pattern, message]) => {
    if (pattern.test(contentPackage.copy || '')) failures.push(message);
});

for (const id of contentPackage.claimsUsed || []) {
    const claim = claimById.get(id);
    if (!claim) {
        failures.push(`Unknown claim ${id}`);
        continue;
    }
    if (['restricted', 'internal_only', 'blocked_absolute'].includes(claim.status)) {
        failures.push(`Claim ${id} is not usable in public content (${claim.status})`);
    }
    if (claim.status === 'restricted_recheck') {
        warnings.push(`Claim ${id} requires a fresh implementation and policy recheck`);
    }
}

for (const id of contentPackage.proofsUsed || []) {
    const proof = proofById.get(id);
    if (!proof) {
        failures.push(`Unknown proof ${id}`);
        continue;
    }
    if (proof.status !== 'approved') {
        failures.push(`Proof ${id} is not approved (${proof.status})`);
    }
    if (!proof.asset) failures.push(`Proof ${id} has no asset`);
}

if (contentPackage.contentType !== 'text' && (contentPackage.proofsUsed || []).length === 0) {
    failures.push('Non-text content requires at least one approved proof object');
}
if ((contentPackage.proofsUsed || []).length === 0) {
    warnings.push('Text-only package: no visual product proof is attached');
}
if (contentPackage.publication?.account || contentPackage.publication?.scheduledAt) {
    warnings.push('A-003 validates a draft only; it does not authorize or execute publication');
}

const report = {
    workflow: 'A-003',
    packageId: contentPackage.id || null,
    validDraft: failures.length === 0,
    readyForHumanApproval: failures.length === 0 && !contentPackage.approval.approved,
    authorizedForPublication: false,
    failures,
    warnings,
    claimsChecked: contentPackage.claimsUsed || [],
    proofsChecked: contentPackage.proofsUsed || []
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;

