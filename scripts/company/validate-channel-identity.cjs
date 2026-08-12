#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultIdentityPath = path.join(repositoryRoot, 'docs', 'company', 'content', 'channel-identity.json');
const identityPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultIdentityPath;
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

const identity = load(identityPath, 'Channel identity register');
const registry = load(path.join(repositoryRoot, 'docs/company/content/channels.json'), 'Channel registry');
const editorial = load(path.join(repositoryRoot, 'docs/company/content/editorial-queue.json'), 'Editorial queue');
const channelById = new Map((registry.channels || []).map(channel => [channel.id, channel]));
const editorialIds = new Set((editorial.items || []).map(item => item.id));
const verificationStates = new Set(['owned_web_observed_access_known', 'no_public_official_account_confirmed', 'community_selection_not_account_identity', 'deferred_no_property']);

if (identity.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (Number.isNaN(Date.parse(identity.asOf || ''))) failures.push('asOf must be an ISO date-time');
if (identity.status !== 'public_audit_complete_verification_gated') failures.push('status must remain public_audit_complete_verification_gated');
if (typeof identity.purpose !== 'string' || identity.purpose.length < 30) failures.push('purpose is incomplete');

for (const field of [
    'accountCreationAuthorized',
    'accountClaimingAuthorized',
    'credentialConnectionAuthorized',
    'publishingAuthorized',
    'schedulingAuthorized',
    'replyingAuthorized',
    'moderationActionAuthorized',
    'analyticsConnectionAuthorized',
    'paidPromotionAuthorized',
    'impersonationEnforcementAuthorized',
    'externalActionAuthorized',
    'minorTargetingPermitted',
    'conversationIsAuthorization'
]) if (identity.authority?.[field] !== false) failures.push(`authority.${field} must remain false`);

const observation = identity.publicObservation || {};
if (observation.officialDomain !== 'https://mythicalvoid.com/') failures.push('publicObservation.officialDomain is invalid');
if (observation.homepageHttpStatus !== 200) failures.push('publicObservation.homepageHttpStatus must record 200');
if (observation.homepageContentType !== 'text/html; charset=UTF-8') failures.push('publicObservation.homepageContentType is invalid');
for (const field of ['homepageSocialAccountLinkCount', 'deployedEntryAssetSocialAccountReferenceCount', 'officialSocialAccountCandidateCount', 'confirmedOfficialSocialAccountCount']) if (observation[field] !== 0) failures.push(`publicObservation.${field} must remain zero for this audit`);
if (observation.twitterCardMetadataPresent !== true || observation.twitterAccountOwnershipEvidencePresent !== false) failures.push('Twitter-card metadata must not count as account ownership evidence');
if (observation.unrelatedOrAmbiguousResultsObserved !== true) failures.push('publicObservation must preserve the observed naming ambiguity');
if (typeof observation.conclusion !== 'string' || !/not evidence that no account exists/i.test(observation.conclusion)) failures.push('publicObservation.conclusion must preserve the absence-of-evidence boundary');
if (!Array.isArray(observation.methods) || observation.methods.length !== 3) failures.push('publicObservation.methods must contain three methods');
if (!Array.isArray(observation.searchSamples) || observation.searchSamples.length !== 8) failures.push('publicObservation.searchSamples must contain eight exact samples');
for (const [index, sample] of (observation.searchSamples || []).entries()) {
    if (typeof sample?.query !== 'string' || !sample.query.trim()) failures.push(`searchSamples[${index}] lacks query`);
    if (!Array.isArray(sample?.confirmedOfficialCandidateUrls) || sample.confirmedOfficialCandidateUrls.length !== 0) failures.push(`searchSamples[${index}] must contain no confirmed URL`);
}

const standard = identity.verificationStandard || {};
for (const field of ['twitterCardMetadataCountsAsAccountProof', 'searchResultNameMatchCountsAsOwnership', 'conversationOrScreenshotCountsAsAuthorization']) if (standard[field] !== false) failures.push(`verificationStandard.${field} must be false`);
if (!Array.isArray(standard.minimumOwnershipEvidence) || standard.minimumOwnershipEvidence.length !== 6) failures.push('verificationStandard.minimumOwnershipEvidence must contain six controls');
if (!Array.isArray(standard.accountCreationRequires) || standard.accountCreationRequires.length !== 9) failures.push('verificationStandard.accountCreationRequires must contain nine controls');

const channels = identity.channels || [];
if (!Array.isArray(identity.channels) || channels.length !== channelById.size) failures.push('identity channels must cover the A-008 registry exactly');
const seen = new Set();
let candidateAccountUrlCount = 0;
for (const [index, channel] of channels.entries()) {
    const label = channel?.channelRef || `channels[${index}]`;
    const registered = channelById.get(channel?.channelRef);
    if (!registered) failures.push(`${label} references unknown channel`);
    if (seen.has(channel?.channelRef)) failures.push(`duplicate identity channel ${channel.channelRef}`);
    seen.add(channel?.channelRef);
    if (!verificationStates.has(channel?.verificationState)) failures.push(`${label} has invalid verificationState`);
    if (!Array.isArray(channel?.candidateAccountUrls)) failures.push(`${label}.candidateAccountUrls must be an array`);
    candidateAccountUrlCount += (channel.candidateAccountUrls || []).length;
    if ((channel.candidateAccountUrls || []).length !== 0) failures.push(`${label} has an unverified candidate account URL`);
    if (channel.channelRef === 'CH-001') {
        if (channel.verificationState !== 'owned_web_observed_access_known' || channel.canonicalProperty !== registered?.accountOrProperty) failures.push('CH-001 must record the known owned web property');
    } else if (channel.canonicalProperty !== null) failures.push(`${label}.canonicalProperty must remain null`);
    for (const field of ['ownerConfirmed', 'backupConfirmed', 'recoveryVerified', 'publishingCredentialConnected', 'moderationReady', 'measurementReady', 'publishReady']) if (channel[field] !== false) failures.push(`${label}.${field} must remain false`);
    if (typeof channel.nextAction !== 'string' || !channel.nextAction.trim()) failures.push(`${label} lacks nextAction`);
}
for (const id of channelById.keys()) if (!seen.has(id)) failures.push(`missing channel identity ${id}`);

const expectedUnverifiedSocial = ['CH-002', 'CH-003', 'CH-004'];
for (const id of expectedUnverifiedSocial) if (channels.find(channel => channel.channelRef === id)?.verificationState !== 'no_public_official_account_confirmed') failures.push(`${id} must remain publicly unverified`);

const preflight = identity.publishingPreflight || {};
if (!editorialIds.has(preflight.firstCandidateContentRef) || preflight.firstCandidateContentRef !== 'CQ-006') failures.push('publishingPreflight.firstCandidateContentRef must be CQ-006');
if (!channelById.has(preflight.firstCandidateChannelRef) || preflight.firstCandidateChannelRef !== 'CH-001') failures.push('publishingPreflight.firstCandidateChannelRef must be CH-001');
const packagePath = path.resolve(repositoryRoot, preflight.candidatePackageRef || '');
if (!packagePath.startsWith(repositoryRoot + path.sep) || !fs.existsSync(packagePath)) failures.push('publishingPreflight.candidatePackageRef must resolve inside the repository');
const atomizedPackagePath = path.resolve(repositoryRoot, preflight.atomizedCampaignPackageRef || '');
if (preflight.atomizedCampaignPackageRef !== 'docs/company/content/campaigns/project-beacon-foundation.json' || !atomizedPackagePath.startsWith(repositoryRoot + path.sep) || !fs.existsSync(atomizedPackagePath)) failures.push('publishingPreflight.atomizedCampaignPackageRef must resolve to the A-034 package inside the repository');
const gateValues = Object.values(preflight.requiredGates || {});
if (gateValues.length !== 15 || gateValues.some(value => value !== false)) failures.push('all fifteen publication gates must remain false');
if (preflight.publicationReady !== false) failures.push('publishingPreflight.publicationReady must remain false');
if (identity.accountInventoryDecisionReady !== true) failures.push('accountInventoryDecisionReady must be true');
if (identity.impersonationMonitoringReady !== false || identity.publishingReady !== false) failures.push('impersonationMonitoringReady and publishingReady must remain false');

const confirmedSocialCount = channels.filter(channel => ['CH-002', 'CH-003', 'CH-004'].includes(channel.channelRef) && channel.ownerConfirmed).length;
const publishReadyChannelCount = channels.filter(channel => channel.publishReady).length;
const publishingCredentialCount = channels.filter(channel => channel.publishingCredentialConnected).length;

console.log(JSON.stringify({
    workflow: 'A-033',
    mode: 'public channel identity and publishing preflight; no account or publication action',
    channelIdentityPlanValid: failures.length === 0,
    publicAuditCurrent: failures.length === 0,
    registryChannelCount: channels.length,
    ownedWebObservedCount: channels.filter(channel => channel.verificationState === 'owned_web_observed_access_known').length,
    sampledSearchCount: (observation.searchSamples || []).length,
    homepageSocialAccountLinkCount: observation.homepageSocialAccountLinkCount,
    publicOfficialSocialAccountConfirmedCount: confirmedSocialCount,
    unverifiedSocialChannelCount: expectedUnverifiedSocial.length,
    candidateAccountUrlCount,
    publishingCredentialCount,
    publishReadyChannelCount,
    requiredPublicationGateCount: gateValues.length,
    satisfiedPublicationGateCount: gateValues.filter(Boolean).length,
    atomizedCampaignPackagePresent: fs.existsSync(atomizedPackagePath),
    namingConfusionRiskObserved: observation.unrelatedOrAmbiguousResultsObserved === true,
    twitterCardMetadataPresent: observation.twitterCardMetadataPresent === true,
    twitterAccountOwnershipEvidencePresent: observation.twitterAccountOwnershipEvidencePresent === true,
    accountInventoryDecisionReady: identity.accountInventoryDecisionReady === true,
    impersonationMonitoringReady: false,
    publishingReady: false,
    accountCreationAuthorized: false,
    credentialConnectionAuthorized: false,
    publishingAuthorized: false,
    replyingAuthorized: false,
    paidPromotionAuthorized: false,
    externalActionAuthorized: false,
    failures,
    nextAction: 'Kevin provides exact existing YouTube, short-form, and professional company URLs or confirms none exist. Verify ownership/recovery before any D-011 account decision; do not create, claim, connect, or publish.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;
