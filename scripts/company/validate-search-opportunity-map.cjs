#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultMapPath = path.join(repositoryRoot, 'docs/company/search/search-opportunities.json');
const mapPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultMapPath;
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

const map = load(mapPath, 'Search opportunity map');
const claims = load(path.join(repositoryRoot, 'docs/company/content/claims.json'), 'Claims').claims || [];
const proofs = load(path.join(repositoryRoot, 'docs/company/content/proof-library.json'), 'Proofs').proofs || [];
const channels = load(path.join(repositoryRoot, 'docs/company/content/channels.json'), 'Channels').channels || [];
const editorial = load(path.join(repositoryRoot, 'docs/company/content/editorial-queue.json'), 'Editorial queue').items || [];
const automations = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automations').workflows || [];
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const handoffsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/handoffs/GAME_DEVELOPMENT_HANDOFFS.md'), 'utf8');
const known = {
    claimIds: new Map(claims.map(item => [item.id, item])),
    proofIds: new Map(proofs.map(item => [item.id, item])),
    channelIds: new Map(channels.map(item => [item.id, item])),
    editorialRefs: new Map(editorial.map(item => [item.id, item]))
};
const dependencyIds = new Set(automations.map(item => item.id));
for (const match of decisionsText.matchAll(/\| (D-\d{3}) \|/g)) dependencyIds.add(match[1]);
for (const match of handoffsText.matchAll(/## (GDH-\d{3})/g)) dependencyIds.add(match[1]);

if (map.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (map.status !== 'foundation_gated') failures.push('status must remain foundation_gated');
for (const field of ['publicationAuthorized', 'searchSubmissionAuthorized', 'paidSearchAuthorized', 'linkOutreachAuthorized', 'behavioralTargetingPermitted', 'rankingClaimsPermitted']) {
    if (map[field] !== false) failures.push(`${field} must remain false`);
}
if (!/^\d{4}-\d{2}-\d{2}T/.test(map.observedAt || '')) failures.push('observedAt must be an ISO timestamp');
if (!Number.isInteger(map.sample?.queryCount) || map.sample.queryCount < 4) failures.push('search sample must record at least four queries');
if (!Array.isArray(map.sample?.queries) || map.sample.queries.length !== map.sample.queryCount) failures.push('sample queryCount must match queries');
if (map.sample?.verifiedWebmasterSourceConnected !== false) failures.push('verified webmaster source must remain disconnected');
if (typeof map.sample?.limitations !== 'string' || !map.sample.limitations.trim()) failures.push('search sample limitations are required');
if (!Array.isArray(map.observedAdjacentSources) || map.observedAdjacentSources.length < 3) failures.push('at least three adjacent first-party sources are required');
for (const source of map.observedAdjacentSources || []) {
    if (!/^https:\/\//.test(source.url || '')) failures.push(`adjacent source ${source.domain || '(unknown)'} lacks HTTPS URL`);
    if (typeof source.observedPattern !== 'string' || !source.observedPattern.trim()) failures.push(`adjacent source ${source.domain || '(unknown)'} lacks observedPattern`);
}

const ids = new Set();
const results = [];
for (const [index, cluster] of (map.clusters || []).entries()) {
    const label = cluster?.id || `clusters[${index}]`;
    if (!/^SEO-\d{3}$/.test(cluster?.id || '')) failures.push(`${label} has invalid ID`);
    if (ids.has(cluster?.id)) failures.push(`duplicate cluster ID ${cluster.id}`);
    ids.add(cluster?.id);
    if (!['P0', 'P1', 'P2'].includes(cluster?.priority)) failures.push(`${label} has invalid priority`);
    if (!['navigational', 'category_discovery', 'feature_and_emotional_discovery', 'story_and_gameplay_discovery', 'trust_and_eligibility', 'company_and_technical_discovery'].includes(cluster?.intent)) failures.push(`${label} has invalid intent`);
    if (!['existing_live', 'existing_local_unreleased', 'proposed_not_created'].includes(cluster?.targetState)) failures.push(`${label} has invalid targetState`);
    for (const field of ['name', 'audience', 'pagePurpose']) if (typeof cluster?.[field] !== 'string' || !cluster[field].trim()) failures.push(`${label} lacks ${field}`);
    if (!/^\/(?:[^?#]*)$/.test(cluster?.targetPath || '')) failures.push(`${label} targetPath must be a canonical path without query or fragment`);
    if (!Array.isArray(cluster.queryExamples) || cluster.queryExamples.length < 2) failures.push(`${label} needs at least two query examples`);
    for (const [field, refMap] of Object.entries(known)) {
        if (!Array.isArray(cluster[field])) failures.push(`${label}.${field} must be an array`);
        for (const id of cluster[field] || []) if (!refMap.has(id)) failures.push(`${label} references unknown ${field} ${id}`);
    }
    if (!Array.isArray(cluster.dependencyRefs)) failures.push(`${label}.dependencyRefs must be an array`);
    for (const id of cluster.dependencyRefs || []) if (!dependencyIds.has(id)) failures.push(`${label} references unknown dependency ${id}`);
    if (cluster.rankingPosition !== null) failures.push(`${label} rankingPosition must remain null without a verified rank source`);
    if (cluster.publicationReady !== false) failures.push(`${label} publicationReady must remain false`);
    if (cluster.searchSubmissionReady !== false) failures.push(`${label} searchSubmissionReady must remain false`);
    if (cluster.externalActionAllowed !== false) failures.push(`${label} externalActionAllowed must remain false`);

    const unusableClaims = (cluster.claimIds || []).map(id => known.claimIds.get(id)).filter(item => item && ['restricted_recheck', 'restricted', 'internal_only', 'blocked_absolute'].includes(item.status));
    if (unusableClaims.length) failures.push(`${label} includes blocked/restricted claims ${unusableClaims.map(item => item.id).join(', ')}`);
    const missingProofs = (cluster.proofIds || []).map(id => known.proofIds.get(id)).filter(item => item && item.status !== 'approved').map(item => item.id);
    const channelBlocked = (cluster.channelIds || []).map(id => known.channelIds.get(id)).some(channel => channel && (!channel.publishingCredential || !channel.measurementReady));
    const targetMissing = cluster.targetState === 'proposed_not_created';
    const publicationReady = cluster.publicationReady && cluster.contentReady && !missingProofs.length && !channelBlocked && !targetMissing && map.publicationAuthorized;
    const searchSubmissionReady = cluster.searchSubmissionReady && publicationReady && map.searchSubmissionAuthorized && map.sample.verifiedWebmasterSourceConnected;
    if (cluster.contentReady && missingProofs.length) failures.push(`${label} claims content readiness while required proof is missing`);
    results.push({
        id: cluster.id,
        priority: cluster.priority,
        targetPath: cluster.targetPath,
        targetState: cluster.targetState,
        contentReady: cluster.contentReady,
        publicationReady,
        searchSubmissionReady,
        missingProofs,
        channelBlocked,
        blockers: [
            ...(missingProofs.length ? ['approved_gameplay_proof'] : []),
            ...(channelBlocked ? ['channel_measurement_and_publishing'] : []),
            ...(targetMissing ? ['page_not_created'] : []),
            ...(!map.publicationAuthorized ? ['publication_approval_and_release'] : []),
            ...(!map.sample.verifiedWebmasterSourceConnected ? ['verified_webmaster_access'] : [])
        ]
    });
}

if (!Array.isArray(map.clusters) || map.clusters.length !== 6) failures.push('the initial map must contain six search clusters');
for (const id of ['SEO-001', 'SEO-002', 'SEO-003', 'SEO-004', 'SEO-005', 'SEO-006']) if (!ids.has(id)) failures.push(`map is missing ${id}`);

const publicationReady = results.filter(item => item.publicationReady);
const submissionReady = results.filter(item => item.searchSubmissionReady);
console.log(JSON.stringify({
    workflow: 'A-021',
    mode: 'internal search opportunity and evidence assurance',
    mapValid: failures.length === 0,
    publicationAuthorized: false,
    searchSubmissionAuthorized: false,
    paidSearchAuthorized: false,
    verifiedWebmasterSourceConnected: map.sample?.verifiedWebmasterSourceConnected === true,
    sampledBrandedResultObserved: map.sample?.brandedResultObserved === true,
    sampledSiteRestrictedResultObserved: map.sample?.siteRestrictedResultObserved === true,
    clusterCount: results.length,
    publicationReadyClusterCount: publicationReady.length,
    searchSubmissionReadyClusterCount: submissionReady.length,
    results,
    failures,
    nextAction: 'Review and release RM-001, verify indexing through restricted webmaster access, then use adult research and authentic gameplay proof to decide which useful canonical pages to build.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (publicationReady.length === 0 || submissionReady.length === 0) process.exitCode = 2;
