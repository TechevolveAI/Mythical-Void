#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultPackagePath = path.join(repositoryRoot, 'docs/company/content/campaigns/project-beacon-foundation.json');
const packagePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPackagePath;
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

function sameSet(left, right) {
    return Array.isArray(left) && Array.isArray(right) &&
        left.length === right.length && left.every(value => right.includes(value));
}

const campaign = load(packagePath, 'Campaign package');
const contentSource = load(path.join(repositoryRoot, 'docs/company/content/drafts/PROJECT_BEACON_INTRO.json'), 'CP-001 source');
const editorial = load(path.join(repositoryRoot, 'docs/company/content/editorial-queue.json'), 'Editorial queue');
const claims = load(path.join(repositoryRoot, 'docs/company/content/claims.json'), 'Claims registry').claims || [];
const channels = load(path.join(repositoryRoot, 'docs/company/content/channels.json'), 'Channel registry').channels || [];
const identity = load(path.join(repositoryRoot, 'docs/company/content/channel-identity.json'), 'Channel identity');
const claimById = new Map(claims.map(claim => [claim.id, claim]));
const channelById = new Map(channels.map(channel => [channel.id, channel]));
const identityById = new Map((identity.channels || []).map(channel => [channel.channelRef, channel]));
const editorialItem = (editorial.items || []).find(item => item.id === campaign.source?.editorialRef);

if (campaign.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^CMP-\d{3,}$/.test(campaign.id || '')) failures.push('id must be a CMP identifier');
if (campaign.workflowRef !== 'A-034') failures.push('workflowRef must be A-034');
if (campaign.status !== 'internal_package_ready_publication_gated') failures.push('status must remain internal_package_ready_publication_gated');
if (typeof campaign.purpose !== 'string' || campaign.purpose.length < 40) failures.push('purpose is incomplete');

for (const field of [
    'contentApprovalAuthorized', 'channelApprovalAuthorized', 'accountCreationAuthorized',
    'credentialConnectionAuthorized', 'measurementActivationAuthorized', 'schedulingAuthorized',
    'publishingAuthorized', 'replyingAuthorized', 'paidPromotionAuthorized',
    'externalActionAuthorized', 'minorTargetingPermitted', 'conversationIsAuthorization'
]) if (campaign.authority?.[field] !== false) failures.push(`authority.${field} must remain false`);

const source = campaign.source || {};
if (source.editorialRef !== 'CQ-006' || editorialItem?.draftPackage !== source.contentPackagePath) failures.push('source must bind to CQ-006 and its draftPackage');
if (source.contentPackageRef !== contentSource.id || contentSource.id !== 'CP-001') failures.push('source must bind to CP-001');
if (source.contentPackagePath !== 'docs/company/content/drafts/PROJECT_BEACON_INTRO.json') failures.push('contentPackagePath is invalid');
if (!sameSet(source.claimIds, contentSource.claimsUsed) || !sameSet(source.claimIds, editorialItem?.claimIds || [])) failures.push('source claim IDs drift from CP-001 or CQ-006');
if (!Array.isArray(source.proofIds) || source.proofIds.length !== 0 || !Array.isArray(source.customerEvidenceIds) || source.customerEvidenceIds.length !== 0) failures.push('text foundation must not invent proof or customer evidence');
if (campaign.canonical?.copy !== contentSource.copy) failures.push('canonical copy must remain byte-for-byte equal to CP-001');
if (campaign.canonical?.audience !== contentSource.audience || campaign.canonical?.fictionSeparated !== true) failures.push('canonical audience or fiction boundary drifted');
if (campaign.canonical?.generatedMedia !== false) failures.push('canonical generatedMedia must remain false');

const destination = campaign.destination || {};
if (destination.canonicalUrl !== 'https://mythicalvoid.com/' || !sameSet(destination.allowedHosts, ['mythicalvoid.com'])) failures.push('destination must use the exact official domain and host allowlist');
if (Number.isNaN(Date.parse(destination.observedLiveAsOf || ''))) failures.push('destination observedLiveAsOf must be an ISO date-time');
if (destination.taggedUrl !== null || destination.measurementPlanApproved !== false || destination.trackingParametersAuthorized !== false) failures.push('tracking and measurement must remain unapproved and absent');

const contract = campaign.transformationContract || {};
for (const value of ['shorten', 'reorder', 'adapt_tone_to_named_channel']) if (!(contract.allowed || []).includes(value)) failures.push(`transformation allowed list lacks ${value}`);
for (const value of ['add_unregistered_claim', 'strengthen_or_absolutize_claim', 'mix_fiction_with_real_world_claim', 'invent_gameplay_or_customer_proof', 'add_unapproved_destination_or_tracking', 'add_generated_media_or_undisclosed_asset', 'imply_channel_identity_or_publication_approval']) if (!(contract.prohibited || []).includes(value)) failures.push(`transformation prohibited list lacks ${value}`);
if (contract.allVariantClaimsMustBeSourceClaims !== true || contract.literalClaimEvidenceRequired !== true || contract.customerEvidenceRequiredForTestimonials !== true || contract.unapprovedHashtagsAllowed !== false) failures.push('transformation assurance flags are invalid');

const blockedPatterns = [
    /\b1\s*of\s*1\b/i,
    /\bevery creature is unique\b/i,
    /\bno two (?:creatures|companions) are (?:the same|alike)\b/i,
    /\b(?:fully autonomous|sentient|truly alive)\b/i,
    /\b(?:completely safe|100% safe|fully compliant|guaranteed secure)\b/i,
    /\bfree forever\b/i
];
const variants = campaign.variants || [];
if (!Array.isArray(campaign.variants) || variants.length !== 2) failures.push('first package must contain exactly two bounded variants');
const variantIds = new Set();
let literalClaimEvidenceCount = 0;
for (const [index, variant] of variants.entries()) {
    const label = variant?.id || `variants[${index}]`;
    if (!/^WV-\d{3,}$/.test(variant?.id || '')) failures.push(`${label} has invalid ID`);
    if (variantIds.has(variant?.id)) failures.push(`duplicate variant ID ${variant.id}`);
    variantIds.add(variant?.id);
    if (!channelById.has(variant?.channelRef) || !identityById.has(variant?.channelRef)) failures.push(`${label} references an unknown channel`);
    if (!['CH-001', 'CH-004'].includes(variant?.channelRef)) failures.push(`${label} uses a channel outside CQ-006`);
    if (typeof variant?.copy !== 'string' || !variant.copy.trim()) failures.push(`${label} lacks copy`);
    if (!sameSet(variant?.claimIds, source.claimIds)) failures.push(`${label} claim IDs must exactly match source claims`);
    if (!Array.isArray(variant?.claimEvidence) || variant.claimEvidence.length !== variant.claimIds?.length) failures.push(`${label} lacks one evidence excerpt per claim`);
    for (const evidence of variant.claimEvidence || []) {
        literalClaimEvidenceCount += 1;
        if (!variant.claimIds?.includes(evidence?.claimId)) failures.push(`${label} has evidence for an undeclared claim`);
        if (typeof evidence?.excerpt !== 'string' || !variant.copy.includes(evidence.excerpt)) failures.push(`${label} claim evidence is not literal copy`);
    }
    for (const claimId of variant.claimIds || []) {
        const claim = claimById.get(claimId);
        if (!claim || ['restricted', 'internal_only', 'blocked_absolute', 'restricted_recheck'].includes(claim.status)) failures.push(`${label} uses unavailable claim ${claimId}`);
        if (!(variant.claimEvidence || []).some(evidence => evidence.claimId === claimId)) failures.push(`${label} lacks evidence for ${claimId}`);
    }
    if ((variant.proofIds || []).length !== 0 || (variant.customerEvidenceIds || []).length !== 0) failures.push(`${label} invents proof or customer evidence`);
    if (variant.destinationUrl !== destination.canonicalUrl || !variant.copy.includes(destination.canonicalUrl)) failures.push(`${label} must contain the canonical destination`);
    const urls = variant.copy.match(/https?:\/\/[^\s]+/g) || [];
    for (const url of urls) {
        try {
            if (!destination.allowedHosts.includes(new URL(url).hostname) || url !== destination.canonicalUrl) failures.push(`${label} contains an unapproved URL`);
        } catch (_) { failures.push(`${label} contains an invalid URL`); }
    }
    if (!Array.isArray(variant.hashtags) || variant.hashtags.length !== 0 || /(^|\s)#[\p{L}\p{N}_]+/u.test(variant.copy)) failures.push(`${label} contains an unapproved hashtag`);
    if (variant.generatedMedia !== false) failures.push(`${label} generatedMedia must remain false`);
    if (variant.publicationReady !== false) failures.push(`${label} publicationReady must remain false`);
    blockedPatterns.forEach(pattern => { if (pattern.test(variant.copy || '')) failures.push(`${label} contains blocked public language`); });
}

if (!sameSet(variants.map(variant => variant.channelRef), editorialItem?.channelIds || [])) failures.push('variants must cover CQ-006 channels exactly');

const accessibility = campaign.accessibility || {};
if (accessibility.textOnly !== true || accessibility.languageDeclared !== true || accessibility.plainTextLinkVisible !== true || accessibility.emojiDependentMeaning !== false || accessibility.altTextRequired !== false || accessibility.captionsRequired !== false || accessibility.reviewCompleteForCurrentText !== true) failures.push('accessibility record is incomplete or inconsistent for text-only copy');
const disclosure = campaign.disclosure || {};
for (const field of ['generatedAssetPresent', 'generatedAssetDisclosureRequired', 'gameplayMediaPresent', 'testimonialOrCustomerQuotePresent', 'paidOrPartnerRelationshipClaimed']) if (disclosure[field] !== false) failures.push(`disclosure.${field} must remain false`);

const approval = campaign.approval || {};
for (const field of ['contentApproved', 'channelApproved', 'publicationApproved', 'artifactDigestBound', 'externalExecutorConfigured']) if (approval[field] !== false) failures.push(`approval.${field} must remain false`);
if (approval.approvedBy !== null || approval.approvalEnvelopeRef !== null) failures.push('no approver or approval envelope may be recorded');

const gates = campaign.publicationGates || {};
const expectedTrueGates = ['sourceAndClaimProvenanceValid', 'fictionBoundaryValid', 'destinationAllowlistValid', 'accessibilityReviewComplete'];
for (const gate of expectedTrueGates) if (gates[gate] !== true) failures.push(`publicationGates.${gate} must reflect completed internal assurance`);
const expectedFalseGates = ['deployedBuildClaimRecheckComplete', 'channelDecisionRecorded', 'canonicalChannelIdentityVerified', 'ownerRecoveryAndCredentialReady', 'moderationSafeguardingAndIncidentCoverageReady', 'measurementAndPrivacyApproved', 'completeChannelPreviewApproved', 'trustedArtifactBoundApprovalRecorded', 'publisherAndKillSwitchTested', 'postPublicationReconciliationReady'];
for (const gate of expectedFalseGates) if (gates[gate] !== false) failures.push(`publicationGates.${gate} must remain false`);
if (Object.keys(gates).length !== 14) failures.push('publicationGates must contain exactly fourteen gates');
if (identity.publishingReady !== false || [...identityById.values()].some(channel => channel.publishReady)) failures.push('channel identity unexpectedly indicates publishing readiness');
if (campaign.internalPackageReady !== true) failures.push('internalPackageReady must be true for this reviewed package');
if (campaign.publicationReady !== false) failures.push('publicationReady must remain false');

const gateValues = Object.values(gates);
console.log(JSON.stringify({
    workflow: 'A-034',
    mode: 'internal canonical-to-channel package assurance; no publication action',
    campaignPackageValid: failures.length === 0,
    internalPackageReady: failures.length === 0 && campaign.internalPackageReady === true,
    publicationReady: false,
    campaignId: campaign.id || null,
    sourceContentPackageRef: source.contentPackageRef || null,
    variantCount: variants.length,
    channelCount: new Set(variants.map(variant => variant.channelRef)).size,
    claimCount: new Set(variants.flatMap(variant => variant.claimIds || [])).size,
    literalClaimEvidenceCount,
    proofCount: variants.reduce((count, variant) => count + (variant.proofIds || []).length, 0),
    customerEvidenceCount: variants.reduce((count, variant) => count + (variant.customerEvidenceIds || []).length, 0),
    generatedAssetCount: variants.filter(variant => variant.generatedMedia).length,
    approvedTrackingUrlCount: destination.taggedUrl ? 1 : 0,
    publicationGateCount: gateValues.length,
    satisfiedPublicationGateCount: gateValues.filter(Boolean).length,
    publicationAuthorized: false,
    externalActionAuthorized: false,
    failures,
    nextAction: 'Review the two text previews internally. Before any publication, resolve D-011, recheck CL-004 against the deployed build, approve measurement and the exact destination, verify channel ownership and coverage, and bind trusted approval to the final artifact digest.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;
