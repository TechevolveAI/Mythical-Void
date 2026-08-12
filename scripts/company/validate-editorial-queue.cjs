#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultQueuePath = path.join(repositoryRoot, 'docs', 'company', 'content', 'editorial-queue.json');
const queuePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultQueuePath;
const claimsPath = path.join(repositoryRoot, 'docs', 'company', 'content', 'claims.json');
const proofsPath = path.join(repositoryRoot, 'docs', 'company', 'content', 'proof-library.json');
const channelsPath = path.join(repositoryRoot, 'docs', 'company', 'content', 'channels.json');
const evidencePath = path.join(repositoryRoot, 'docs', 'company', 'customer', 'evidence.json');
const driftScriptPath = path.join(repositoryRoot, 'scripts', 'company', 'audit-provider-policy-drift.cjs');
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

const queue = load(queuePath, 'Editorial queue');
const claims = load(claimsPath, 'Claims library').claims || [];
const proofs = load(proofsPath, 'Proof library').proofs || [];
const channelRegistry = load(channelsPath, 'Channel registry');
const evidence = load(evidencePath, 'Customer evidence register').records || [];
const claimById = new Map(claims.map(claim => [claim.id, claim]));
const proofById = new Map(proofs.map(proof => [proof.id, proof]));
const channelById = new Map((channelRegistry.channels || []).map(channel => [channel.id, channel]));
const acceptedEvidenceCount = evidence.filter(record => record.status === 'accepted').length;

if (queue.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (queue.externalPublishingAuthorized !== false) failures.push('externalPublishingAuthorized must remain false');
if (queue.cadenceMode !== 'milestone_led_not_daily') failures.push('cadenceMode must remain milestone-led');
if (!Array.isArray(queue.items) || queue.items.length === 0) failures.push('items must not be empty');

const ids = new Set();
const results = [];
for (const [index, item] of (queue.items || []).entries()) {
    const label = item?.id || `items[${index}]`;
    if (!/^CQ-\d{3,}$/.test(item?.id || '')) failures.push(`${label} has invalid ID`);
    if (ids.has(item?.id)) failures.push(`duplicate item ID ${item.id}`);
    ids.add(item?.id);
    if (!['P0', 'P1', 'P2'].includes(item?.priority)) failures.push(`${label} has invalid priority`);
    for (const field of ['title', 'pillar', 'objective', 'audience', 'contentType']) {
        if (typeof item?.[field] !== 'string' || !item[field].trim()) failures.push(`${label} lacks ${field}`);
    }
    if (!['text', 'image', 'video', 'audio'].includes(item?.contentType)) failures.push(`${label} has invalid contentType`);
    if (!Array.isArray(item?.channelIds) || item.channelIds.length === 0) failures.push(`${label} lacks channelIds`);
    if (!Array.isArray(item?.claimIds)) failures.push(`${label} claimIds must be an array`);
    if (!Array.isArray(item?.proofIds)) failures.push(`${label} proofIds must be an array`);
    if (!Array.isArray(item?.dependencyRefs)) failures.push(`${label} dependencyRefs must be an array`);
    if (item?.externalActionAllowed !== false) failures.push(`${label} externalActionAllowed must be false`);

    const itemClaims = (item.claimIds || []).map(id => claimById.get(id));
    const unknownClaims = (item.claimIds || []).filter(id => !claimById.has(id));
    unknownClaims.forEach(id => failures.push(`${label} references unknown claim ${id}`));
    const unusableClaims = itemClaims.filter(claim => claim && ['restricted', 'internal_only', 'blocked_absolute'].includes(claim.status));
    if (unusableClaims.length) failures.push(`${label} uses non-public claims ${unusableClaims.map(claim => claim.id).join(', ')}`);
    const restrictedRecheckClaims = itemClaims.filter(claim => claim?.status === 'restricted_recheck');

    const itemProofs = (item.proofIds || []).map(id => proofById.get(id));
    const unknownProofs = (item.proofIds || []).filter(id => !proofById.has(id));
    unknownProofs.forEach(id => failures.push(`${label} references unknown proof ${id}`));
    const missingProofs = itemProofs.filter(proof => proof && (proof.status !== 'approved' || !proof.asset));
    if (item.contentType !== 'text' && (item.proofIds || []).length === 0) failures.push(`${label} non-text brief has no proof requirement`);

    const itemChannels = (item.channelIds || []).map(id => channelById.get(id));
    const unknownChannels = (item.channelIds || []).filter(id => !channelById.has(id));
    unknownChannels.forEach(id => failures.push(`${label} references unknown channel ${id}`));
    const readyChannels = itemChannels.filter(channel =>
        channel &&
        channel.publishingCredential === true &&
        channel.moderationReady === true &&
        channel.measurementReady === true
    );

    let packageValid = null;
    if (item.draftPackage) {
        const packagePath = path.resolve(repositoryRoot, item.draftPackage);
        if (!packagePath.startsWith(`${repositoryRoot}${path.sep}`) || !fs.existsSync(packagePath)) {
            failures.push(`${label} draftPackage is missing or outside the repository`);
            packageValid = false;
        } else {
            const contentPackage = load(packagePath, `${label} draft package`);
            packageValid = contentPackage.status === 'draft' && contentPackage.approval?.approved === false;
            if (!packageValid) failures.push(`${label} draftPackage is not an unapproved draft`);
        }
    }

    const proofReady = missingProofs.length === 0;
    const evidenceReady = !item.requiresAcceptedCustomerEvidence || acceptedEvidenceCount > 0;
    const providerPolicyReady = !item.requiresProviderPolicyReady;
    const claimsReady = unusableClaims.length === 0 && restrictedRecheckClaims.length === 0;
    const draftReady = claimsReady &&
        (item.contentType === 'text' || proofReady) &&
        evidenceReady &&
        providerPolicyReady;
    const publicationReady = draftReady &&
        readyChannels.length === itemChannels.length &&
        queue.externalPublishingAuthorized === true &&
        item.externalActionAllowed === true;

    const blockers = [];
    if (!claimsReady) blockers.push('claims_or_policy_recheck');
    if (!proofReady) blockers.push('approved_product_proof');
    if (!evidenceReady) blockers.push('accepted_customer_evidence');
    if (!providerPolicyReady) blockers.push('provider_policy_reconciliation');
    if (readyChannels.length !== itemChannels.length) blockers.push('channel_owner_credential_moderation_measurement');
    if (queue.externalPublishingAuthorized !== true || item.externalActionAllowed !== true) blockers.push('publication_approval_and_executor');
    if (item.dependencyRefs.length) blockers.push('named_dependencies');

    results.push({
        id: item.id,
        priority: item.priority,
        title: item.title,
        draftReady,
        publicationReady,
        packageValid,
        missingProofIds: missingProofs.map(proof => proof.id),
        channelStates: itemChannels.filter(Boolean).map(channel => ({ id: channel.id, state: channel.state })),
        dependencyRefs: item.dependencyRefs,
        blockers: [...new Set(blockers)]
    });
}

const requiredMissingProofs = [...new Set(results.flatMap(result => result.missingProofIds))];
const draftReadyItems = results.filter(result => result.draftReady);
const publicationReadyItems = results.filter(result => result.publicationReady);

console.log(JSON.stringify({
    workflow: 'A-013',
    mode: 'internal editorial readiness and sequencing',
    queueValid: failures.length === 0,
    externalPublishingAuthorized: false,
    itemCount: results.length,
    draftReadyCount: draftReadyItems.length,
    publicationReadyCount: publicationReadyItems.length,
    acceptedCustomerEvidenceCount: acceptedEvidenceCount,
    requiredMissingProofs,
    failures,
    results,
    recommendedNextActions: [
        'Capture and approve PF-003, PF-004, and PF-005 through GDH-004.',
        'Complete GDH-006/D-013 before responsible-AI provider content.',
        'Run approved research before any what-changed-because-people-played claim.',
        'Verify real channel accounts, owners, moderation, measurement, and approval before publication.',
        'Keep cadence milestone-led; do not generate filler to satisfy a schedule.'
    ],
    note: fs.existsSync(driftScriptPath)
        ? 'A-010 is available as the provider-policy readiness source.'
        : 'A-010 implementation is missing.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (publicationReadyItems.length === 0) process.exitCode = 2;
