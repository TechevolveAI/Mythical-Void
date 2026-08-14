#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '../..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/website-analytics-tag.json');

function parseArguments(values) {
    if (values.length === 0) return { contractPath: defaultContractPath };
    if (values.length === 2 && values[0] === '--input') return { contractPath: path.resolve(values[1]) };
    throw new Error('Usage: node scripts/company/validate-website-analytics-tag.cjs [--input contract.json]');
}

function loadJson(file, label) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { console.error(`${label} could not be read: ${error.message}`); process.exit(1); }
}

function read(relative) {
    return fs.readFileSync(path.join(repositoryRoot, relative), 'utf8');
}

function exactSet(actual, expected, label, failures) {
    if (!Array.isArray(actual)
        || actual.length !== expected.length
        || expected.some(item => !actual.includes(item))) {
        failures.push(`${label} must be exactly ${expected.join(', ')}`);
    }
}

function collectSourceText(directory, pieces = []) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory() && !['site', '__tests__'].includes(entry.name)) collectSourceText(absolute, pieces);
        else if (entry.isFile()
            && /\.(?:js|mjs|cjs)$/.test(entry.name)
            && !absolute.includes(`${path.sep}site${path.sep}`)) {
            pieces.push(fs.readFileSync(absolute, 'utf8'));
        }
    }
    return pieces;
}

let options;
try { options = parseArguments(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exit(1); }

const contract = loadJson(options.contractPath, 'Website analytics contract');
const registry = loadJson(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = loadJson(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register');
const decisionsText = read('docs/company/registers/DECISIONS.md');
const failures = [];

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'consent_gated_public_website_measurement_live_source_verified') failures.push('status is invalid');
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

const tag = contract.tag || {};
const includedRoutes = [
    '/', '/press/', '/privacy/', '/terms/', '/parents/', '/creature-genetics/',
    '/nasa-space-science/', '/studio/'
];
if (tag.measurementId !== 'G-FTM4W73EQC') failures.push('measurementId is invalid');
if (tag.scriptUrl !== 'https://www.googletagmanager.com/gtag/js?id=G-FTM4W73EQC') failures.push('scriptUrl is invalid');
if (tag.scope !== 'consented_public_website_only') failures.push('scope is invalid');
exactSet(tag.includedRoutes, includedRoutes, 'includedRoutes', failures);
exactSet(tag.excludedRoutes, ['/play/', '/game/', '?testBoss'], 'excludedRoutes', failures);
for (const field of ['defaultAnalyticsStorage', 'defaultAdStorage', 'defaultAdUserData', 'defaultAdPersonalization']) {
    if (tag[field] !== 'denied') failures.push(`${field} must be denied`);
}
for (const field of ['allowGoogleSignals', 'allowAdPersonalizationSignals', 'pageViewBeforeChoice']) {
    if (tag[field] !== false) failures.push(`${field} must remain false`);
}
for (const field of ['visitorChoiceRequired', 'pageLocationUsesCanonicalPathOnly']) {
    if (tag[field] !== true) failures.push(`${field} must be true`);
}

const actions = contract.publicActions || {};
const allowedEvents = ['public_play_selected', 'public_share_selected'];
const allowedPageGroups = ['home', 'press', 'privacy', 'terms', 'parents', 'creature_genetics', 'nasa_stem', 'studio', 'other'];
if (actions.enabled !== true || actions.consentRequired !== true) failures.push('public actions must be enabled only with consent');
exactSet(actions.eventNames, allowedEvents, 'public action events', failures);
if (actions.allowedProperty !== 'page_group') failures.push('page_group must be the only public action property');
exactSet(actions.allowedPageGroups, allowedPageGroups, 'allowed page groups', failures);
for (const event of allowedEvents) {
    if (typeof actions.meaning?.[event] !== 'string' || actions.meaning[event].length < 80) failures.push(`${event} meaning is incomplete`);
}

const authority = contract.authority || {};
for (const field of ['productionDeploymentAuthorizedByKevin', 'consentedPublicWebsiteMeasurementApproved']) {
    if (authority[field] !== true) failures.push(`authority.${field} must be true`);
}
for (const field of ['adPersonalizationAuthorized', 'gameMeasurementAuthorized', 'userProfilingAuthorized', 'paidMediaUseAuthorized']) {
    if (authority[field] !== false) failures.push(`authority.${field} must remain false`);
}

const sourcePaths = [
    'index.html',
    'src/site/analytics-consent.js',
    'src/site/storefront.js',
    'src/site/storefront.css',
    'public/discovery.js',
    'netlify.toml',
    'vercel.json'
];
if (!Array.isArray(contract.sourceChecks) || contract.sourceChecks.length !== sourcePaths.length) failures.push('sourceChecks must contain 7 files');
sourcePaths.forEach((sourcePath, index) => {
    const item = contract.sourceChecks?.[index] || {};
    if (item.id !== `GA-${String(index + 1).padStart(3, '0')}` || item.path !== sourcePath) failures.push(`source check ${index + 1} is invalid`);
});

const indexText = read('index.html');
const consentText = read('src/site/analytics-consent.js');
const storefrontText = read('src/site/storefront.js');
const storefrontCss = read('src/site/storefront.css');
const discoveryText = read('public/discovery.js');
const netlifyText = read('netlify.toml');
const vercelText = read('vercel.json');

for (const required of [
    'G-FTM4W73EQC', "analytics_storage: 'denied'", "ad_storage: 'denied'",
    "ad_user_data: 'denied'", "ad_personalization: 'denied'", 'send_page_view: false',
    'allow_google_signals: false', 'allow_ad_personalization_signals: false',
    "path === '/play'", "path === '/game'", "params.has('testBoss')",
    'www.googletagmanager.com/gtag/js', 'if (isGameRoute) return'
]) if (!indexText.includes(required)) failures.push(`index.html missing ${required}`);

for (const source of [consentText, discoveryText]) {
    for (const required of [
        'public_play_selected', 'public_share_selected', 'page_group',
        "'granted'", "gtag('event'", 'transport_type'
    ]) if (!source.includes(required)) failures.push(`public action helper missing ${required}`);
    for (const blocked of ['full_url:', 'query_string:', 'raw_referrer:', 'button_text:', 'creature_id:', 'age_band:']) {
        if (source.includes(blocked)) failures.push(`public action helper contains blocked field ${blocked}`);
    }
}
for (const required of ['mountPublicActionMeasurement', 'Play buttons', 'Share button', 'not used in the game']) {
    if (!consentText.includes(required)) failures.push(`analytics consent helper missing ${required}`);
}
for (const required of ['mountPublicActionMeasurement', 'public page group', 'game progress', 'search terms', 'not used in the game']) {
    if (!storefrontText.includes(required)) failures.push(`storefront missing ${required}`);
}
for (const required of ['analytics-consent', 'analytics-consent-actions', 'analytics-consent-yes']) {
    if (!storefrontCss.includes(required)) failures.push(`storefront style missing ${required}`);
}
for (const policy of [netlifyText, vercelText]) {
    if (!policy.includes('https://www.googletagmanager.com')) failures.push('hosting policy must allow Google tag script');
    if (!policy.includes('https://www.google-analytics.com')) failures.push('hosting policy must allow Google Analytics connection');
    if (!policy.includes('https://region1.google-analytics.com')) failures.push('hosting policy must allow regional Google Analytics connection');
}

const gameSourceText = collectSourceText(path.join(repositoryRoot, 'src')).join('\n');
for (const blocked of ['G-FTM4W73EQC', 'googletagmanager.com/gtag/js', ...allowedEvents]) {
    if (gameSourceText.includes(blocked)) failures.push(`game source must not contain ${blocked}`);
}

const prohibitedData = [
    'user_id', 'account_id', 'email', 'name', 'age', 'age_band', 'birth_date',
    'child_data', 'creature_id', 'creature_name', 'game_save', 'game_progress',
    'story_choice', 'full_url', 'query_string', 'raw_referrer', 'button_text',
    'search_term', 'ip_address', 'advertising_id'
];
exactSet(contract.prohibitedData, prohibitedData, 'prohibitedData', failures);

if (!Array.isArray(contract.activationGates) || contract.activationGates.length !== 12) failures.push('activationGates must contain 12 gates');
for (let index = 0; index < 12; index += 1) {
    const gate = contract.activationGates?.[index];
    if (gate?.id !== `GA-G${String(index + 1).padStart(2, '0')}` || gate?.satisfied !== true) failures.push(`activation gate ${index + 1} must be satisfied`);
}

const trustFields = ['googlePropertyOwnerConfirmed', 'retentionSettingConfirmed', 'reportAccessVerified', 'productionDataReceptionVerified'];
for (const field of trustFields) if (contract.reportingTrustGates?.[field] !== false) failures.push(`reportingTrustGates.${field} must remain false until verified`);
if (contract.productionDeployed !== true) failures.push('productionDeployed must be true');
if (contract.trustedForCompanyReporting !== false) failures.push('trustedForCompanyReporting must remain false');
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 500) failures.push('nextDecision is incomplete');

const implementationLiveAndBounded = failures.length === 0;
const reportingTrustReady = trustFields.every(field => contract.reportingTrustGates?.[field] === true);
console.log(JSON.stringify({
    workflow: 'A-058',
    mode: 'consent-gated public website page and action measurement assurance',
    implementationLiveAndBounded,
    measurementId: tag.measurementId,
    scope: tag.scope,
    defaultConsent: 'denied',
    publicRouteCount: (tag.includedRoutes || []).length,
    excludedGameRouteCount: (tag.excludedRoutes || []).length,
    publicActionEvents: actions.eventNames || [],
    publicActionProperty: actions.allowedProperty,
    adFeaturesOff: tag.allowGoogleSignals === false && tag.allowAdPersonalizationSignals === false,
    gameMeasurementAuthorized: authority.gameMeasurementAuthorized,
    productionDeployed: contract.productionDeployed,
    reportingTrustReady,
    trustedForCompanyReporting: contract.trustedForCompanyReporting,
    failures,
    nextDecision: contract.nextDecision
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (!reportingTrustReady) process.exitCode = 2;
