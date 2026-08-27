#!/usr/bin/env node

const fs = require('fs');
const {
    defaultPath,
    validateVisualLaunchMoments
} = require('./validate-visual-launch-moments.cjs');

const source = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));

function expectFailure(label, mutate) {
    const candidate = structuredClone(source);
    mutate(candidate);
    const result = validateVisualLaunchMoments(candidate);
    if (result.valid) throw new Error(`${label} was incorrectly accepted`);
}

const valid = validateVisualLaunchMoments(structuredClone(source));
if (!valid.valid) {
    throw new Error(`Valid visual launch contract failed: ${valid.failures.join('; ')}`);
}

expectFailure('automated approval', value => {
    value.authority.automationMayApproveCandidates = true;
});
expectFailure('external publication', value => {
    value.authority.externalPublicationAuthorized = true;
});
expectFailure('public candidate directory', value => {
    value.candidateDirectory = 'public/press/gameplay/';
});
expectFailure('missing adult review', value => {
    value.authority.adultFrameReviewRequired = false;
});
expectFailure('missing phone visual bar', value => {
    value.sharedCaptureContract.minimumVisualBar = [];
});
expectFailure('premature review claim', value => {
    value.moments[0].reviewStatus = 'approved';
});
expectFailure('candidate without private run record', value => {
    delete value.latestPrivateCandidateRun;
});
expectFailure('candidate publication authorization', value => {
    value.latestPrivateCandidateRun.publicationAuthorized = true;
});
expectFailure('candidate renderer substitution', value => {
    value.latestPrivateCandidateRun.renderer = 'marketing_mock_renderer';
});
expectFailure('candidate editorial rejection removed', value => {
    delete value.latestPrivateCandidateRun.editorialScreening;
});
expectFailure('candidate source identity is malformed', value => {
    value.latestPrivateCandidateRun.sourceCommit = 'not-a-commit';
});
expectFailure('rejected work sent to Kevin', value => {
    value.latestScreening.kevinReviewRequested = true;
});
expectFailure('substituted non-observable evidence', value => {
    value.moments[0].requiredEvidence = [
        'copy_explains_the_action',
        'menu_is_visible',
        'background_looks_good'
    ];
});
expectFailure('caption-only help state', value => {
    value.moments[0].observableStateGate.result = 'dialogue_says_route_open';
});
expectFailure('unlinked strange discovery', value => {
    value.moments[2].observableStateGate.linkedActors = 0;
});
expectFailure('movement permits fallback frame', value => {
    value.moments[3].observableStateGate.fallbackFramesAllowed = 1;
});
expectFailure('unimplemented substitute state', value => {
    value.moments[2].playableState = 'concept_art_only';
});
expectFailure('nested public asset', value => {
    value.moments[0].candidateAssets.phone = '../public/creature.png';
});

console.log(
    'Visual launch contract tests passed: private staging, human review and publication authority remain closed.'
);
