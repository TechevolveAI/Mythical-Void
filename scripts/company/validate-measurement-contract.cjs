#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs', 'company', 'measurement', 'event-contract.json');
const contractPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultContractPath;
const failures = [];
const warnings = [];

function load(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`Measurement contract could not be read: ${error.message}`);
        process.exit(1);
    }
}

const contract = load(contractPath);
const expectedM1Events = new Set([
    'storefront_loaded', 'play_selected', 'game_boot_ready', 'age_settings_applied',
    'hatch_started', 'hatch_completed', 'first_bond_completed',
    'first_expedition_started', 'first_realm_completed', 'client_error',
    'performance_bucket'
]);
const explicitlyDeferredEvents = new Set(['return_session_started']);
const prohibitedNames = new Set(contract.prohibitedFields || []);

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (contract.status !== 'proposed') failures.push('This pilot contract must remain proposed');
if (contract.mode !== 'M1_identifier_free_aggregate') failures.push('mode must be M1_identifier_free_aggregate');
if (contract.collectionEnabled !== false) failures.push('collectionEnabled must remain false before approval');
if (contract.externalEndpoint !== null) failures.push('externalEndpoint must remain null before implementation approval');
if (contract.reportingLanguage !== 'events_and_attempts_not_users') failures.push('reportingLanguage must prohibit user/unique-person claims');
if (contract.limits?.maximumPayloadBytes !== 1024) failures.push('maximumPayloadBytes must be 1024');
if (contract.limits?.rawApplicationBodyLoggingPermitted !== false) failures.push('raw application body logging must be prohibited');
if (!Number.isInteger(contract.limits?.aggregateRetentionMonths) || contract.limits.aggregateRetentionMonths < 1) failures.push('aggregateRetentionMonths must be explicit');
if (contract.limits?.aggregateRetentionApproved !== false) failures.push('aggregate retention must remain unapproved in the proposal');

const requiredGates = [
    'kevinApproved', 'privacyReviewComplete', 'dpiaComplete',
    'gameDevelopmentBoundariesConfirmed', 'networkDataFlowVerified',
    'deletionAndIncidentOwnersNamed'
];
for (const gate of requiredGates) {
    if (contract.approvalGates?.[gate] !== false) failures.push(`${gate} must be false until evidenced`);
}
for (const decision of ['D-003', 'D-004']) {
    if (contract.approvalGates?.[decision] !== 'proposed') failures.push(`${decision} must remain proposed`);
}

const allowedPropertyNames = new Set(Object.keys(contract.allowedProperties || {}));
if (allowedPropertyNames.size === 0) failures.push('allowedProperties must not be empty');
for (const [property, values] of Object.entries(contract.allowedProperties || {})) {
    if (prohibitedNames.has(property)) failures.push(`${property} is both allowed and prohibited`);
    if (!Array.isArray(values) || values.length === 0) failures.push(`${property} lacks an enum allowlist`);
    if ((values || []).some(value => typeof value !== 'string' || value.trim() === '')) failures.push(`${property} contains a non-text or empty enum`);
}

const eventNames = new Set();
for (const [index, event] of (contract.events || []).entries()) {
    const label = event?.name || `events[${index}]`;
    if (!/^[a-z][a-z0-9_]*$/.test(event?.name || '')) failures.push(`${label} has invalid event name`);
    if (eventNames.has(event?.name)) failures.push(`duplicate event ${event.name}`);
    eventNames.add(event?.name);
    if (!Array.isArray(event?.properties)) failures.push(`${label} properties must be an array`);
    for (const property of event?.properties || []) {
        if (!allowedPropertyNames.has(property)) failures.push(`${label} uses unapproved property ${property}`);
        if (prohibitedNames.has(property)) failures.push(`${label} uses prohibited property ${property}`);
    }
    if (event?.mode === 'M1' && !expectedM1Events.has(event.name)) failures.push(`${label} is not in the M1 event allowlist`);
    if (event?.mode === 'M2_deferred') {
        if (!explicitlyDeferredEvents.has(event.name)) failures.push(`${label} is not an explicitly deferred event`);
        if (event.properties.length !== 0) failures.push(`${label} deferred event must expose no properties`);
    }
    if (!['M1', 'M2_deferred'].includes(event?.mode)) failures.push(`${label} has invalid mode`);
    if (typeof event?.authoritativeBoundary !== 'string' || !event.authoritativeBoundary.trim()) failures.push(`${label} lacks authoritativeBoundary`);
    if (event?.boundaryConfirmed !== false) failures.push(`${label} boundary must remain unconfirmed`);
}
for (const eventName of expectedM1Events) {
    if (!eventNames.has(eventName)) failures.push(`missing proposed M1 event ${eventName}`);
}
for (const eventName of explicitlyDeferredEvents) {
    if (!eventNames.has(eventName)) failures.push(`missing deferred event record ${eventName}`);
}

function listJavaScriptFiles(directory, result = []) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === '__tests__') continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) listJavaScriptFiles(absolute, result);
        else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) result.push(absolute);
    }
    return result;
}

const sourceFiles = listJavaScriptFiles(path.join(repositoryRoot, 'src'));
const sourceText = sourceFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
const commonTrackerSignals = [...sourceText.matchAll(/\b(gtag|posthog|mixpanel|segment\.track|sendBeacon|amplitude\.(?:init|track))\b/gi)].map(match => match[1].toLowerCase());
const internalTelemetrySignals = [...sourceText.matchAll(/telemetry\/[a-z0-9_/-]+/gi)].map(match => match[0]);
if (commonTrackerSignals.length) warnings.push(`Common tracker-like source signals require review: ${[...new Set(commonTrackerSignals)].join(', ')}`);
if (internalTelemetrySignals.length) warnings.push('Internal GameState telemetry-style events exist; no claim is made that they are network collection, and their consumers require Game Development verification.');

const unresolvedGates = [
    'Kevin decisions D-003 and D-004 are not approved.',
    'Privacy review and DPIA are incomplete.',
    'Game Development has not confirmed authoritative milestone boundaries.',
    'Network/logging, aggregate retention, small-cell suppression, incident/deletion ownership, and kill switch are unverified.',
    'No endpoint exists and collectionEnabled is false.'
];

console.log(JSON.stringify({
    workflow: 'A-006',
    mode: 'offline measurement-contract assurance',
    contractValid: failures.length === 0,
    productionCollectionAuthorized: false,
    collectionEnabled: contract.collectionEnabled,
    eventCount: (contract.events || []).length,
    m1EventCount: (contract.events || []).filter(event => event.mode === 'M1').length,
    allowedPropertyCount: allowedPropertyNames.size,
    prohibitedFieldCount: prohibitedNames.size,
    sourceAudit: {
        filesChecked: sourceFiles.length,
        commonTrackerSignalCount: commonTrackerSignals.length,
        internalTelemetrySignalCount: internalTelemetrySignals.length,
        limitation: 'Static source scan only; it does not prove production network behavior or vendor logging.'
    },
    failures,
    warnings,
    unresolvedGates
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;
