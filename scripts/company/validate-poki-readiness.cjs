#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { measurePokiCandidate } = require('./measure-poki-candidate.cjs');

const root = path.resolve(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readJson = relativePath => JSON.parse(read(relativePath));

function validatePokiReadiness(assessment, recordedMeasurement, freshMeasurement, visualPlan, copy, packageJson, handoff) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const readiness = Object.fromEntries((assessment.readiness || []).map(item => [item.id, item]));
    const approvedVisuals = (visualPlan.requiredMoments || []).filter(moment => moment.currentState === 'approved').length;
    const requiredVisuals = visualPlan.approvalRule?.requiredApprovedMoments;

    try { assert.deepStrictEqual(recordedMeasurement, freshMeasurement); }
    catch { failures.push('recorded Poki package measurement drifted from the current portal package'); }

    requireValue(assessment.id === 'POKI-READINESS-001', 'Poki assessment identity is invalid');
    requireValue(assessment.state === 'promising_opening_not_ready_for_submission', 'Poki assessment overstates readiness');
    requireValue(assessment.decision === 'no_go_yet_preserve_option', 'Poki go/no-go decision is missing');
    requireValue(assessment.measurement?.source === 'docs/company/growth/poki-candidate-measurement.json', 'measurement source is missing');
    requireValue(assessment.measurement?.browserReview?.privateLocalReview === true, 'private browser review is missing');
    requireValue(assessment.measurement?.browserReview?.desktop?.viewport === '1280x720' && assessment.measurement.browserReview.desktop.canvasFilledViewport === true, 'desktop opening proof is missing');
    requireValue(assessment.measurement?.browserReview?.phone?.viewport === '390x844' && assessment.measurement.browserReview.phone.touchPromptSeen === true, 'phone opening proof is missing');
    requireValue(assessment.measurement?.browserReview?.tablet?.viewport === '820x1180' && assessment.measurement.browserReview.tablet.touchModeVerified === false, 'tablet touch limitation is not recorded');
    requireValue(/not worldwide loading speed/i.test(assessment.measurement?.browserReview?.limitation || ''), 'browser-review limitation is missing');

    requireValue(recordedMeasurement.target === 'poki-readiness-candidate-not-a-poki-build', 'measurement incorrectly claims a Poki build');
    requireValue(recordedMeasurement.firstLoad?.resourceCount === 18, 'opening dependency count drifted');
    requireValue(recordedMeasurement.firstLoad?.advisoryTargetMet === true, 'opening no longer fits the current advisory target');
    requireValue(recordedMeasurement.package?.advisoryTargetMet === false, 'full package gap is no longer reflected');
    requireValue(
        recordedMeasurement.categories?.cinematics?.fileCount >= 3 &&
        recordedMeasurement.categories.cinematics.gzipEstimateBytes > 8_000_000,
        'cinematic weight evidence is missing'
    );
    requireValue(recordedMeasurement.categories?.audio?.gzipEstimateBytes > 8_000_000, 'audio weight evidence is missing');
    for (const marker of ['api.nasa.gov', 'apod.nasa.gov', 'mars.nasa.gov', 'api.open-notify.org', 'netlify/functions']) {
        requireValue(recordedMeasurement.externalServiceMarkers?.[marker]?.fileCount > 0, `external-service marker is missing: ${marker}`);
    }
    requireValue(recordedMeasurement.pokiSdkMarkers?.PokiSDK === false && recordedMeasurement.pokiSdkMarkers?.officialPhaserPlugin === false, 'Poki SDK marker appeared before approval');

    for (const [id, state] of Object.entries({
        'opening-download': 'provisional_pass',
        'total-download': 'gap',
        'outside-services': 'gap',
        'incognito-saving': 'unverified',
        'tablet-touch-controls': 'unverified',
        'sdk-advertising-and-events': 'not_started_not_authorized',
        'visual-click-proof': 'blocked',
        'first-minute-player-fit': 'not_tested',
        'distribution-rights': 'decision_pending'
    })) requireValue(readiness[id]?.state === state, `readiness state drifted: ${id}`);
    requireValue((readiness['opening-download']?.evidence || '').includes('about 3.75 MB across 18 resources'), 'opening evidence does not state the measured result clearly');
    requireValue(approvedVisuals === 0 && requiredVisuals === 4, 'human visual gate is no longer 0 of 4; update the assessment deliberately');
    requireValue((readiness['visual-click-proof']?.evidence || '').includes('0 of 4'), 'visual blocker does not match the human register');

    requireValue(assessment.gameDevelopmentHandoff?.length === 6, 'game-development handoff is incomplete');
    requireValue(assessment.gameDevelopmentHandoff?.some(item => item.includes('Progressively load')), 'progressive-loading request is missing');
    requireValue(assessment.gameDevelopmentHandoff?.some(item => item.includes('do not install')), 'SDK non-authority is missing from the game handoff');
    requireValue(assessment.accessRequestDraft?.state === 'incomplete_not_authorized', 'access request draft overstates readiness');
    requireValue(assessment.accessRequestDraft?.contactEmail === null && assessment.accessRequestDraft?.thumbnailPath === null, 'access request invents an email or thumbnail');
    requireValue(assessment.accessRequestDraft?.submissionMade === false, 'Poki submission is falsely recorded');
    for (const field of ['pokiAccountAccessProvided', 'pokiAccessRequestAuthorized', 'gameUploadAuthorized', 'sdkIntegrationAuthorized', 'advertisingAuthorized', 'platformTermsAcceptanceAuthorized', 'webExclusivityAcceptanceAuthorized', 'externalActionTaken']) {
        requireValue(assessment.authority?.[field] === false, `Poki authority ${field} must remain false`);
    }

    for (const source of [
        'https://developers.poki.com/guide/what-we-look-for',
        'https://developers.poki.com/guide/requirements-quality',
        'https://developers.poki.com/guide/web-engine',
        'https://developers.poki.com/guide/game-thumbnail',
        'https://developers.poki.com/guide/sdk-phaser',
        'https://developers.poki.com/guide/revenue-deal-types'
    ]) requireValue(assessment.sources?.includes(source), `official Poki source is missing: ${source}`);
    for (const phrase of ['promising, but not ready to submit', 'The good news', 'Why we should not approach Poki yet', 'What the game team should do', 'The later Kevin decision', 'Nothing in this assessment']) {
        requireValue(copy.includes(phrase), `plain-language assessment is missing: ${phrase}`);
    }
    requireValue(!/\bcompanions?\b/i.test(`${JSON.stringify(assessment)}\n${copy}`), 'retired companion wording is present');
    requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(`${JSON.stringify(assessment)}\n${copy}`), 'unsupported creature-uniqueness promise is present');

    requireValue(packageJson.scripts?.['measure:poki'] === 'node scripts/company/measure-poki-candidate.cjs --write', 'repeatable Poki measurement command is missing');
    requireValue(packageJson.scripts?.['validate:poki-readiness'] === 'node scripts/company/validate-poki-readiness.cjs', 'Poki readiness validator command is missing');
    requireValue(packageJson.scripts?.['test:poki-readiness'] === 'node scripts/company/test-poki-readiness.cjs', 'Poki readiness safeguard command is missing');
    for (const command of ['npm run measure:poki', 'npm run validate:poki-readiness', 'npm run test:poki-readiness']) {
        requireValue(packageJson.scripts?.['build:itch']?.includes(command), `portal build does not run ${command}`);
    }
    for (const phrase of ['GDH-007', '3.75 MB', '28.1 MiB', 'no SDK, advertising, upload or platform request is authorized']) {
        requireValue(handoff.includes(phrase), `game-development handoff is missing: ${phrase}`);
    }

    return failures;
}

function run() {
    const assessment = readJson('docs/company/growth/POKI_READINESS_ASSESSMENT.json');
    const recordedMeasurement = readJson('docs/company/growth/poki-candidate-measurement.json');
    const freshMeasurement = measurePokiCandidate(path.join(root, 'dist-itch'));
    const visualPlan = readJson('docs/company/content/visual-launch-moments.json');
    const copy = read('docs/company/growth/POKI_READINESS_ASSESSMENT.md');
    const packageJson = readJson('package.json');
    const handoff = read('docs/company/handoffs/GAME_DEVELOPMENT_HANDOFFS.md');
    const failures = validatePokiReadiness(assessment, recordedMeasurement, freshMeasurement, visualPlan, copy, packageJson, handoff);
    console.log(JSON.stringify({
        valid: failures.length === 0,
        decision: assessment.decision,
        firstLoadGzipEstimateBytes: recordedMeasurement.firstLoad?.gzipEstimateBytes,
        firstLoadTargetMet: recordedMeasurement.firstLoad?.advisoryTargetMet,
        totalGzipEstimateBytes: recordedMeasurement.package?.gzipEstimateBytes,
        totalTargetMet: recordedMeasurement.package?.advisoryTargetMet,
        visualGate: `${visualPlan.approvalRule?.approvedMomentCount}/${visualPlan.approvalRule?.requiredApprovedMoments}`,
        pokiRequestAuthorized: assessment.authority?.pokiAccessRequestAuthorized,
        failures
    }, null, 2));
    if (failures.length) process.exit(1);
}

if (require.main === module) run();

module.exports = { validatePokiReadiness };
