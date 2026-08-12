#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultPlanPath = path.join(repositoryRoot, 'docs', 'company', 'research', 'round-001a-operations.json');
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

const plan = load(planPath, 'Adult research operations plan');
const workflows = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Workflow registry').workflows || [];
const experiments = load(path.join(repositoryRoot, 'docs/company/growth/experiment-portfolio.json'), 'Experiment portfolio').experiments || [];
const marketLandscape = load(path.join(repositoryRoot, 'docs/company/research/market-landscape-2026-08-11.json'), 'Market landscape');
const risks = load(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register').risks || [];
const lifecycle = load(path.join(repositoryRoot, 'docs/company/engagement/lifecycle-programs.json'), 'Engagement lifecycle');
const decisionsMarkdown = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');

const known = {
    workflowRefs: new Set(workflows.map(item => item.id)),
    experimentRefs: new Set(experiments.map(item => item.id)),
    marketHypothesisRefs: new Set((marketLandscape.hypotheses || []).map(item => item.id)),
    decisionRefs: new Set([...decisionsMarkdown.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1])),
    riskRefs: new Set(risks.map(item => item.id))
};
const lifecycleIds = new Set((lifecycle.programs || []).map(item => item.id));

if (plan.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.asOf || '')) failures.push('asOf must be an ISO date');
if (plan.studyId !== 'ROUND-001A') failures.push('studyId must be ROUND-001A');
if (plan.status !== 'internal_package_ready_recruitment_gated') failures.push('status must remain internal_package_ready_recruitment_gated');
if (typeof plan.decisionServed !== 'string' || !plan.decisionServed.trim()) failures.push('decisionServed is required');

for (const field of [
    'recruitmentAuthorized',
    'participantContactAuthorized',
    'schedulingAuthorized',
    'dataCollectionAuthorized',
    'sessionRecordingAuthorized',
    'compensationAuthorized',
    'evidenceImportAuthorized',
    'followUpAuthorized',
    'positioningChangeAuthorized',
    'externalActionAuthorized',
    'directMinorContactPermitted',
    'behavioralTargetingPermitted'
]) {
    if (plan.authority?.[field] !== false) failures.push(`authority.${field} must remain false`);
}

for (const field of ['studyOwner', 'evidenceReviewer', 'moderator', 'safeguardingEscalationOwner']) {
    if (typeof plan[field] !== 'string' || !plan[field].trim()) failures.push(`${field} is required`);
}
if (!Array.isArray(plan.protocolRefs) || plan.protocolRefs.length !== 3) failures.push('exactly three protocolRefs are required');
for (const ref of plan.protocolRefs || []) {
    const resolved = path.resolve(repositoryRoot, ref);
    if (!resolved.startsWith(repositoryRoot + path.sep) || !fs.existsSync(resolved)) failures.push(`protocolRef does not resolve inside the repository: ${ref}`);
}
for (const [field, ids] of Object.entries(known)) {
    if (!Array.isArray(plan[field]) || plan[field].length === 0) failures.push(`${field} must be a non-empty array`);
    for (const id of plan[field] || []) if (!ids.has(id)) failures.push(`${field} references unknown ID ${id}`);
}
if (!lifecycleIds.has(plan.lifecycleProgramRef)) failures.push(`unknown lifecycleProgramRef ${plan.lifecycleProgramRef}`);
if (plan.lifecycleProgramRef !== 'ENG-001') failures.push('lifecycleProgramRef must be ENG-001');

const audience = plan.audience || {};
for (const [field, expected] of Object.entries({
    adultsOnly: true,
    minimumAge: 18,
    exactAgeCollected: false,
    minorParticipationPermitted: false,
    guardianGroupTarget: 6,
    adjacentAdultPlayerTarget: 4,
    totalTarget: 10,
    mainSampleExcludesEmployeesCloseCollaboratorsAndPriorProductFamiliarity: true,
    sampleType: 'purposeful_directional_qualitative',
    prevalenceInferencePermitted: false
})) {
    if (audience[field] !== expected) failures.push(`audience.${field} must be ${JSON.stringify(expected)}`);
}

const messageCards = new Map();
for (const card of plan.messageCards || []) {
    if (!['M-A', 'M-B', 'M-C'].includes(card?.id)) failures.push(`unknown message card ${card?.id}`);
    if (messageCards.has(card?.id)) failures.push(`duplicate message card ${card.id}`);
    messageCards.set(card?.id, card);
    if (typeof card?.name !== 'string' || !card.name.trim()) failures.push(`${card?.id} lacks name`);
}
if (!Array.isArray(plan.messageCards) || plan.messageCards.length !== 3) failures.push('exactly three message cards are required');
for (const [id, target] of [['M-A', 4], ['M-B', 3], ['M-C', 3]]) if (messageCards.get(id)?.assignmentTarget !== target) failures.push(`${id}.assignmentTarget must be ${target}`);

const slotIds = new Set();
const roleCounts = { parent_guardian: 0, adjacent_adult_player: 0 };
const cardCounts = { 'M-A': 0, 'M-B': 0, 'M-C': 0 };
for (const [index, slot] of (plan.sessionSlots || []).entries()) {
    const label = slot?.id || `sessionSlots[${index}]`;
    if (!/^R001A-S(?:0[1-9]|10)$/.test(slot?.id || '')) failures.push(`${label} has invalid ID`);
    if (slotIds.has(slot?.id)) failures.push(`duplicate session slot ${slot.id}`);
    slotIds.add(slot?.id);
    if (!(slot?.audienceRole in roleCounts)) failures.push(`${label} has invalid audienceRole`);
    else roleCounts[slot.audienceRole] += 1;
    if (!(slot?.messageCardId in cardCounts)) failures.push(`${label} has invalid messageCardId`);
    else cardCounts[slot.messageCardId] += 1;
    if (slot?.status !== 'unassigned') failures.push(`${label}.status must remain unassigned before approved recruitment`);
}
if (!Array.isArray(plan.sessionSlots) || plan.sessionSlots.length !== 10) failures.push('exactly ten preallocated session slots are required');
if (roleCounts.parent_guardian !== 6 || roleCounts.adjacent_adult_player !== 4) failures.push('session slots must contain six guardians and four adjacent adult players');
if (cardCounts['M-A'] !== 4 || cardCounts['M-B'] !== 3 || cardCounts['M-C'] !== 3) failures.push('session slots must use a balanced 4/3/3 message assignment');

const screener = plan.screener || {};
if (screener.status !== 'draft_unapproved') failures.push('screener.status must remain draft_unapproved');
const requiredAllowedFields = ['adult_18_plus', 'audience_role', 'prior_mythical_familiarity', 'coarse_browser_device_habit', 'accommodation_requested_yes_no'];
for (const field of requiredAllowedFields) if (!screener.allowedFields?.includes(field)) failures.push(`screener.allowedFields lacks ${field}`);
for (const field of ['exact_age', 'birth_date', 'child_name', 'child_age', 'child_contact', 'school', 'precise_location', 'household_income', 'ethnicity', 'health_or_disability_detail', 'marketing_preference']) if (!screener.prohibitedFields?.includes(field)) failures.push(`screener.prohibitedFields lacks ${field}`);
if (screener.accommodationDetailsRestrictedToHumanSchedulingRoute !== true || screener.childDetailsRequested !== false) failures.push('screener accommodation/child-data boundary is invalid');

const info = plan.participantInformation || {};
for (const [field, expected] of Object.entries({
    status: 'draft_unapproved',
    purposeSpecific: true,
    researchPermissionMayBeReusedForMarketing: false,
    voluntary: true,
    skipOrStopWithoutReason: true,
    sessionMinutes: 50,
    recordingDefault: 'off',
    schedulingContactSeparatedFromResearchNotes: true,
    sharedNotesContainPersonalData: false,
    approvedVersion: null
})) if (info[field] !== expected) failures.push(`participantInformation.${field} must be ${JSON.stringify(expected)}`);

const consent = plan.consent || {};
for (const [field, expected] of Object.entries({
    status: 'draft_unapproved',
    explicitAdultConfirmationRequired: true,
    silenceOrAttendanceCountsAsConsent: false,
    noteTakingRequiresConsent: true,
    recordingConsentIncluded: false,
    marketingConsentIncluded: false,
    withdrawalProcessApproved: false,
    approvedVersion: null
})) if (consent[field] !== expected) failures.push(`consent.${field} must be ${JSON.stringify(expected)}`);

for (const field of ['currency', 'amountPerCompletedSession', 'partialOrWithdrawnSessionPolicy', 'maximumTotal', 'paymentSystem']) if (plan.compensation?.[field] !== null) failures.push(`compensation.${field} must remain null before approval`);
if (plan.compensation?.approvalRecorded !== false) failures.push('compensation.approvalRecorded must remain false');

for (const field of ['restrictedSchedulingStore', 'restrictedConsentLedger', 'restrictedRawNotesStore', 'approvedVideoMeetingTool']) if (plan.systems?.[field] !== null) failures.push(`systems.${field} must remain null before approval`);
for (const field of ['automatedTranscriptionEnabled', 'aiMeetingBotEnabled', 'crmConnected', 'marketingAutomationConnected', 'analyticsOrAdvertisingPixelsPermitted', 'sharedRepositoryMayContainContactData']) if (plan.systems?.[field] !== false) failures.push(`systems.${field} must remain false`);

const handling = plan.dataHandling || {};
if (handling.recordingMode !== 'notes_only_no_audio_video_or_screen_recording') failures.push('dataHandling.recordingMode must remain notes only');
for (const field of ['rawContactAndConsentSeparated', 'deidentifiedSharedEvidenceOnly']) if (handling[field] !== true) failures.push(`dataHandling.${field} must be true`);
for (const field of ['contactRetentionDays', 'rawNotesRetentionDays', 'consentRetentionDays', 'withdrawalDeadlineDays']) if (handling[field] !== null) failures.push(`dataHandling.${field} must remain null before review`);
if (handling.retentionAndDeletionApproved !== false || handling.deletionOwner !== 'Unassigned') failures.push('dataHandling retention/deletion must remain unapproved and unassigned');
for (const field of ['restrictedIncidentContentMayEnterSharedNotes', 'transcriptMayEnterSharedNotes', 'creatureNameMayEnterSharedNotes', 'childDataMayEnterSharedNotes']) if (handling[field] !== false) failures.push(`dataHandling.${field} must remain false`);

const build = plan.sourceBuild || {};
const stableBuildRecorded = /^[a-f0-9]{7,40}$/.test(build.commit || '') && typeof build.buildId === 'string' && build.buildId.trim() && typeof build.releaseLabel === 'string' && build.releaseLabel.trim() && build.stableBuildApproved === true && build.publicSiteStateRecorded === true && !/unassigned/i.test(build.gameDevelopmentOwner || '');
if (!stableBuildRecorded && [build.commit, build.buildId, build.releaseLabel].some(value => value !== null)) failures.push('sourceBuild must stay entirely null until a complete stable-build record exists');

const moderation = plan.moderation || {};
for (const field of ['scriptReady', 'unnecessaryPersonalDetailRedirectRequired', 'observationsRecordedBeforeInterpretation']) if (moderation[field] !== true) failures.push(`moderation.${field} must be true`);
for (const field of ['dryRunCompleted', 'accessibilityCheckCompleted', 'stopProcedureTested', 'restrictedEscalationRouteTested', 'moderatorMayPromiseConfidentiality', 'moderatorMayProvideLegalAdvice']) if (moderation[field] !== false) failures.push(`moderation.${field} must remain false`);
if (!Array.isArray(plan.stopRules) || plan.stopRules.length !== 8) failures.push('exactly eight stop rules are required');

const evidence = plan.evidenceOutput || {};
for (const refField of ['targetRegister', 'schema']) {
    const resolved = path.resolve(repositoryRoot, evidence[refField] || '');
    if (!resolved.startsWith(repositoryRoot + path.sep) || !fs.existsSync(resolved)) failures.push(`evidenceOutput.${refField} does not resolve`);
}
for (const field of ['acceptedStatusRequiresHumanReview', 'observationAndInterpretationSeparated', 'alternativeExplanationsRequired', 'productVersionRequired', 'protocolReferenceRequired', 'restrictedRawDataPointerRequired']) if (evidence[field] !== true) failures.push(`evidenceOutput.${field} must be true`);
for (const field of ['syntheticEvidencePermitted', 'participantQuotePublicationPermitted', 'evidenceImportReady']) if (evidence[field] !== false) failures.push(`evidenceOutput.${field} must remain false`);

const gateValues = Object.values(plan.entryGates || {});
if (gateValues.length !== 14 || gateValues.some(value => value !== false)) failures.push('all fourteen entry gates must remain false until their evidence is recorded through a reviewed plan update');
if (plan.internalPackageReady !== true) failures.push('internalPackageReady must be true');
for (const field of ['recruitmentReady', 'sessionReady', 'evidenceImportReady']) if (plan[field] !== false) failures.push(`${field} must remain false`);
if (!Array.isArray(plan.contactRecords) || plan.contactRecords.length !== 0) failures.push('contactRecords must remain empty in the shared repository');
if (!Array.isArray(plan.results) || plan.results.length !== 0) failures.push('results must remain empty before sessions');

const serialized = JSON.stringify(plan);
const phoneScanText = serialized
    .replace(/\d{4}-\d{2}-\d{2}/g, '')
    .replace(/R001A-S\d{2}/g, '');
if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(serialized) || /(?:\+?\d[\d .()-]{7,}\d)/.test(phoneScanText)) failures.push('research plan appears to contain contact data');

const peopleNamed = ![plan.studyOwner, plan.evidenceReviewer, plan.moderator, plan.safeguardingEscalationOwner].some(value => /unassigned/i.test(value || ''));
const allEntryGatesSatisfied = gateValues.length === 14 && gateValues.every(value => value === true);
const recruitmentReadyDerived = peopleNamed && stableBuildRecorded && allEntryGatesSatisfied;

console.log(JSON.stringify({
    workflow: 'A-029',
    mode: 'internal adult research operations assurance',
    researchOperationsPlanValid: failures.length === 0,
    internalPackageReady: plan.internalPackageReady === true,
    studyId: plan.studyId,
    targetSessionCount: (plan.sessionSlots || []).length,
    guardianSessionCount: roleCounts.parent_guardian,
    adjacentAdultSessionCount: roleCounts.adjacent_adult_player,
    messageAssignment: cardCounts,
    namedResearchTeamReady: peopleNamed,
    stableBuildRecorded,
    satisfiedEntryGateCount: gateValues.filter(value => value === true).length,
    recruitmentReady: plan.recruitmentReady === true && recruitmentReadyDerived,
    sessionReady: false,
    evidenceImportReady: false,
    contactRecordCount: (plan.contactRecords || []).length,
    resultCount: (plan.results || []).length,
    recruitmentAuthorized: false,
    participantContactAuthorized: false,
    dataCollectionAuthorized: false,
    sessionRecordingAuthorized: false,
    compensationAuthorized: false,
    directMinorContactPermitted: false,
    behavioralTargetingPermitted: false,
    externalActionAuthorized: false,
    failures,
    nextAction: 'Kevin approves the adult purpose/sample and compensation ceiling; name the research team and safeguarding route, then review the restricted systems, consent, retention, stable build, and moderator dry run before any invitation.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (!recruitmentReadyDerived || !plan.sessionReady || !plan.evidenceImportReady) process.exitCode = 2;
