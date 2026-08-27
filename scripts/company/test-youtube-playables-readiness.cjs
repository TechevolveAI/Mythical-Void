#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateYouTubePlayablesReadiness } = require('./validate-youtube-playables-readiness.cjs');

const root = path.resolve(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readJson = relativePath => JSON.parse(read(relativePath));
const source = readJson('docs/company/growth/YOUTUBE_PLAYABLES_READINESS_ASSESSMENT.json');
const measurement = readJson('docs/company/growth/youtube-playables-candidate-measurement.json');
const visuals = readJson('docs/company/content/visual-launch-moments.json');
const copy = read('docs/company/growth/YOUTUBE_PLAYABLES_READINESS_ASSESSMENT.md');
const packageJson = readJson('package.json');
const launchMap = readJson('docs/company/growth/WEB_DISTRIBUTION_LAUNCH_MAP.json');
const opportunities = readJson('docs/company/commercial/opportunities.json');
const handoff = read('docs/company/handoffs/GAME_DEVELOPMENT_HANDOFFS.md');
const clone = value => JSON.parse(JSON.stringify(value));
let cases = 0;

function check(assessment = source, recorded = measurement, fresh = measurement, visualPlan = visuals) {
    return validateYouTubePlayablesReadiness(assessment, recorded, fresh, visualPlan, copy, packageJson, launchMap, opportunities, handoff);
}

function rejected(name, expected, change) {
    const assessment = clone(source);
    const recorded = clone(measurement);
    const fresh = clone(measurement);
    const visualPlan = clone(visuals);
    change(assessment, recorded, fresh, visualPlan);
    const failures = check(assessment, recorded, fresh, visualPlan);
    assert(failures.some(failure => failure.includes(expected)), `${name} should report ${expected}`);
    cases += 1;
}

assert.deepStrictEqual(check(), []);
cases += 1;
rejected('stale measurement', 'measurement drifted', (_a, recorded) => { recorded.package.rawBytes += 1; });
rejected('premature interest request', 'interestRequestAuthorized', assessment => { assessment.authority.interestRequestAuthorized = true; });
rejected('invented channel', 'invents account details', assessment => { assessment.interestRequestDraft.officialYouTubeChannel = 'https://youtube.example/not-real'; });
rejected('fake audience approval', 'audience-fit', assessment => { assessment.readiness.find(item => item.id === 'audience-fit').state = 'approved'; });
rejected('hidden external calls', 'no-external-calls', assessment => { assessment.readiness.find(item => item.id === 'no-external-calls').state = 'provisional_pass'; });
rejected('premature SDK', 'SDK marker appeared', (_a, recorded, fresh) => { recorded.platformIntegrationMarkers.ytgameNamespace = true; fresh.platformIntegrationMarkers.ytgameNamespace = true; });
rejected('fake visual approval', 'human visual gate', (_a, _r, _f, visualPlan) => { visualPlan.requiredMoments[0].currentState = 'approved'; });
rejected('invented submission', 'falsely recorded', assessment => { assessment.interestRequestDraft.submissionMade = true; });

assert.strictEqual(cases, 9);
console.log('YouTube Playables readiness safeguards passed (9 cases).');
