#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { measureYouTubePlayablesCandidate } = require('./measure-youtube-playables-candidate.cjs');

const root = path.resolve(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readJson = relativePath => JSON.parse(read(relativePath));

function validateYouTubePlayablesReadiness(assessment, recorded, fresh, visualPlan, copy, packageJson, launchMap, opportunities, handoff) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const readiness = Object.fromEntries((assessment.readiness || []).map(item => [item.id, item]));
    const approvedVisuals = (visualPlan.requiredMoments || []).filter(moment => moment.currentState === 'approved').length;

    try { assert.deepStrictEqual(recorded, fresh); }
    catch { failures.push('recorded YouTube Playables measurement drifted from the current portable package'); }

    requireValue(assessment.id === 'YOUTUBE-PLAYABLES-READINESS-001', 'assessment identity is invalid');
    requireValue(assessment.state === 'high_upside_not_ready_for_interest_request', 'assessment overstates YouTube Playables readiness');
    requireValue(assessment.decision === 'prepare_separate_candidate_no_external_action', 'bounded preparation decision is missing');
    requireValue(assessment.measurementSource === 'docs/company/growth/youtube-playables-candidate-measurement.json', 'measurement source is missing');
    requireValue(recorded.target === 'youtube-playables-readiness-candidate-not-a-playables-build', 'measurement falsely claims a Playables build');
    requireValue(recorded.sourcePackage === 'dist-itch structural proxy', 'structural proxy boundary is missing');
    requireValue(recorded.firstLoad?.hardLimitMet === true && recorded.firstLoad?.recommendedLimitMet === true, 'first-load size evidence regressed');
    requireValue(recorded.package?.totalHardLimitMet === true, 'total package no longer fits the current hard limit');
    requireValue(recorded.package?.individualHardLimitMet === true, 'an individual file exceeds the current hard limit');
    requireValue(recorded.package?.fileCountLimitMet === true, 'file-count hard limit regressed');
    requireValue(recorded.package?.filesAbove512KiBRecommendation?.length > 0, 'individual-file optimization evidence is missing');
    requireValue(Object.values(recorded.platformIntegrationMarkers || {}).every(value => value === false), 'YouTube SDK marker appeared before access and approval');
    requireValue(recorded.incompatibleCurrentFeatureMarkers?.nativeShareFiles?.length > 0, 'current native-share incompatibility is missing');
    requireValue(recorded.incompatibleCurrentFeatureMarkers?.clipboardWriteFiles?.length > 0, 'current clipboard incompatibility is missing');
    requireValue(recorded.incompatibleCurrentFeatureMarkers?.localStorageFiles?.length > 0, 'current browser-save incompatibility is missing');
    for (const marker of ['api.nasa.gov', 'api.open-notify.org', 'netlify/functions']) {
        requireValue(recorded.externalServiceMarkers?.[marker]?.fileCount > 0, `external-call marker is missing: ${marker}`);
    }

    for (const [id, state] of Object.entries({
        'framework-and-package-shape': 'provisional_pass',
        'audience-fit': 'decision_and_professional_review_required',
        'no-external-calls': 'gap',
        'platform-saving-and-lifecycle': 'not_started_not_authorized',
        'disallowed-current-features': 'gap',
        'touch-resize-and-five-second-start': 'unverified',
        'rights-and-nasa-stem': 'review_required',
        'visual-click-proof': 'blocked',
        'official-channel-and-interest-form': 'missing_not_authorized'
    })) requireValue(readiness[id]?.state === state, `readiness state drifted: ${id}`);

    requireValue(approvedVisuals === 0 && visualPlan.approvalRule?.requiredApprovedMoments === 4, 'human visual gate is no longer 0 of 4; reassess deliberately');
    requireValue((readiness['visual-click-proof']?.evidence || '').includes('0 of 4'), 'visual blocker does not match the human register');
    requireValue((readiness['audience-fit']?.evidence || '').includes('13+'), '13+ audience restriction is missing');
    requireValue((readiness['no-external-calls']?.evidence || '').includes('forbids outside calls'), 'no-network requirement is missing');
    requireValue(assessment.gameDevelopmentHandoff?.length === 6, 'game-development handoff is incomplete');
    requireValue(assessment.gameDevelopmentHandoff?.some(item => item.includes('without changing the owned family game')), 'owned family-game boundary is missing');
    requireValue(assessment.gameDevelopmentHandoff?.some(item => item.includes('do not connect it before access and approval')), 'SDK authority boundary is missing');
    requireValue(assessment.interestRequestDraft?.state === 'incomplete_not_authorized', 'interest request overstates readiness');
    requireValue(assessment.interestRequestDraft?.contactEmail === null && assessment.interestRequestDraft?.officialYouTubeChannel === null, 'interest request invents account details');
    requireValue(assessment.interestRequestDraft?.submissionMade === false, 'interest form is falsely recorded as submitted');
    for (const field of ['officialChannelConfirmed', 'interestRequestAuthorized', 'gameUploadAuthorized', 'sdkIntegrationAuthorized', 'advertisingAuthorized', 'platformTermsAcceptanceAuthorized', 'audienceClassificationApproved', 'externalActionTaken']) {
        requireValue(assessment.authority?.[field] === false, `YouTube authority ${field} must remain false`);
    }

    for (const source of assessment.sources || []) requireValue(copy.includes(source), `plain-language assessment is missing source: ${source}`);
    for (const phrase of ['Why this is unusually interesting', 'The audience decision comes first', 'Why it is not ready', 'The separate edition we would need', 'Nothing in this assessment']) {
        requireValue(copy.includes(phrase), `plain-language assessment is missing: ${phrase}`);
    }
    requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(`${JSON.stringify(assessment)}\n${copy}`), 'unsupported creature-uniqueness promise is present');

    requireValue(packageJson.scripts?.['measure:youtube-playables'] === 'node scripts/company/measure-youtube-playables-candidate.cjs --write', 'repeatable YouTube measurement command is missing');
    requireValue(packageJson.scripts?.['validate:youtube-playables'] === 'node scripts/company/validate-youtube-playables-readiness.cjs', 'YouTube readiness command is missing');
    requireValue(packageJson.scripts?.['test:youtube-playables'] === 'node scripts/company/test-youtube-playables-readiness.cjs', 'YouTube safeguard command is missing');
    for (const command of ['npm run measure:youtube-playables', 'npm run validate:youtube-playables', 'npm run test:youtube-playables']) {
        requireValue(packageJson.scripts?.['build:itch']?.includes(command), `portable build does not run ${command}`);
    }
    requireValue(launchMap.secondaryRoutes?.some(route => route.name === 'YouTube Playables' && route.state === 'high_upside_separate_13_plus_candidate_required'), 'distribution map is missing YouTube Playables');
    requireValue(opportunities.opportunities?.some(item => item.id === 'OP-005' && item.organization === 'YouTube Playables' && item.outreachApproved === false), 'opportunity register is missing the gated YouTube route');
    for (const phrase of ['GDH-008', 'general-audience 13+', 'no outside calls', 'interest form is authorized']) {
        requireValue(handoff.includes(phrase), `game-development handoff is missing: ${phrase}`);
    }

    return failures;
}

function run() {
    const assessment = readJson('docs/company/growth/YOUTUBE_PLAYABLES_READINESS_ASSESSMENT.json');
    const recorded = readJson('docs/company/growth/youtube-playables-candidate-measurement.json');
    const fresh = measureYouTubePlayablesCandidate(path.join(root, 'dist-itch'));
    const visualPlan = readJson('docs/company/content/visual-launch-moments.json');
    const copy = read('docs/company/growth/YOUTUBE_PLAYABLES_READINESS_ASSESSMENT.md');
    const packageJson = readJson('package.json');
    const launchMap = readJson('docs/company/growth/WEB_DISTRIBUTION_LAUNCH_MAP.json');
    const opportunities = readJson('docs/company/commercial/opportunities.json');
    const handoff = read('docs/company/handoffs/GAME_DEVELOPMENT_HANDOFFS.md');
    const failures = validateYouTubePlayablesReadiness(assessment, recorded, fresh, visualPlan, copy, packageJson, launchMap, opportunities, handoff);
    console.log(JSON.stringify({
        valid: failures.length === 0,
        decision: assessment.decision,
        firstLoadGzipEstimateBytes: recorded.firstLoad?.gzipEstimateBytes,
        totalRawBytes: recorded.package?.rawBytes,
        fileCount: recorded.package?.fileCount,
        audienceFit: assessment.readiness?.find(item => item.id === 'audience-fit')?.state,
        visualGate: `${visualPlan.approvalRule?.approvedMomentCount}/${visualPlan.approvalRule?.requiredApprovedMoments}`,
        interestRequestAuthorized: assessment.authority?.interestRequestAuthorized,
        failures
    }, null, 2));
    if (failures.length) process.exit(1);
}

if (require.main === module) run();

module.exports = { validateYouTubePlayablesReadiness };
