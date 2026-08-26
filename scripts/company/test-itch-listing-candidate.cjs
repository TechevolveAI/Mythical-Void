#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateItchListing } = require('./validate-itch-listing-candidate.cjs');

const root = path.resolve(__dirname, '..', '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/growth/ITCH_RELEASE_CANDIDATE.json'), 'utf8'));
const visualPlan = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/visual-launch-moments.json'), 'utf8'));
const copy = fs.readFileSync(path.join(root, 'docs/company/growth/ITCH_RELEASE_CANDIDATE.md'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
let cases = 0;

function valid(candidate = source, plan = visualPlan, text = copy) {
    return validateItchListing(candidate, plan, text);
}

function rejected(name, expectedFailure, change) {
    const candidate = clone(source);
    const plan = clone(visualPlan);
    const result = change(candidate, plan);
    const failures = valid(candidate, plan, result?.copy || copy);
    assert(failures.length > 0, `${name} should fail`);
    assert(failures.some(failure => failure.includes(expectedFailure)), `${name} should report ${expectedFailure}`);
    cases += 1;
}

assert.deepStrictEqual(valid(), []);
cases += 1;

rejected('external publication', 'boundary externalPublicationAuthorized', candidate => { candidate.boundaries.externalPublicationAuthorized = true; });
rejected('fake approval count', 'approved visual count', candidate => { candidate.visualGate.approvedMoments = 4; });
rejected('unapproved screenshot', 'attached an unapproved image', candidate => { candidate.visualGate.screenshotSlots[0].assetPath = '/marketing/imagined-art.webp'; });
rejected('missing required moment', 'one distinct screenshot slot', candidate => { candidate.visualGate.screenshotSlots.pop(); });
rejected('retired wording', 'retired companion wording', candidate => { candidate.listing.shortDescription = 'Find your AI companion.'; });
rejected('unsupported uniqueness', 'unsupported creature-uniqueness promise', candidate => { candidate.listing.playerPromise = 'Every creature is unique.'; });
rejected('unverified phone claim', 'mobile-friendly', candidate => { candidate.listing.mobileFriendlyClaimApproved = true; });
rejected('invented account access', 'invents an account or page', candidate => { candidate.reviewGate.itchAccountAccessProvided = true; });
rejected('page created without authority', 'invents an account or page', candidate => { candidate.reviewGate.pageCreated = true; });

assert.strictEqual(cases, 10);
console.log('itch.io listing safeguards passed (10 cases).');
