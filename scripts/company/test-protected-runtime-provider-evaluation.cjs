#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validator = path.join(repositoryRoot, 'scripts/company/validate-protected-runtime-provider-evaluation.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/protected-runtime-provider-evaluation.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-provider-evaluation-'));

function execute(name, value) {
    const file = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
    const result = spawnSync(process.execPath, [validator, file], { cwd: repositoryRoot, encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.providerEvaluationValid, true);
    assert.strictEqual(baseline.output.candidateCount, 3);
    assert.strictEqual(baseline.output.officialSourceCount, 14);
    assert.strictEqual(baseline.output.selectedProviderCount, 0);

    const authority = execute('authority', { ...source, authority: { ...source.authority, runtimeProvisioningAuthorized: true } });
    assert.strictEqual(authority.status, 1);
    assert(authority.output.failures.some(failure => failure.includes('runtimeProvisioningAuthorized')));

    const selection = execute('selection', { ...source, selectedProviderId: 'PE-001' });
    assert.strictEqual(selection.status, 1);
    assert(selection.output.failures.some(failure => failure.includes('provider selection')));

    const account = execute('account', { ...source, candidates: source.candidates.map(candidate => candidate.id === 'PE-001' ? { ...candidate, accountObserved: true } : candidate) });
    assert.strictEqual(account.status, 1);
    assert(account.output.failures.some(failure => failure.includes('accountObserved')));

    const pricing = execute('pricing', { ...source, candidates: source.candidates.map(candidate => candidate.id === 'PE-002' ? { ...candidate, pricingVerified: true } : candidate) });
    assert.strictEqual(pricing.status, 1);
    assert(pricing.output.failures.some(failure => failure.includes('pricingVerified')));

    const nonOfficial = execute('non-official', { ...source, sources: source.sources.map(item => item.id === 'SRC-GCP-001' ? { ...item, url: 'https://example.com/claim' } : item) });
    assert.strictEqual(nonOfficial.status, 1);
    assert(nonOfficial.output.failures.some(failure => failure.includes('official documentation')));

    const duplicateRequirement = execute('duplicate-requirement', { ...source, platformCapabilityRequirements: [...source.platformCapabilityRequirements.slice(0, -1), source.platformCapabilityRequirements[0]] });
    assert.strictEqual(duplicateRequirement.status, 1);
    assert(duplicateRequirement.output.failures.some(failure => failure.includes('platform capability IDs')));

    const unknownCapability = execute('unknown-capability', { ...source, candidates: source.candidates.map(candidate => candidate.id === 'PE-003' ? { ...candidate, unverifiedRequirementIds: [...candidate.unverifiedRequirementIds.slice(0, -1), 'PC-999'] } : candidate) });
    assert.strictEqual(unknownCapability.status, 1);
    assert(unknownCapability.output.failures.some(failure => failure.includes('unknown requirement')));

    const overlap = execute('overlap', { ...source, candidates: source.candidates.map(candidate => candidate.id === 'PE-001' ? { ...candidate, documentedCapabilityIds: [...candidate.documentedCapabilityIds, 'PC-005'] } : candidate) });
    assert.strictEqual(overlap.status, 1);
    assert(overlap.output.failures.some(failure => failure.includes('documented and unverified')));

    const missingCandidate = execute('missing-candidate', { ...source, candidates: source.candidates.slice(0, 2) });
    assert.strictEqual(missingCandidate.status, 1);
    assert(missingCandidate.output.failures.some(failure => failure.includes('candidate IDs')));

    const multipleRecommendations = execute('multiple-recommendations', { ...source, candidates: source.candidates.map(candidate => ({ ...candidate, recommendedForNextReview: candidate.id !== 'PE-003' })) });
    assert.strictEqual(multipleRecommendations.status, 1);
    assert(multipleRecommendations.output.failures.some(failure => failure.includes('single next-review')));

    const duplicateRank = execute('duplicate-rank', { ...source, candidates: source.candidates.map(candidate => candidate.id === 'PE-002' ? { ...candidate, nextReviewRank: 1 } : candidate) });
    assert.strictEqual(duplicateRank.status, 1);
    assert(duplicateRank.output.failures.some(failure => failure.includes('ranks must be unique')));

    const fakeReview = execute('fake-review', { ...source, candidates: source.candidates.map(candidate => candidate.id === 'PE-001' ? { ...candidate, securityReviewCompleted: true } : candidate) });
    assert.strictEqual(fakeReview.status, 1);
    assert(fakeReview.output.failures.some(failure => failure.includes('securityReviewCompleted')));

    const wrongArchitecture = execute('wrong-architecture', { ...source, architectureClassRef: 'PR-002' });
    assert.strictEqual(wrongArchitecture.status, 1);
    assert(wrongArchitecture.output.failures.some(failure => failure.includes('PR-001')));

    const activation = execute('activation', { ...source, candidates: source.candidates.map(candidate => candidate.id === 'PE-001' ? { ...candidate, activationReady: true } : candidate) });
    assert.strictEqual(activation.status, 1);
    assert(activation.output.failures.some(failure => failure.includes('activationReady')));

    console.log('A-037 protected-runtime provider evaluations passed (15 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
