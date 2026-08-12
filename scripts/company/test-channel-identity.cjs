#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-channel-identity.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/content/channel-identity.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a033-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

function updateChannel(id, changes) {
    return { ...source, channels: source.channels.map(channel => channel.channelRef === id ? { ...channel, ...changes } : channel) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.channelIdentityPlanValid, true);
    assert.strictEqual(baseline.output.publicAuditCurrent, true);
    assert.strictEqual(baseline.output.registryChannelCount, 7);
    assert.strictEqual(baseline.output.ownedWebObservedCount, 1);
    assert.strictEqual(baseline.output.sampledSearchCount, 8);
    assert.strictEqual(baseline.output.homepageSocialAccountLinkCount, 0);
    assert.strictEqual(baseline.output.publicOfficialSocialAccountConfirmedCount, 0);
    assert.strictEqual(baseline.output.unverifiedSocialChannelCount, 3);
    assert.strictEqual(baseline.output.candidateAccountUrlCount, 0);
    assert.strictEqual(baseline.output.publishingCredentialCount, 0);
    assert.strictEqual(baseline.output.publishReadyChannelCount, 0);
    assert.strictEqual(baseline.output.requiredPublicationGateCount, 15);
    assert.strictEqual(baseline.output.satisfiedPublicationGateCount, 0);
    assert.strictEqual(baseline.output.namingConfusionRiskObserved, true);
    assert.strictEqual(baseline.output.twitterCardMetadataPresent, true);
    assert.strictEqual(baseline.output.twitterAccountOwnershipEvidencePresent, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);

    const publishAuthority = execute('publish-authority', { ...source, authority: { ...source.authority, publishingAuthorized: true } });
    assert.strictEqual(publishAuthority.status, 1);
    assert(publishAuthority.output.failures.some(failure => failure.includes('publishingAuthorized')));

    const candidateUrl = execute('candidate-url', updateChannel('CH-002', { candidateAccountUrls: ['https://youtube.com/@mythicalvoid'] }));
    assert.strictEqual(candidateUrl.status, 1);
    assert(candidateUrl.output.failures.some(failure => failure.includes('unverified candidate account URL')));

    const twitterOwnership = execute('twitter-ownership', { ...source, publicObservation: { ...source.publicObservation, twitterAccountOwnershipEvidencePresent: true } });
    assert.strictEqual(twitterOwnership.status, 1);
    assert(twitterOwnership.output.failures.some(failure => failure.includes('must not count')));

    const ownerClaim = execute('owner-claim', updateChannel('CH-002', { ownerConfirmed: true }));
    assert.strictEqual(ownerClaim.status, 1);
    assert(ownerClaim.output.failures.some(failure => failure.includes('ownerConfirmed')));

    const credential = execute('credential', updateChannel('CH-002', { publishingCredentialConnected: true }));
    assert.strictEqual(credential.status, 1);
    assert(credential.output.failures.some(failure => failure.includes('publishingCredentialConnected')));

    const publishReady = execute('publish-ready', updateChannel('CH-001', { publishReady: true }));
    assert.strictEqual(publishReady.status, 1);
    assert(publishReady.output.failures.some(failure => failure.includes('publishReady')));

    const accountCreation = execute('account-creation', { ...source, authority: { ...source.authority, accountCreationAuthorized: true } });
    assert.strictEqual(accountCreation.status, 1);
    assert(accountCreation.output.failures.some(failure => failure.includes('accountCreationAuthorized')));

    const fakeSearch = execute('fake-search', { ...source, publicObservation: { ...source.publicObservation, searchSamples: source.publicObservation.searchSamples.map((sample, index) => index === 0 ? { ...sample, confirmedOfficialCandidateUrls: ['https://example.com'] } : sample) } });
    assert.strictEqual(fakeSearch.status, 1);
    assert(fakeSearch.output.failures.some(failure => failure.includes('must contain no confirmed URL')));

    const missingChannel = execute('missing-channel', { ...source, channels: source.channels.slice(0, -1) });
    assert.strictEqual(missingChannel.status, 1);
    assert(missingChannel.output.failures.some(failure => failure.includes('cover the A-008 registry')));

    const duplicateChannel = execute('duplicate-channel', { ...source, channels: [source.channels[0], source.channels[0], ...source.channels.slice(2)] });
    assert.strictEqual(duplicateChannel.status, 1);
    assert(duplicateChannel.output.failures.some(failure => failure.includes('duplicate identity channel')));

    const fakeGate = execute('fake-gate', { ...source, publishingPreflight: { ...source.publishingPreflight, requiredGates: { ...source.publishingPreflight.requiredGates, canonicalIdentityVerified: true } } });
    assert.strictEqual(fakeGate.status, 1);
    assert(fakeGate.output.failures.some(failure => failure.includes('fifteen publication gates')));

    const erasedConfusion = execute('erased-confusion', { ...source, publicObservation: { ...source.publicObservation, unrelatedOrAmbiguousResultsObserved: false } });
    assert.strictEqual(erasedConfusion.status, 1);
    assert(erasedConfusion.output.failures.some(failure => failure.includes('naming ambiguity')));

    console.log('A-033 channel-identity evaluations passed (13 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

