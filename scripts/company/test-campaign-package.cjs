#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-campaign-package.cjs');
const packagePath = path.join(repositoryRoot, 'docs/company/content/campaigns/project-beacon-foundation.json');
const baselinePackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a034-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

function variantMutation(id, changes) {
    return { ...baselinePackage, variants: baselinePackage.variants.map(variant => variant.id === id ? { ...variant, ...changes } : variant) };
}

try {
    const baseline = execute('baseline', baselinePackage);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.campaignPackageValid, true);
    assert.strictEqual(baseline.output.internalPackageReady, true);
    assert.strictEqual(baseline.output.publicationReady, false);
    assert.strictEqual(baseline.output.variantCount, 2);
    assert.strictEqual(baseline.output.literalClaimEvidenceCount, 8);
    assert.strictEqual(baseline.output.satisfiedPublicationGateCount, 4);

    const authority = execute('authority', { ...baselinePackage, authority: { ...baselinePackage.authority, publishingAuthorized: true } });
    assert.strictEqual(authority.status, 1);
    assert(authority.output.failures.some(failure => failure.includes('publishingAuthorized')));

    const sourceDrift = execute('source-drift', { ...baselinePackage, canonical: { ...baselinePackage.canonical, copy: `${baselinePackage.canonical.copy} Changed.` } });
    assert.strictEqual(sourceDrift.status, 1);
    assert(sourceDrift.output.failures.some(failure => failure.includes('byte-for-byte')));

    const claimInjection = execute('claim-injection', variantMutation('WV-002', { claimIds: [...baselinePackage.variants[1].claimIds, 'CL-010'] }));
    assert.strictEqual(claimInjection.status, 1);
    assert(claimInjection.output.failures.some(failure => failure.includes('claim IDs')));

    const blockedLanguage = execute('blocked-language', variantMutation('WV-002', { copy: `${baselinePackage.variants[1].copy}\nEvery creature is unique.` }));
    assert.strictEqual(blockedLanguage.status, 1);
    assert(blockedLanguage.output.failures.some(failure => failure.includes('blocked public language')));

    const badLink = execute('bad-link', variantMutation('WV-002', { copy: baselinePackage.variants[1].copy.replace('https://mythicalvoid.com/', 'https://example.com/'), destinationUrl: 'https://example.com/' }));
    assert.strictEqual(badLink.status, 1);
    assert(badLink.output.failures.some(failure => failure.includes('canonical destination')));

    const unknownChannel = execute('unknown-channel', variantMutation('WV-002', { channelRef: 'CH-999' }));
    assert.strictEqual(unknownChannel.status, 1);
    assert(unknownChannel.output.failures.some(failure => failure.includes('unknown channel')));

    const fabricatedProof = execute('fabricated-proof', variantMutation('WV-001', { proofIds: ['PF-999'] }));
    assert.strictEqual(fabricatedProof.status, 1);
    assert(fabricatedProof.output.failures.some(failure => failure.includes('invents proof')));

    const generatedMedia = execute('generated-media', variantMutation('WV-001', { generatedMedia: true }));
    assert.strictEqual(generatedMedia.status, 1);
    assert(generatedMedia.output.failures.some(failure => failure.includes('generatedMedia')));

    const accessibility = execute('accessibility', { ...baselinePackage, accessibility: { ...baselinePackage.accessibility, reviewCompleteForCurrentText: false } });
    assert.strictEqual(accessibility.status, 1);
    assert(accessibility.output.failures.some(failure => failure.includes('accessibility')));

    const approval = execute('approval', { ...baselinePackage, approval: { ...baselinePackage.approval, contentApproved: true, approvedBy: 'Kevin' } });
    assert.strictEqual(approval.status, 1);
    assert(approval.output.failures.some(failure => failure.includes('contentApproved')));

    const tracking = execute('tracking', { ...baselinePackage, destination: { ...baselinePackage.destination, taggedUrl: 'https://mythicalvoid.com/?utm_source=test' } });
    assert.strictEqual(tracking.status, 1);
    assert(tracking.output.failures.some(failure => failure.includes('tracking and measurement')));

    const publication = execute('publication', { ...baselinePackage, publicationReady: true });
    assert.strictEqual(publication.status, 1);
    assert(publication.output.failures.some(failure => failure.includes('publicationReady')));

    const hashtag = execute('hashtag', variantMutation('WV-002', { copy: `${baselinePackage.variants[1].copy}\n#AIgame` }));
    assert.strictEqual(hashtag.status, 1);
    assert(hashtag.output.failures.some(failure => failure.includes('hashtag')));

    console.log('A-034 campaign-package evaluations passed (13 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
