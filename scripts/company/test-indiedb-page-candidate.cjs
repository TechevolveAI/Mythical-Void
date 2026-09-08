#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateIndieDbPage } = require('./validate-indiedb-page-candidate.cjs');

const root = path.resolve(__dirname, '..', '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/growth/INDIEDB_PAGE_CANDIDATE_2026-09-08.json'), 'utf8'));
const copy = fs.readFileSync(path.join(root, 'docs/company/growth/INDIEDB_PAGE_CANDIDATE_2026-09-08.md'), 'utf8');
const visualRegister = JSON.parse(fs.readFileSync(path.join(root, 'public/press/visual-publication-register.json'), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
let cases = 0;

function valid(candidate = source, text = copy, register = visualRegister) {
    return validateIndieDbPage(candidate, text, register, { root });
}

function rejected(name, expectedFailure, change) {
    const candidate = clone(source);
    const register = clone(visualRegister);
    const result = change(candidate, register);
    const failures = valid(candidate, result?.copy || copy, register);
    assert(failures.length > 0, `${name} should fail`);
    assert(failures.some(failure => failure.includes(expectedFailure)), `${name} should report ${expectedFailure}`);
    cases += 1;
}

assert.deepStrictEqual(valid(), []);
cases += 1;

rejected('invented player count', 'audience or player numbers', candidate => { candidate.platform.playerCountClaimed = true; });
rejected('tracking link', 'clean owned links', candidate => { candidate.listing.playUrl += '?utm_source=indiedb'; });
rejected('retired wording', 'retired companion wording', candidate => { candidate.listing.shortDescription = 'Meet your AI companion in the Void.'; });
rejected('vague signal wording', 'vague signal wording', candidate => { candidate.listing.opening = 'Answer a mysterious signal.'; });
rejected('NASA endorsement', 'NASA non-endorsement', candidate => { candidate.listing.nasaDisclosure = 'Built with NASA.'; });
rejected('fake screenshot', 'unapproved gameplay media', candidate => { candidate.mediaGate.screenshotsAttached = 1; });
rejected('unapproved brand asset', 'not approved in the public visual register', (candidate, register) => { register.publicApproved = register.publicApproved.filter(item => item.path !== '/marketing/mythical-void-emblem-v3.png'); });
rejected('signed-in form guessed', 'falsely confirmed', candidate => { candidate.signedInFormReview.headerImageDimensionsConfirmed = true; });
rejected('terms accepted', 'terms acceptance', candidate => { candidate.termsReview.accepted = true; });
rejected('broad licence hidden', 'broad content licence', candidate => { candidate.termsReview.summaryForFounderReview = candidate.termsReview.summaryForFounderReview.filter(item => !/broad worldwide/i.test(item)); });
rejected('page saved', 'release gate pageSaved', candidate => { candidate.releaseGate.pageSaved = true; });
rejected('publishing authority', 'authority.externalPublishingAuthorized', candidate => { candidate.authority.externalPublishingAuthorized = true; });
rejected('child account', 'authority.childAccountAuthorized', candidate => { candidate.authority.childAccountAuthorized = true; });
rejected('invented popularity', 'invented popularity claim', candidate => { candidate.listing.studioStory += ' Millions of players are waiting.'; });

assert.strictEqual(cases, 15);
console.log('IndieDB page safeguards passed (15 cases).');
