#!/usr/bin/env node

const fs = require('fs');
const { paths, readJson, validate } = require('./validate-authentic-gameplay-social-kit.cjs');

const source = {
    manifest: readJson(paths.manifest),
    captions: readJson(paths.captions),
    release: readJson(paths.release),
    sourceManifest: readJson(paths.sourceManifest),
    pressAssets: readJson(paths.pressAssets),
    signal: readJson(paths.signal),
    pressSource: fs.readFileSync(paths.pressSource, 'utf8'),
    llms: fs.readFileSync(paths.llms, 'utf8')
};

function clone() {
    return structuredClone(source);
}

function expectFailure(name, mutate) {
    const values = clone();
    mutate(values);
    const result = validate(values);
    if (result.valid) throw new Error(`${name} was incorrectly accepted`);
}

const valid = validate(clone());
if (!valid.valid) throw new Error(`Valid social kit was rejected: ${valid.failures.join('; ')}`);

expectFailure('changed source fingerprint', values => { values.manifest.source.sha256 = '0'.repeat(64); });
expectFailure('changed output fingerprint', values => { values.manifest.assets[0].sha256 = '0'.repeat(64); });
expectFailure('cropped gameplay frame', values => { values.manifest.assets[1].fullGameplayFramePreserved = false; });
expectFailure('replacement audio', values => { values.manifest.assets[2].audio = 'aac'; });
expectFailure('missing edit disclosure', values => { values.manifest.assets[0].disclosure = 'Real gameplay.'; });
expectFailure('tracked play link', values => { values.captions.drafts[0].caption = values.captions.drafts[0].caption.replace('/playable-now/', '/playable-now/?utm_source=social'); });
expectFailure('companion wording', values => { values.captions.drafts[0].caption += ' Meet your companion.'; });
expectFailure('absolute uniqueness claim', values => { values.captions.drafts[1].caption += ' Every creature is unique.'; });
expectFailure('NASA endorsement', values => { values.captions.boundaries.nasaEndorsementClaimPermitted = true; });
expectFailure('child identifying detail', values => { values.captions.boundaries.childPhotoNameQuoteContactOrIdentifyingDetailPermitted = true; });
expectFailure('external social posting', values => { values.manifest.authority.externalSocialPublicationAuthorized = true; });
expectFailure('creator outreach sending', values => { values.captions.authority.creatorOutreachSendingAuthorized = true; });
expectFailure('paid promotion', values => { values.release.authority.paidPromotionAuthorized = true; });
expectFailure('invented production proof', values => { values.release.verification.productionUrlsVerified = true; });
expectFailure('missing public press section', values => { values.pressSource = values.pressSource.replace('id="real-gameplay-social-video"', ''); });
expectFailure('missing machine-readable discovery link', values => { values.llms = values.llms.replace('Authentic gameplay social video kit:', 'Hidden gameplay social video kit:'); });
expectFailure('missing Signal release', values => { values.signal.entries = values.signal.entries.filter(entry => entry.id !== 'SIGNAL-010'); });

console.log('Authentic gameplay social kit tests passed: valid release plus 17 media, claims, authority and discovery failures rejected.');
