#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultEvidencePath = path.join(
    repositoryRoot,
    'docs',
    'company',
    'customer',
    'evidence.json'
);
const evidencePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultEvidencePath;
const failures = [];
const warnings = [];

function loadJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`Customer evidence register could not be read: ${error.message}`);
        process.exit(1);
    }
}

function text(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function isDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

const sourceTypes = new Set([
    'moderated_playtest',
    'adult_interview',
    'parent_guardian_interview',
    'voluntary_survey',
    'support_case',
    'public_review',
    'creator_partner_conversation'
]);
const audienceRoles = new Set([
    'player',
    'parent_guardian',
    'creator',
    'partner',
    'press',
    'unknown'
]);
const journeys = new Set([
    'discover',
    'understand',
    'start',
    'hatch',
    'bond',
    'explore',
    'restore',
    'return',
    'share',
    'seek_help'
]);
const themeNames = new Set([
    'positioning',
    'trust',
    'performance',
    'accessibility',
    'controls',
    'story',
    'companion',
    'progression',
    'difficulty',
    'safety',
    'privacy',
    'ai',
    'support',
    'commercial'
]);
const statuses = new Set(['accepted', 'withdrawn', 'rejected']);
const confidenceNames = new Set(['low', 'medium', 'high']);
const prohibitedKeys = new Set([
    'name',
    'email',
    'phone',
    'address',
    'exactAge',
    'birthDate',
    'ipAddress',
    'accountId',
    'userId',
    'creatureName',
    'handle',
    'rawMessage',
    'transcript',
    'audio',
    'video',
    'image'
]);
const allowedRecordKeys = new Set([
    'id',
    'status',
    'observedDate',
    'acceptedDate',
    'sourceType',
    'audienceRole',
    'recruitmentContext',
    'protocolRef',
    'productVersion',
    'journey',
    'observation',
    'interpretation',
    'alternativeExplanations',
    'confidence',
    'themes',
    'evidenceOwner',
    'nextDecision',
    'retentionDeleteDate',
    'rawDataRef',
    'containsPersonalData',
    'humanReviewed',
    'synthetic'
]);
const obviousEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const obviousPhone = /(?:\+?\d[\d .()-]{7,}\d)/;

function inspectKeys(value, recordId, trail = []) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
        value.forEach((item, index) => inspectKeys(item, recordId, [...trail, String(index)]));
        return;
    }
    for (const [key, child] of Object.entries(value)) {
        if (prohibitedKeys.has(key)) {
            failures.push(`${recordId} contains prohibited field ${[...trail, key].join('.')}`);
        }
        inspectKeys(child, recordId, [...trail, key]);
    }
}

const register = loadJson(evidencePath);
if (register.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (register.registerContainsPersonalData !== false) {
    failures.push('registerContainsPersonalData must be false');
}
if (register.externalSharingAuthorized !== false) {
    failures.push('externalSharingAuthorized must remain false for this pilot');
}
if (!Number.isInteger(register.minimumDistinctEvidenceForTheme) || register.minimumDistinctEvidenceForTheme < 3) {
    failures.push('minimumDistinctEvidenceForTheme must be an integer of at least 3');
}
if (!Array.isArray(register.records)) failures.push('records must be an array');

const ids = new Set();
for (const [index, record] of (register.records || []).entries()) {
    const label = record?.id || `records[${index}]`;
    if (!/^CE-\d{3,}$/.test(record?.id || '')) failures.push(`${label} has an invalid evidence ID`);
    if (ids.has(record?.id)) failures.push(`Duplicate evidence ID ${record.id}`);
    ids.add(record?.id);
    inspectKeys(record, label);
    for (const key of Object.keys(record || {})) {
        if (!allowedRecordKeys.has(key)) failures.push(`${label} contains unsupported field ${key}`);
    }

    if (!statuses.has(record?.status)) failures.push(`${label} has invalid status`);
    if (!isDate(record?.observedDate)) failures.push(`${label} has invalid observedDate`);
    if (record?.status === 'accepted' && !isDate(record?.acceptedDate)) {
        failures.push(`${label} is accepted without a valid acceptedDate`);
    }
    if (!sourceTypes.has(record?.sourceType)) failures.push(`${label} has invalid sourceType`);
    if (!audienceRoles.has(record?.audienceRole)) failures.push(`${label} has invalid audienceRole`);
    if (!journeys.has(record?.journey)) failures.push(`${label} has invalid journey`);
    if (!confidenceNames.has(record?.confidence)) failures.push(`${label} has invalid confidence`);
    if (!text(record?.recruitmentContext)) failures.push(`${label} lacks recruitmentContext`);
    if (!text(record?.protocolRef)) failures.push(`${label} lacks protocolRef`);
    if (!text(record?.productVersion)) failures.push(`${label} lacks productVersion`);
    if (!text(record?.observation)) failures.push(`${label} lacks observation`);
    if (!text(record?.interpretation)) failures.push(`${label} lacks separate interpretation`);
    if ((record?.observation || '').length > 500) failures.push(`${label} observation exceeds 500 characters`);
    if ((record?.interpretation || '').length > 500) failures.push(`${label} interpretation exceeds 500 characters`);
    if (!Array.isArray(record?.alternativeExplanations) || record.alternativeExplanations.length === 0) {
        failures.push(`${label} lacks alternativeExplanations`);
    }
    if (!Array.isArray(record?.themes) || record.themes.length === 0) {
        failures.push(`${label} lacks themes`);
    } else if (!record.themes.every(theme => themeNames.has(theme))) {
        failures.push(`${label} contains an invalid theme`);
    }
    if (!text(record?.evidenceOwner)) failures.push(`${label} lacks evidenceOwner`);
    if (!text(record?.nextDecision)) failures.push(`${label} lacks nextDecision`);
    if (!isDate(record?.retentionDeleteDate)) failures.push(`${label} has invalid retentionDeleteDate`);
    if (!text(record?.rawDataRef)) failures.push(`${label} lacks rawDataRef or an explicit none-retained statement`);
    if (record?.containsPersonalData !== false) failures.push(`${label} must set containsPersonalData to false`);
    if (record?.synthetic !== false) failures.push(`${label} must set synthetic to false`);
    if (record?.status === 'accepted' && record?.humanReviewed !== true) {
        failures.push(`${label} is accepted without humanReviewed=true`);
    }

    const sharedNarrative = [
        record?.recruitmentContext,
        record?.observation,
        record?.interpretation,
        ...(record?.alternativeExplanations || [])
    ].filter(text).join(' ');
    if (obviousEmail.test(sharedNarrative)) failures.push(`${label} contains an email-like value`);
    if (obviousPhone.test(sharedNarrative)) failures.push(`${label} contains a phone-like value`);
}

const accepted = (register.records || []).filter(record => record.status === 'accepted');
if (accepted.length === 0) {
    warnings.push('No accepted customer evidence exists; no customer insight or product recommendation may be claimed.');
}

const themeMap = new Map();
for (const record of accepted) {
    for (const theme of record.themes) {
        if (!themeMap.has(theme)) {
            themeMap.set(theme, {
                evidenceIds: [],
                sourceTypes: new Set(),
                audienceRoles: new Set(),
                journeys: new Set(),
                productVersions: new Set(),
                confidenceCounts: { low: 0, medium: 0, high: 0 },
                alternativeExplanations: []
            });
        }
        const group = themeMap.get(theme);
        group.evidenceIds.push(record.id);
        group.sourceTypes.add(record.sourceType);
        group.audienceRoles.add(record.audienceRole);
        group.journeys.add(record.journey);
        group.productVersions.add(record.productVersion);
        group.confidenceCounts[record.confidence] += 1;
        group.alternativeExplanations.push(...record.alternativeExplanations);
    }
}

const threshold = register.minimumDistinctEvidenceForTheme || 3;
const themes = [...themeMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([theme, group]) => {
    const evidenceCount = group.evidenceIds.length;
    const sourceDiversity = group.sourceTypes.size;
    let synthesisConfidence = 'directional';
    if (evidenceCount >= threshold && sourceDiversity >= 2) synthesisConfidence = 'credible';
    if (
        evidenceCount >= Math.max(5, threshold) &&
        sourceDiversity >= 2 &&
        group.confidenceCounts.high >= Math.ceil(evidenceCount / 2)
    ) {
        synthesisConfidence = 'candidate_decision_grade';
    }
    return {
        theme,
        evidenceIds: group.evidenceIds,
        evidenceCount,
        sourceTypes: [...group.sourceTypes].sort(),
        audienceRoles: [...group.audienceRoles].sort(),
        journeys: [...group.journeys].sort(),
        productVersions: [...group.productVersions].sort(),
        confidenceCounts: group.confidenceCounts,
        synthesisConfidence,
        boundary: 'Qualitative evidence only; no population prevalence inference is authorized.',
        alternativeExplanations: [...new Set(group.alternativeExplanations)].slice(0, 10),
        requiresHumanInsightReview: true
    };
});

const credibleThemeCount = themes.filter(theme =>
    ['credible', 'candidate_decision_grade'].includes(theme.synthesisConfidence)
).length;

console.log(JSON.stringify({
    workflow: 'A-005',
    mode: 'de-identified accepted-evidence synthesis pilot',
    registerValid: failures.length === 0,
    decisionReadiness: failures.length === 0 && credibleThemeCount > 0,
    externalSharingAuthorized: false,
    recordCount: (register.records || []).length,
    acceptedEvidenceCount: accepted.length,
    themeCount: themes.length,
    credibleThemeCount,
    failures,
    warnings,
    themes,
    nextGate: accepted.length === 0
        ? 'Run an approved moderated research round and enter only human-reviewed de-identified records.'
        : 'A human evidence reviewer must verify every synthesized insight and link it to a decision, experiment, or handoff.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (credibleThemeCount === 0) process.exitCode = 2;
