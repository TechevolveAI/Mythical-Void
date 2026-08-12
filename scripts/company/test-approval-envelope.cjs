#!/usr/bin/env node

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-approval-envelope.cjs');
const examplePath = path.join(repositoryRoot, 'docs', 'company', 'automation', 'approval-requests', 'EXAMPLE_DRAFT.json');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a011-'));
const example = JSON.parse(fs.readFileSync(examplePath, 'utf8'));

function run(name, envelope) {
    const file = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(envelope));
    const result = spawnSync(process.execPath, [validatorPath, file], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const draft = run('draft', example);
    assert.strictEqual(draft.status, 2);
    assert.strictEqual(draft.output.envelopeValid, true);
    assert.strictEqual(draft.output.artifactDigestMatches, true);
    assert.strictEqual(draft.output.externalActionAuthorized, false);

    const now = Date.now();
    const approvedLooking = run('approved-looking', {
        ...example,
        status: 'approved',
        issuedAt: new Date(now - 60 * 1000).toISOString(),
        validUntil: new Date(now + 60 * 60 * 1000).toISOString(),
        approvedBy: 'Kevin Murphy',
        approvedAt: new Date(now - 30 * 1000).toISOString(),
        approvalEvidenceRef: 'protected-system://example-only-not-real'
    });
    assert.strictEqual(approvedLooking.status, 2);
    assert.strictEqual(approvedLooking.output.envelopeValid, true);
    assert.strictEqual(approvedLooking.output.trustedApprovalVerifierConfigured, false);
    assert.strictEqual(approvedLooking.output.externalActionAuthorized, false);

    const expired = run('expired', {
        ...example,
        status: 'approved',
        issuedAt: '2026-08-01T10:00:00Z',
        validUntil: '2026-08-01T11:00:00Z',
        approvedBy: 'Kevin Murphy',
        approvedAt: '2026-08-01T10:01:00Z',
        approvalEvidenceRef: 'protected-system://example-only-not-real'
    });
    assert.strictEqual(expired.status, 1);
    assert(expired.output.failures.some(failure => failure.includes('expired')));

    const digestMismatch = run('digest-mismatch', {
        ...example,
        artifact: { ...example.artifact, sha256: '0'.repeat(64) }
    });
    assert.strictEqual(digestMismatch.status, 1);
    assert.strictEqual(digestMismatch.output.artifactDigestMatches, false);

    const currentDigest = crypto.createHash('sha256')
        .update(fs.readFileSync(path.join(repositoryRoot, example.artifact.path)))
        .digest('hex');
    assert.strictEqual(currentDigest, example.artifact.sha256);

    console.log('A-011 approval-envelope evaluations passed (4 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
