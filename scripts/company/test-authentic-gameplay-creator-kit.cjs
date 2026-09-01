#!/usr/bin/env node

const { loadValues, validate } = require('./validate-authentic-gameplay-creator-kit.cjs');

const source = loadValues();

function clone() {
    const values = structuredClone(source);
    for (const field of ['archiveBuffer', 'captionsBuffer', 'emblemBuffer', 'factSheetBuffer']) values[field] = Buffer.from(values[field]);
    return values;
}

function expectFailure(name, mutate) {
    const values = clone();
    mutate(values);
    const result = validate(values);
    if (result.valid) throw new Error(`${name} was incorrectly accepted`);
}

const valid = validate(clone());
if (!valid.valid) throw new Error(`Valid creator kit was rejected: ${valid.failures.join('; ')}`);

expectFailure('truncated archive', values => { values.archiveBuffer = values.archiveBuffer.subarray(0, values.archiveBuffer.length - 20); });
expectFailure('wrong archive fingerprint', values => { values.manifest.archive.sha256 = '0'.repeat(64); });
expectFailure('wrong archive size', values => { values.manifest.archive.bytes += 1; });
expectFailure('missing package path', values => { values.manifest.contents.pop(); });
expectFailure('wrong video source record', values => { values.socialManifest.assets[0].sha256 = '0'.repeat(64); });
expectFailure('wrong poster source record', values => { values.socialManifest.assets[1].posterSha256 = '0'.repeat(64); });
expectFailure('changed public captions', values => { values.captionsBuffer = Buffer.from('changed captions'); });
expectFailure('changed public emblem', values => { values.emblemBuffer = Buffer.from('changed emblem'); });
expectFailure('changed public fact sheet', values => { values.factSheetBuffer = Buffer.from('changed facts'); });
expectFailure('companion wording', values => { values.release.purpose += ' An AI companion.'; });
expectFailure('absolute uniqueness claim', values => { values.release.purpose += ' Every creature is unique.'; });
expectFailure('tracking parameter', values => { values.manifest.cleanPlayUrl += '?utm_source=creator'; });
expectFailure('official posting opened', values => { values.manifest.authority.officialMythicalVoidSocialPublicationAuthorized = true; });
expectFailure('Kevin approval removed', values => { values.release.authority.kevinApprovalRequiredBeforeOfficialPublication = false; });
expectFailure('creator sending opened', values => { values.manifest.authority.creatorOutreachSendingAuthorized = true; });
expectFailure('paid promotion opened', values => { values.manifest.authority.paidPromotionAuthorized = true; });
expectFailure('public replies opened', values => { values.manifest.authority.publicRepliesAuthorized = true; });
expectFailure('invented external action', values => { values.release.authority.externalActionPerformed = true; });
expectFailure('withdrawn press room download exposed again', values => { values.pressSource += '<div id="creator-download-kit"></div>'; });
expectFailure('withdrawn machine discovery exposed again', values => { values.llms += '\nOne-download creator kit: https://mythicalvoid.com/press/creator-kit/mythical-void-authentic-gameplay-creator-kit.zip'; });
expectFailure('missing press asset record', values => { delete values.pressAssets.creatorDownloadKit; });
expectFailure('withdrawn Signal entry exposed again', values => { values.signal.entries.push({ id: 'UPDATE-011', status: 'live' }); });
expectFailure('missing phone visual proof', values => { values.release.verification.phoneHorizontalOverflowObserved = true; });
expectFailure('invented production proof', values => { values.release.verification.productionUrlVerified = true; });

console.log('Withdrawn gameplay creator kit tests passed: exact archive retained and 24 integrity, claims, safeguarding, authority and accidental re-publication failures rejected.');
