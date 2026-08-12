#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultPlanPath = path.join(repositoryRoot, 'docs', 'company', 'content', 'proof-production.json');
const planPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPlanPath;
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

function digest(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const plan = load(planPath, 'Proof production plan');
const proofLibrary = load(path.join(repositoryRoot, 'docs/company/content/proof-library.json'), 'Proof library');
const claims = load(path.join(repositoryRoot, 'docs/company/content/claims.json'), 'Claims').claims || [];
const editorial = load(path.join(repositoryRoot, 'docs/company/content/editorial-queue.json'), 'Editorial queue').items || [];
const workflows = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Workflow registry').workflows || [];
const risks = load(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register').risks || [];
const objectives = load(path.join(repositoryRoot, 'docs/company/operations/objectives.json'), 'Objective register').objectives || [];
const currentState = load(path.join(repositoryRoot, 'docs/company/operations/current-state.json'), 'Current state');

const maps = {
    claimRefs: new Map(claims.map(item => [item.id, item])),
    editorialRefs: new Map(editorial.map(item => [item.id, item])),
    workflowRefs: new Map(workflows.map(item => [item.id, item])),
    handoffRefs: new Map((currentState.handoffs || []).map(item => [item.id, item])),
    riskRefs: new Map(risks.map(item => [item.id, item])),
    objectiveActionRefs: new Map(objectives.flatMap(objective => (objective.actions || []).map(action => [action.id, action])))
};
const proofs = new Map((proofLibrary.proofs || []).map(item => [item.id, item]));
const expectedProofIds = ['PF-003', 'PF-004', 'PF-005'];
const expectedBriefIds = ['PB-001', 'PB-002', 'PB-003'];

if (plan.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.asOf || '')) failures.push('asOf must be an ISO date');
if (plan.status !== 'specifications_ready_capture_gated') failures.push('status must remain specifications_ready_capture_gated');

for (const field of [
    'captureAuthorized',
    'proofApprovalAuthorized',
    'derivativeProductionAuthorized',
    'publicationAuthorized',
    'externalActionAuthorized',
    'syntheticGameplayPermitted',
    'personalDataInCapturePermitted',
    'thirdPartyAudioWithoutRightsPermitted'
]) {
    if (plan.authority?.[field] !== false) failures.push(`authority.${field} must remain false`);
}

for (const field of [
    'continuousMasterRequired',
    'observablePlayerActionRequired',
    'observableGameResponseRequired',
    'editDecisionListRequired',
    'rawMasterRetentionRequired',
    'firstPartyFixtureRequired',
    'claimSupportMustBeNarrowlyStated'
]) {
    if (plan.productionPolicy?.[field] !== true) failures.push(`productionPolicy.${field} must remain true`);
}
for (const field of [
    'debugOverlayPermitted',
    'externalNotificationsPermitted',
    'enteredPlayerOrCreatureIdentifiersPermitted',
    'generatedPixelsVoiceOrAnimationPermitted',
    'montageMayReplaceContinuousEvidence'
]) {
    if (plan.productionPolicy?.[field] !== false) failures.push(`productionPolicy.${field} must remain false`);
}

const build = plan.sourceBuild || {};
const buildFieldsComplete = /^[a-f0-9]{7,40}$/.test(build.commit || '') &&
    typeof build.buildId === 'string' && build.buildId.trim() &&
    /^[a-f0-9]{64}$/.test(build.buildSha256 || '') &&
    typeof build.releaseLabel === 'string' && build.releaseLabel.trim() &&
    build.stableBuildApproved === true &&
    build.cleanCaptureFixtureVerified === true &&
    typeof build.gameDevelopmentOwner === 'string' && !/unassigned/i.test(build.gameDevelopmentOwner);

function validateRefs(brief, label) {
    for (const [field, map] of Object.entries(maps)) {
        if (!Array.isArray(brief?.[field])) failures.push(`${label}.${field} must be an array`);
        for (const id of brief?.[field] || []) if (!map.has(id)) failures.push(`${label} references unknown ${field} ${id}`);
    }
}

function artifactValid(artifact, label, required) {
    if (!artifact || typeof artifact !== 'object') {
        failures.push(`${label} must be an object`);
        return false;
    }
    if (!required && artifact.path === null && artifact.sha256 === null) return true;
    if (typeof artifact.path !== 'string' || !artifact.path.trim()) {
        if (required) failures.push(`${label}.path is required`);
        return false;
    }
    if (!/^[a-f0-9]{64}$/.test(artifact.sha256 || '')) {
        failures.push(`${label}.sha256 must be a SHA-256 digest`);
        return false;
    }
    const resolved = path.resolve(repositoryRoot, artifact.path);
    if (!resolved.startsWith(repositoryRoot + path.sep)) {
        failures.push(`${label}.path must remain inside the repository`);
        return false;
    }
    if (!fs.existsSync(resolved)) {
        failures.push(`${label}.path does not exist`);
        return false;
    }
    if (digest(resolved) !== artifact.sha256) {
        failures.push(`${label}.sha256 does not match the artifact`);
        return false;
    }
    return true;
}

const briefIds = new Set();
const proofAssignments = new Map();
const results = [];
for (const [index, brief] of (plan.briefs || []).entries()) {
    const label = brief?.id || `briefs[${index}]`;
    if (!/^PB-\d{3}$/.test(brief?.id || '')) failures.push(`${label} has invalid ID`);
    if (briefIds.has(brief?.id)) failures.push(`duplicate brief ${brief.id}`);
    briefIds.add(brief?.id);
    const existing = proofAssignments.get(brief?.proofId) || [];
    existing.push(brief?.id);
    proofAssignments.set(brief?.proofId, existing);
    if (!proofs.has(brief?.proofId)) failures.push(`${label} references unknown proof ${brief?.proofId}`);
    if (brief.status !== 'spec_ready_gated') failures.push(`${label}.status must remain spec_ready_gated`);
    if (brief.internalBriefReady !== true) failures.push(`${label}.internalBriefReady must be true`);
    for (const field of ['captureReady', 'proofApprovalReady', 'publicationReady']) {
        if (typeof brief?.[field] !== 'boolean') failures.push(`${label}.${field} must be boolean`);
    }
    for (const field of ['title', 'owner', 'captureOperator', 'independentReviewer', 'captureObjective', 'startingState', 'accessibilityDraft', 'expiryTrigger']) {
        if (typeof brief?.[field] !== 'string' || !brief[field].trim()) failures.push(`${label} lacks ${field}`);
    }
    validateRefs(brief, label);
    if (!Array.isArray(brief.requiredBeats) || brief.requiredBeats.length !== 4) failures.push(`${label} must contain exactly four observable beats`);
    for (const beat of brief.requiredBeats || []) {
        if (!/^PB-\d{3}-B\d$/.test(beat?.id || '') || typeof beat?.beat !== 'string' || !beat.beat.trim()) failures.push(`${label} has an invalid required beat`);
    }
    if (!Array.isArray(brief.claimSupport) || brief.claimSupport.length !== (brief.claimRefs || []).length) failures.push(`${label}.claimSupport must cover every claim exactly once`);
    const supportedClaims = new Set();
    for (const item of brief.claimSupport || []) {
        if (!(brief.claimRefs || []).includes(item?.claimId)) failures.push(`${label} has claim support outside claimRefs: ${item?.claimId}`);
        if (supportedClaims.has(item?.claimId)) failures.push(`${label} duplicates claim support for ${item?.claimId}`);
        supportedClaims.add(item?.claimId);
        if (typeof item?.level !== 'string' || !item.level.trim() || typeof item?.boundary !== 'string' || !item.boundary.trim()) failures.push(`${label} has incomplete claim support`);
    }
    const proof = proofs.get(brief.proofId);
    const proofClaims = new Set(proof?.claims || []);
    if ((brief.claimRefs || []).some(id => !proofClaims.has(id)) || [...proofClaims].some(id => !(brief.claimRefs || []).includes(id))) {
        failures.push(`${label}.claimRefs must exactly match ${brief.proofId} claims`);
    }
    if (!Array.isArray(brief.doesNotProve) || brief.doesNotProve.length < 5) failures.push(`${label} needs at least five explicit non-claims`);
    if (!Array.isArray(brief.privacyAndRightsChecks) || brief.privacyAndRightsChecks.length < 6) failures.push(`${label} privacy and rights checks are incomplete`);
    const settings = brief.captureSettings || {};
    if (settings.masterAspectRatio !== '16:9' || settings.minimumResolution !== '1920x1080') failures.push(`${label} master capture settings are incomplete`);
    if (settings.gameAudioRequired !== true || settings.microphoneRequired !== false || settings.networkDependentFeaturesPermitted !== false || settings.debugOverlayPermitted !== false) failures.push(`${label} capture safety settings are invalid`);
    const outputSet = new Set(brief.requiredOutputs || []);
    for (const name of ['continuous_raw_master', 'captioned_review_copy', 'accessible_still', 'edit_decision_list']) if (!outputSet.has(name)) failures.push(`${label} lacks required output ${name}`);

    const namedPeople = ![brief.owner, brief.captureOperator, brief.independentReviewer].some(value => /unassigned/i.test(value || ''));
    const captureReadyDerived = buildFieldsComplete && namedPeople;
    if (brief.captureReady && !captureReadyDerived) failures.push(`${label} claims capture readiness without a stable build, clean fixture, and named owner/operator/reviewer`);
    const rawValid = artifactValid(brief.rawMaster, `${label}.rawMaster`, brief.proofApprovalReady);
    const reviewValid = artifactValid(brief.reviewCopy, `${label}.reviewCopy`, brief.proofApprovalReady);
    const stillValid = artifactValid(brief.accessibleStill, `${label}.accessibleStill`, brief.proofApprovalReady);
    const assetsRecorded = [brief.rawMaster, brief.reviewCopy, brief.accessibleStill].every(artifact => typeof artifact?.path === 'string' && artifact.path.trim() && /^[a-f0-9]{64}$/.test(artifact.sha256 || ''));
    if (brief.rawMaster?.durationSeconds !== null && (!Number.isFinite(brief.rawMaster.durationSeconds) || brief.rawMaster.durationSeconds <= 0)) failures.push(`${label}.rawMaster.durationSeconds must be null or positive`);
    const timestampsComplete = typeof brief.capturedAt === 'string' && !Number.isNaN(Date.parse(brief.capturedAt)) && typeof brief.approvedAt === 'string' && !Number.isNaN(Date.parse(brief.approvedAt));
    const approvalReadyDerived = captureReadyDerived && rawValid && reviewValid && stillValid && brief.rawMaster?.durationSeconds > 0 && (brief.editDecisionList || []).length > 0 && timestampsComplete;
    if (brief.proofApprovalReady && !approvalReadyDerived) failures.push(`${label} claims proof approval readiness without complete captured evidence`);
    const publicationReadyDerived = approvalReadyDerived && proof?.status === 'approved' && plan.authority?.publicationAuthorized === true;
    if (brief.publicationReady && !publicationReadyDerived) failures.push(`${label} claims publication readiness without accepted proof and explicit publication authority`);
    if (brief.proofApprovalReady && brief.owner === brief.independentReviewer) failures.push(`${label} proof owner and independent reviewer must differ`);

    results.push({
        id: brief.id,
        proofId: brief.proofId,
        internalBriefReady: brief.internalBriefReady === true,
        captureReady: brief.captureReady === true && captureReadyDerived,
        proofApprovalReady: brief.proofApprovalReady === true && approvalReadyDerived,
        publicationReady: brief.publicationReady === true && publicationReadyDerived,
        blockers: [
            ...(!buildFieldsComplete ? ['named_stable_build_and_clean_fixture'] : []),
            ...(!namedPeople ? ['named_owner_operator_and_independent_reviewer'] : []),
            ...(!assetsRecorded || !rawValid || !reviewValid || !stillValid ? ['content_addressed_capture_assets'] : []),
            ...((brief.editDecisionList || []).length === 0 ? ['edit_decision_record'] : []),
            ...(proof?.status !== 'approved' ? ['proof_library_acceptance'] : []),
            ...(!plan.authority?.publicationAuthorized ? ['publication_not_authorized'] : [])
        ]
    });
}

if (!Array.isArray(plan.briefs) || plan.briefs.length !== 3) failures.push('exactly three proof production briefs are required');
for (const id of expectedBriefIds) if (!briefIds.has(id)) failures.push(`missing proof brief ${id}`);
for (const id of expectedProofIds) {
    const assigned = proofAssignments.get(id) || [];
    if (assigned.length !== 1) failures.push(`${id} must be assigned to exactly one proof brief`);
    if (proofs.get(id)?.status !== 'required_missing') failures.push(`${id} changed from required_missing; review and reconcile A-027 before claiming readiness`);
}

console.log(JSON.stringify({
    workflow: 'A-027',
    mode: 'internal gameplay proof production assurance',
    proofProductionPlanValid: failures.length === 0,
    stableBuildRecorded: buildFieldsComplete,
    briefCount: results.length,
    internalBriefReadyCount: results.filter(item => item.internalBriefReady).length,
    captureReadyCount: results.filter(item => item.captureReady).length,
    proofApprovalReadyCount: results.filter(item => item.proofApprovalReady).length,
    publicationReadyCount: results.filter(item => item.publicationReady).length,
    captureAuthorized: false,
    proofApprovalAuthorized: false,
    derivativeProductionAuthorized: false,
    publicationAuthorized: false,
    externalActionAuthorized: false,
    syntheticGameplayPermitted: false,
    personalDataInCapturePermitted: false,
    results,
    failures,
    nextAction: 'Game Development names a stable build and capture operator; the company names a proof owner and independent reviewer. Capture no personal data, debug state, generated gameplay, or unlicensed audio.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (!buildFieldsComplete || results.some(item => !item.captureReady || !item.proofApprovalReady || !item.publicationReady)) process.exitCode = 2;
