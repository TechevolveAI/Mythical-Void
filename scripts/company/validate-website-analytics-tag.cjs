#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/website-analytics-tag.json');
function parseArguments(values) {
    if (values.length === 0) return { contractPath: defaultContractPath };
    if (values.length === 2 && values[0] === '--input') return { contractPath: path.resolve(values[1]) };
    throw new Error('Usage: node scripts/company/validate-website-analytics-tag.cjs [--input contract.json]');
}
function loadJson(file, label) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { console.error(`${label} could not be read: ${error.message}`); process.exit(1); } }
function exactSet(actual, expected, label, failures) { if (!Array.isArray(actual) || actual.length !== expected.length || expected.some(item => !actual.includes(item))) failures.push(`${label} must be exactly ${expected.join(', ')}`); }
function exactKeys(object, expected, label, failures) { exactSet(object && typeof object === 'object' && !Array.isArray(object) ? Object.keys(object) : [], expected, `${label} fields`, failures); }
function requireFalse(object, fields, label, failures, exact = false) { if (exact) exactKeys(object, fields, label, failures); for (const field of fields) if (object?.[field] !== false) failures.push(`${label}.${field} must remain false`); }
function requireTrue(object, fields, label, failures) { for (const field of fields) if (object?.[field] !== true) failures.push(`${label}.${field} must be true`); }
function read(relative) { return fs.readFileSync(path.join(repositoryRoot, relative), 'utf8'); }

let options;
try { options = parseArguments(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exit(1); }
const contract = loadJson(options.contractPath, 'Website analytics tag contract');
const registry = loadJson(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = loadJson(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register');
const decisionsText = read('docs/company/registers/DECISIONS.md');
const failures = [];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'consent_gated_public_shop_window_tag_live_property_verified_governance_review_pending') failures.push('status is invalid');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 500) failures.push('purpose is incomplete');
exactSet(contract.decisionRefs, ['D-003', 'D-004', 'D-015'], 'decisionRefs', failures);
exactSet(contract.riskRefs, ['R-001', 'R-005', 'R-011'], 'riskRefs', failures);
exactSet(contract.workflowRefs, ['A-006', 'A-018', 'A-055', 'A-058'], 'workflowRefs', failures);
const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set((risks.risks || []).map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));
for (const id of contract.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);
for (const id of contract.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);

const authorityFields = ['productionDeploymentAuthorizedByKevin', 'liveMeasurementApproved', 'adPersonalizationAuthorized', 'gameMeasurementAuthorized', 'userProfilingAuthorized', 'externalActionAuthorized'];
if (contract.authority?.productionDeploymentAuthorizedByKevin !== true) failures.push('productionDeploymentAuthorizedByKevin must be true for this requested release');
requireFalse(contract.authority, authorityFields.filter(field => field !== 'productionDeploymentAuthorizedByKevin'), 'authority', failures, false);

const tag = contract.tag || {};
const productionEvidence = contract.productionEvidence || {};
if (tag.measurementId !== 'G-FTM4W73ECQ') failures.push('measurementId is invalid');
if (tag.scriptUrl !== 'https://www.googletagmanager.com/gtag/js?id=G-FTM4W73ECQ') failures.push('scriptUrl is invalid');
if (tag.scope !== 'public_shop_window_only') failures.push('scope is invalid');
exactSet(tag.includedRoutes, ['/', '/privacy/', '/terms/'], 'includedRoutes', failures);
exactSet(tag.excludedRoutes, ['/play/', '/game/', '?testBoss'], 'excludedRoutes', failures);
for (const field of ['defaultAnalyticsStorage', 'defaultAdStorage', 'defaultAdUserData', 'defaultAdPersonalization']) if (tag[field] !== 'denied') failures.push(`${field} must be denied`);
requireFalse(tag, ['allowGoogleSignals', 'allowAdPersonalizationSignals', 'pageViewBeforeChoice'], 'tag', failures);
requireTrue(tag, ['visitorChoiceRequired', 'pageLocationUsesCanonicalPathOnly'], 'tag', failures);
if (productionEvidence.checkedOn !== '2026-08-31') failures.push('production evidence date is stale');
if (productionEvidence.productionUrl !== 'https://mythicalvoid.com/') failures.push('production URL is invalid');
if (!/^[0-9a-f]{40}$/.test(productionEvidence.verifiedSourceCommit || '')) failures.push('verified source commit is invalid');
if (!/^[0-9a-f]{24}$/.test(productionEvidence.verifiedDeployId || '')) failures.push('verified deploy id is invalid');
if (productionEvidence.deployState !== 'ready') failures.push('verified deploy must be ready');
if (productionEvidence.homepageTagScriptObserved !== true || productionEvidence.homepageTagScriptUrl !== tag.scriptUrl) failures.push('live homepage tag observation is invalid');
if (productionEvidence.gameRuntimeTagScriptObserved !== false) failures.push('live game runtime must not load the tag script');
if (productionEvidence.privacyAnalyticsWordingObserved !== true) failures.push('live privacy wording was not observed');
requireFalse(productionEvidence, ['freshBrowserConsentJourneyVerified', 'measurementTrustedForDecisions'], 'productionEvidence', failures);
if (productionEvidence.googlePropertyEventsVerified !== true) failures.push('Google property event receipt must reflect the read-only property inspection');
if (typeof productionEvidence.limitation !== 'string' || productionEvidence.limitation.length < 250) failures.push('production evidence limitation is incomplete');

const property = contract.propertySideEvidence || {};
if (property.checkedOn !== '2026-08-31' || property.inspectionMode !== 'signed_in_read_only_browser') failures.push('property inspection evidence is invalid');
if (property.accountName !== 'TechEvolveAI' || property.propertyName !== 'TechEvolveAI') failures.push('property account identity is invalid');
if (property.streamName !== 'Mythical Void' || property.streamUrl !== 'https://www.mythicalvoid.com') failures.push('property stream identity is invalid');
if (property.streamId !== '15420950256' || property.measurementId !== tag.measurementId) failures.push('property stream or measurement id is invalid');
if (property.dataCollectionActiveInPast48Hours !== true) failures.push('property data-flow evidence is missing');
if (property.enhancedMeasurementEnabled !== true) failures.push('observed enhanced-measurement state is missing');
exactSet(property.activeEnhancedMeasurementsObserved, ['page_views', 'scrolls', 'outbound_clicks'], 'activeEnhancedMeasurementsObserved', failures);
if (property.observedReportPeriod !== '2026-08-03_to_2026-08-30' || property.observedEventCount !== 17 || property.observedTotalUsers !== 1 || property.observedSessionCount !== 5) failures.push('property report observation is invalid');
exactSet(property.observedEventNames, ['discovery_arrival', 'session_start', 'scroll', 'user_engagement', 'first_visit'], 'observedEventNames', failures);
if (property.eventDataRetention !== '2_months' || property.userDataRetention !== '14_months' || property.resetUserRetentionOnNewActivity !== true) failures.push('property retention observation is invalid');
requireFalse(property, ['propertySettingsChangeAuthorized', 'propertySettingsChangeMade'], 'propertySideEvidence', failures);
if (typeof property.interpretation !== 'string' || property.interpretation.length < 250) failures.push('property evidence interpretation is incomplete');

const sourcePaths = ['index.html', 'src/site/analytics-consent.js', 'src/site/storefront.js', 'src/site/storefront.css', 'netlify.toml', 'vercel.json'];
const expectedSourceChecks = sourcePaths.map((pathName, index) => `GA-${String(index + 1).padStart(3, '0')}`);
if (!Array.isArray(contract.sourceChecks) || contract.sourceChecks.length !== 6) failures.push('sourceChecks must contain 6 files');
for (let index = 0; index < sourcePaths.length; index += 1) {
    const item = contract.sourceChecks?.[index] || {};
    if (item.id !== expectedSourceChecks[index] || item.path !== sourcePaths[index]) failures.push(`source check ${index + 1} is invalid`);
}
const indexText = read('index.html');
const consentText = read('src/site/analytics-consent.js');
const storefrontText = read('src/site/storefront.js');
const storefrontCss = read('src/site/storefront.css');
const netlifyText = read('netlify.toml');
const vercelText = read('vercel.json');
for (const required of [
    'G-FTM4W73ECQ', 'analytics_storage: \'denied\'', 'ad_storage: \'denied\'', 'ad_user_data: \'denied\'', 'ad_personalization: \'denied\'',
    "send_page_view: false", "allow_google_signals: false", "allow_ad_personalization_signals: false", "path === '/play'", "path === '/game'", "params.has('testBoss')", 'www.googletagmanager.com/gtag/js'
]) if (!indexText.includes(required)) failures.push(`index.html missing ${required}`);
for (const required of ['Allow analytics', 'No thanks', 'mythical-analytics-consent', 'setConsent', 'analytics-consent', 'whether people reach a lower part of a page']) if (!consentText.includes(required)) failures.push(`analytics consent helper missing ${required}`);
for (const required of ['mountAnalyticsConsent', 'Optional website analytics', 'off by default', 'not used in the game', 'whether a visitor reaches a lower part of a public page', 'basic visit and session events after permission is given']) if (!storefrontText.includes(required)) failures.push(`storefront missing ${required}`);
for (const required of ['analytics-consent', 'analytics-consent-actions', 'analytics-consent-yes']) if (!storefrontCss.includes(required)) failures.push(`storefront style missing ${required}`);
for (const policy of [netlifyText, vercelText]) {
    if (!policy.includes('https://www.googletagmanager.com')) failures.push('hosting policy must allow Google tag script');
    if (!policy.includes('https://www.google-analytics.com')) failures.push('hosting policy must allow Google Analytics connection');
    if (!policy.includes('https://region1.google-analytics.com')) failures.push('hosting policy must allow regional Google Analytics connection');
}
function collectSourceText(directory, pieces = []) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory() && entry.name !== 'site') collectSourceText(absolute, pieces);
        else if (entry.isFile() && /\.(?:js|mjs|cjs)$/.test(entry.name) && !absolute.includes(`${path.sep}site${path.sep}`)) pieces.push(fs.readFileSync(absolute, 'utf8'));
    }
    return pieces;
}
const gameSourceText = collectSourceText(path.join(repositoryRoot, 'src')).join('\n');
if (gameSourceText.includes('G-FTM4W73ECQ') || gameSourceText.includes('googletagmanager.com/gtag/js')) failures.push('game source must not contain the Google tag');
if (!indexText.includes('if (isGameRoute) return')) failures.push('index.html must stop before loading the tag on game routes');

exactSet(contract.prohibitedData, ['user_id', 'account_id', 'email', 'name', 'age', 'age_band', 'birth_date', 'child_data', 'creature_id', 'creature_name', 'game_save', 'story_choice', 'full_url', 'query_string', 'raw_referrer', 'ip_address', 'advertising_id'], 'prohibitedData', failures);
const gateCount = Array.isArray(contract.activationGates) ? contract.activationGates.length : 0;
if (gateCount !== 12) failures.push('activationGates must contain 12 gates');
for (let index = 0; index < 12; index += 1) if (contract.activationGates?.[index]?.id !== `GA-G${String(index + 1).padStart(2, '0')}` || contract.activationGates?.[index]?.satisfied !== true) failures.push(`activation gate ${index + 1} must remain satisfied`);
requireTrue(contract, ['tagImplementationReadyForReview'], 'contract', failures);
requireTrue(contract, ['productionDeployed'], 'contract', failures);
requireFalse(contract, ['externalActionAuthorized'], 'contract', failures);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 500) failures.push('nextDecision is incomplete');

const tagImplementationReadyForReview = failures.length === 0;
const output = {
    workflow: 'A-058',
    mode: 'offline source assurance plus signed-in read-only property evidence; consent and minimal-setting review remain pending',
    tagImplementationReadyForReview,
    measurementId: tag.measurementId,
    scope: tag.scope,
    defaultConsent: 'denied',
    visitorChoiceRequired: tag.visitorChoiceRequired === true,
    pageViewBeforeChoice: tag.pageViewBeforeChoice,
    adFeaturesOff: tag.allowGoogleSignals === false && tag.allowAdPersonalizationSignals === false,
    publicRouteCount: (tag.includedRoutes || []).length,
    excludedGameRouteCount: (tag.excludedRoutes || []).length,
    sourceCheckCount: sourcePaths.length,
    prohibitedDataFieldCount: (contract.prohibitedData || []).length,
    gameSourceTagHits: 0,
    hostingPolicyCount: 2,
    productionDeployed: contract.productionDeployed === true,
    verifiedDeployId: productionEvidence.verifiedDeployId,
    homepageTagScriptObserved: productionEvidence.homepageTagScriptObserved,
    gameRuntimeTagScriptObserved: productionEvidence.gameRuntimeTagScriptObserved,
    freshBrowserConsentJourneyVerified: productionEvidence.freshBrowserConsentJourneyVerified,
    googlePropertyEventsVerified: productionEvidence.googlePropertyEventsVerified,
    propertyStreamName: property.streamName,
    propertyMeasurementIdMatched: property.measurementId === tag.measurementId,
    propertyDataFlowing: property.dataCollectionActiveInPast48Hours,
    enhancedMeasurementEnabled: property.enhancedMeasurementEnabled,
    propertySettingsChanged: property.propertySettingsChangeMade,
    measurementTrustedForDecisions: productionEvidence.measurementTrustedForDecisions,
    externalActionAuthorized: false,
    activationGateCount: gateCount,
    satisfiedActivationGateCount: (contract.activationGates || []).filter(item => item.satisfied).length,
    failures,
    nextDecision: contract.nextDecision
};
console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exitCode = 1;
else process.exitCode = 0;
