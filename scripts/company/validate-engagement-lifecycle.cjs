#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultPath = path.join(repositoryRoot, 'docs/company/engagement/lifecycle-programs.json');
const lifecyclePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath;
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

const lifecycle = load(lifecyclePath, 'Engagement lifecycle');
const automations = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automations').workflows || [];
const channels = load(path.join(repositoryRoot, 'docs/company/content/channels.json'), 'Channels').channels || [];
const risks = load(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risks').risks || [];
const experiments = load(path.join(repositoryRoot, 'docs/company/growth/experiment-portfolio.json'), 'Experiments').experiments || [];
const opportunities = load(path.join(repositoryRoot, 'docs/company/commercial/opportunities.json'), 'Opportunities').opportunities || [];
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
const referenceMaps = {
    automationRefs: new Set(automations.map(item => item.id)),
    channelIds: new Set(channels.map(item => item.id)),
    riskRefs: new Set(risks.map(item => item.id)),
    experimentRefs: new Set(experiments.map(item => item.id)),
    opportunityRefs: new Set(opportunities.map(item => item.id)),
    decisionRefs: decisionIds
};

if (lifecycle.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (lifecycle.status !== 'foundation_gated') failures.push('status must remain foundation_gated');
for (const field of [
    'externalEngagementAuthorized', 'crmConnected', 'inboxConnected', 'publisherConnected',
    'personalDataStoreConfigured', 'consentLedgerConfigured', 'suppressionRegistryConfigured',
    'autonomousRepliesPermitted', 'bulkSequencesPermitted', 'contactEnrichmentPermitted',
    'directMinorContactPermitted'
]) {
    if (lifecycle[field] !== false) failures.push(`${field} must remain false`);
}
if (!Array.isArray(lifecycle.contactRecords) || lifecycle.contactRecords.length !== 0) failures.push('shared lifecycle contactRecords must remain empty');
for (const [field, expected] of Object.entries({
    sharedRepositoryMayContainContactData: false,
    researchConsentMayBeReusedForMarketing: false,
    supportContactMayBeReusedForSales: false,
    silenceCountsAsEngagement: false,
    deliveryCountsAsCustomerValue: false,
    stopOnOptOutOrObjection: true,
    restrictedCasesHumanOnly: true
})) {
    if (lifecycle.globalRules?.[field] !== expected) failures.push(`globalRules.${field} must be ${expected}`);
}

const ids = new Set();
const results = [];
for (const [index, program] of (lifecycle.programs || []).entries()) {
    const label = program?.id || `programs[${index}]`;
    if (!/^ENG-\d{3}$/.test(program?.id || '')) failures.push(`${label} has invalid ID`);
    if (ids.has(program?.id)) failures.push(`duplicate program ID ${program.id}`);
    ids.add(program?.id);
    if (program.currentStage !== 'designed_gated') failures.push(`${label} must remain designed_gated`);
    for (const field of ['title', 'purpose', 'audience', 'owner']) {
        if (typeof program?.[field] !== 'string' || !program[field].trim()) failures.push(`${label} lacks ${field}`);
    }
    for (const field of ['requiresPurposeSpecificConsent', 'requiresSafeguardingOwner', 'allowsDirectMinorContact', 'executionReady', 'externalActionAllowed']) {
        if (typeof program?.[field] !== 'boolean') failures.push(`${label}.${field} must be boolean`);
    }
    if (program.allowsDirectMinorContact !== false) failures.push(`${label} direct minor contact is prohibited`);
    if (program.externalActionAllowed !== false) failures.push(`${label} externalActionAllowed must remain false`);
    if (program.executionReady !== false) failures.push(`${label} executionReady must remain false while shared gates are absent`);
    if (!Number.isInteger(program.maximumInitialMessages) || program.maximumInitialMessages !== 1) failures.push(`${label} maximumInitialMessages must be 1`);
    if (!Number.isInteger(program.maximumFollowUps) || program.maximumFollowUps < 0 || program.maximumFollowUps > 1) failures.push(`${label} maximumFollowUps must be 0 or 1`);
    if (!Number.isInteger(program.minimumDaysBetweenMessages) || program.minimumDaysBetweenMessages < 0) failures.push(`${label} minimumDaysBetweenMessages is invalid`);
    if (program.retentionDays !== null) failures.push(`${label} must not invent retention before review`);
    if (!Array.isArray(program.allowedAgentActions) || program.allowedAgentActions.length === 0) failures.push(`${label} lacks allowedAgentActions`);
    if (!Array.isArray(program.prohibitedAgentActions) || program.prohibitedAgentActions.length < 3) failures.push(`${label} lacks prohibitedAgentActions`);
    if (!program.prohibitedAgentActions?.some(action => /send|connect inbox/.test(action))) failures.push(`${label} must explicitly prohibit sending or inbox connection`);
    if (!Array.isArray(program.entryGates) || program.entryGates.length < 4) failures.push(`${label} needs at least four entry gates`);
    for (const [field, known] of Object.entries(referenceMaps)) {
        if (!Array.isArray(program[field])) failures.push(`${label}.${field} must be an array`);
        for (const id of program[field] || []) if (!known.has(id)) failures.push(`${label} references unknown ${field} ${id}`);
    }

    const ownerMissing = /unassigned/.test(program.owner.toLowerCase());
    const safeguardingBlocked = program.requiresSafeguardingOwner;
    const consentBlocked = program.requiresPurposeSpecificConsent && !lifecycle.consentLedgerConfigured;
    const infrastructureBlocked = !lifecycle.personalDataStoreConfigured || !lifecycle.suppressionRegistryConfigured;
    const executionReady = program.executionReady && program.externalActionAllowed && !ownerMissing && !safeguardingBlocked && !consentBlocked && !infrastructureBlocked;
    results.push({
        id: program.id,
        currentStage: program.currentStage,
        executionReady,
        ownerMissing,
        safeguardingBlocked,
        consentBlocked,
        infrastructureBlocked,
        externalActionAllowed: program.externalActionAllowed,
        blockers: [
            ...(ownerMissing ? ['named_owner'] : []),
            ...(safeguardingBlocked ? ['safeguarding_owner_and_route'] : []),
            ...(consentBlocked ? ['purpose_specific_consent_ledger'] : []),
            ...(infrastructureBlocked ? ['restricted_contact_and_suppression_system'] : []),
            ...(!program.externalActionAllowed ? ['trusted_approval_and_executor'] : [])
        ]
    });
}

if (!Array.isArray(lifecycle.programs) || lifecycle.programs.length !== 6) failures.push('the foundation must contain six lifecycle programs');
for (const id of ['ENG-001', 'ENG-002', 'ENG-003', 'ENG-004', 'ENG-005', 'ENG-006']) if (!ids.has(id)) failures.push(`lifecycle is missing ${id}`);

const serialized = JSON.stringify(lifecycle);
const personalDataPattern = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{7,}\d)/i;
if (personalDataPattern.test(serialized)) failures.push('lifecycle appears to contain an email address or phone number');
const readyPrograms = results.filter(result => result.executionReady);

console.log(JSON.stringify({
    workflow: 'A-020',
    mode: 'internal relationship lifecycle assurance',
    lifecycleValid: failures.length === 0,
    externalEngagementAuthorized: false,
    crmConnected: false,
    inboxConnected: false,
    autonomousRepliesPermitted: false,
    contactRecordCount: Array.isArray(lifecycle.contactRecords) ? lifecycle.contactRecords.length : null,
    programCount: results.length,
    executionReadyProgramCount: readyPrograms.length,
    results,
    failures,
    nextAction: 'Name safeguarding and program owners, define restricted contact/consent/suppression/retention systems, and approve exact bounded programs before connecting any CRM, inbox, or sender.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (readyPrograms.length === 0) process.exitCode = 2;
