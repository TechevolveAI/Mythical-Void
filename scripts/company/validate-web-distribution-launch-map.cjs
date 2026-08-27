#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const mapFlag = process.argv.indexOf('--map');
const mapPath = mapFlag >= 0
    ? path.resolve(process.argv[mapFlag + 1] || '')
    : path.join(repositoryRoot, 'docs', 'company', 'growth', 'WEB_DISTRIBUTION_LAUNCH_MAP.json');
const mapTextPath = path.join(repositoryRoot, 'docs', 'company', 'growth', 'WEB_DISTRIBUTION_LAUNCH_MAP.md');
const visualPath = path.join(repositoryRoot, 'docs', 'company', 'content', 'visual-launch-moments.json');
const itchPath = path.join(repositoryRoot, 'docs', 'company', 'growth', 'ITCH_RELEASE_CANDIDATE.json');
const pokiAssessmentPath = path.join(repositoryRoot, 'docs', 'company', 'growth', 'POKI_READINESS_ASSESSMENT.json');
const pokiMeasurementPath = path.join(repositoryRoot, 'docs', 'company', 'growth', 'poki-candidate-measurement.json');
const decisionsPath = path.join(repositoryRoot, 'docs', 'company', 'registers', 'DECISIONS.md');
const measurementSnapshotToleranceBytes = 128 * 1024;
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const withinSnapshotTolerance = (recorded, measured) =>
    Number.isFinite(recorded) && Number.isFinite(measured) &&
    Math.abs(recorded - measured) <= measurementSnapshotToleranceBytes;

function readJson(file, label) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

const map = readJson(mapPath, 'Web distribution launch map');
const visuals = readJson(visualPath, 'Visual launch register');
const itch = readJson(itchPath, 'itch.io release candidate');
const pokiAssessment = readJson(pokiAssessmentPath, 'Poki readiness assessment');
const pokiMeasurement = readJson(pokiMeasurementPath, 'Poki candidate measurement');
const mapText = fs.readFileSync(mapTextPath, 'utf8');
const decisions = fs.readFileSync(decisionsPath, 'utf8');

requireValue(map.id === 'WEB-DISTRIBUTION-001', 'map id is missing');
requireValue(map.state === 'options_preserved_no_external_action', 'distribution options must remain preserved without external action');
requireValue(map.currentTruth?.ownedGameLive === true, 'owned game state is stale');
requireValue(map.currentTruth?.itchPackageReady === true && itch.directPlay === true, 'itch.io package readiness is not grounded');
requireValue(map.currentTruth?.itchListingPublished === false, 'itch.io must not be presented as published');
requireValue(map.currentTruth?.pokiAccessRequested === false, 'Poki access must not be presented as requested');
requireValue(map.currentTruth?.youtubePlayablesInterestRequested === false, 'YouTube Playables interest must not be presented as requested');
requireValue(map.currentTruth?.approvedAuthenticVisualMoments === visuals.approvalRule?.approvedMomentCount, 'approved visual count does not match the visual register');
requireValue(map.currentTruth?.requiredAuthenticVisualMoments === visuals.approvalRule?.requiredApprovedMoments, 'required visual count does not match the visual register');
requireValue(map.recommendation?.afterVisualGate?.includes('Ask Kevin to choose'), 'Kevin distribution-rights decision is missing');
requireValue(map.recommendation?.afterVisualGate?.includes('Poki access request first'), 'recommended Poki-first option-preserving sequence is missing');
requireValue(map.recommendation?.decisionDue?.includes('4/4 visual gate'), 'decision must remain behind the visual gate');

const technical = map.technicalAssessment;
requireValue(technical?.source === 'docs/company/growth/POKI_READINESS_ASSESSMENT.json', 'Poki technical assessment source is missing');
requireValue(technical?.measurementSource === 'docs/company/growth/poki-candidate-measurement.json', 'Poki measurement source is missing');
requireValue(technical?.decision === pokiAssessment.decision && technical.decision === 'no_go_yet_preserve_option', 'Poki no-go-yet decision is missing');
requireValue(withinSnapshotTolerance(technical?.firstLoadGzipEstimateBytes, pokiMeasurement.firstLoad?.gzipEstimateBytes), 'Poki first-load evidence drifted beyond the 128 KiB snapshot tolerance');
requireValue(technical?.firstLoadAdvisoryTargetBytes === pokiMeasurement.firstLoad?.advisoryTargetBytes && technical.firstLoadTargetMet === true, 'Poki first-load target evidence is missing');
requireValue(withinSnapshotTolerance(technical?.totalGzipEstimateBytes, pokiMeasurement.package?.gzipEstimateBytes), 'Poki total-delivery evidence drifted beyond the 128 KiB snapshot tolerance');
requireValue(technical?.totalAdvisoryTargetBytes === pokiMeasurement.package?.advisoryTargetBytes && technical.totalTargetMet === false, 'Poki total-delivery gap is missing');
for (const field of ['outsideServicesIsolated', 'incognitoSavingVerified', 'tabletTouchVerified', 'fivePersonFirstMinuteReviewComplete', 'pokiSdkPresent', 'pokiSdkAuthorized', 'submissionReady']) {
    requireValue(technical?.[field] === false, `technicalAssessment.${field} must remain false`);
}

const poki = map.primaryFork?.find(route => route.id === 'poki_first_reach_bet');
const itchRoute = map.primaryFork?.find(route => route.id === 'itch_first_learning_bet');
requireValue(Boolean(poki && itchRoute) && map.primaryFork.length === 2, 'the two distribution options are incomplete');
requireValue(poki?.knownTerms?.preferredDealIsWebExclusive === true, 'Poki preferred web-exclusivity fact is missing');
requireValue(poki?.knownTerms?.indicativeExclusiveTermYears === 5, 'Poki indicative five-year term is missing');
requireValue(poki?.knownTerms?.nonExclusiveFlatFeeRouteExists === true, 'Poki non-exclusive route is missing');
requireValue(poki?.knownTerms?.actualAgreementRequiresReview === true, 'Poki agreement review gate is missing');
requireValue(itchRoute?.knownTerms?.pokiExclusiveUpsidePreservedAfterPublication === false, 'itch.io-first tradeoff is missing');
requireValue(itchRoute?.knownTerms?.firstPublicReleaseGetsOneMostRecentMoment === true, 'itch.io first-release discovery moment is missing');

for (const field of [
    'pokiAccessRequestAuthorized', 'youtubePlayablesInterestRequestAuthorized', 'itchPublicationAuthorized', 'newgroundsPublicationAuthorized',
    'communityPostingAuthorized', 'socialPublishingAuthorized', 'platformTermsAcceptanceAuthorized',
    'webExclusivityAcceptanceAuthorized', 'sdkIntegrationAuthorized', 'paidPromotionAuthorized',
    'directChildContactAuthorized', 'externalActionTaken'
]) requireValue(map.authority?.[field] === false, `authority.${field} must remain false`);

for (const route of map.secondaryRoutes || []) {
    requireValue(Number.isInteger(route.rank) && route.rank > 0, `${route.name || 'secondary route'} has no rank`);
    requireValue(Boolean(route.name && route.role && route.state && route.rule), `${route.name || 'secondary route'} is incomplete`);
}
requireValue((map.secondaryRoutes || []).some(route => route.name === 'Newgrounds' && route.rule.includes('public judgment')), 'Newgrounds judgment risk is missing');
requireValue((map.secondaryRoutes || []).some(route => route.name === 'YouTube Playables' && route.state === 'high_upside_separate_13_plus_candidate_required' && route.rule.includes('separate no-network build')), 'YouTube Playables preparation boundary is missing');
requireValue((map.secondaryRoutes || []).some(route => route.name.includes('r/WebGames') && route.rule.includes('Do not treat a community as a free advert board')), 'community participation boundary is missing');

const requiredSources = [
    'https://developers.poki.com/guide/revenue-deal-types',
    'https://developers.poki.com/guide/what-we-look-for',
    'https://developers.poki.com/guide/game-thumbnail',
    'https://itch.io/docs/creators/quality-guidelines',
    'https://itch.io/docs/creators/getting-indexed',
    'https://www.newgrounds.com/wiki/help-information/content-submission/games-and-movies',
    'https://developers.google.com/youtube/gaming/playables',
    'https://developers.google.com/youtube/gaming/playables/certification/requirements_privacydata',
    'https://developers.google.com/youtube/gaming/playables/certification/requirements_trustsafety'
];
for (const source of requiredSources) requireValue(map.sources?.includes(source), `required source is missing: ${source}`);
for (const phrase of ['What the Poki check found', '3.75 MB compressed', '41 MB compressed', 'not ready to submit, preserve the option', 'The important choice we nearly missed', 'For maximum upside', '0 of 4 approved moments', 'YouTube Playables', 'Why itch.io is still first if speed wins']) {
    requireValue(mapText.includes(phrase), `plain-language map is missing: ${phrase}`);
}
requireValue(decisions.includes('| D-018 |'), 'D-018 distribution-rights decision is missing');

if (failures.length) {
    console.error('Web distribution launch map is not safe or complete:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    recommendedFirstRequest: 'Poki access after quality gates',
    readyFallback: 'itch.io direct-play package',
    visualGate: `${map.currentTruth.approvedAuthenticVisualMoments}/${map.currentTruth.requiredAuthenticVisualMoments}`,
    externalActionAuthorized: false,
    rightsDecisionPreserved: true,
    measurementSnapshotToleranceBytes,
    secondaryRouteCount: map.secondaryRoutes.length
}, null, 2));
