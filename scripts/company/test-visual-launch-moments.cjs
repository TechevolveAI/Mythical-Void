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
expectFailure('substituted non-observable evidence', value => {
    value.moments[0].requiredEvidence = [
        'copy_explains_the_action',
        'menu_is_visible',
        'background_looks_good'
    ];
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
