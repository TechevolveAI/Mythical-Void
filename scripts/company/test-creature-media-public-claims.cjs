#!/usr/bin/env node

const assert = require('assert');
const {
    loadCurrent,
    validateCreatureMediaClaims
} = require('./validate-creature-media-public-claims.cjs');

const source = loadCurrent();
let cases = 0;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function rejected(name, expected, change) {
    const input = clone(source);
    change(input);
    const failures = validateCreatureMediaClaims(input);
    assert(failures.some(failure => failure.includes(expected)), `${name} should report ${expected}`);
    cases += 1;
}

assert.deepStrictEqual(validateCreatureMediaClaims(source), []);
cases += 1;
rejected('old-public-restriction', 'stale creature-media wording', input => {
    input.controlledText['public/parents/index.html'] += ' Available only with adult approval.';
});
rejected('missing-youngest-band', 'age_under_13', input => {
    input.runtimePrivacy = input.runtimePrivacy.replace("    'age_under_13',\n", '');
});
rejected('missing-legal-boundary', 'legal child and age-range boundary', input => {
    input.legal = input.legal.replace('model requests contain no child or player information', 'model requests are made');
});
rejected('missing-homepage-fallback', 'homepage does not explain the gameplay fallback', input => {
    input.controlledText['src/site/storefront.js'] = input.controlledText['src/site/storefront.js'].replace('main adventure keeps working if the extra media is slow or unavailable', 'extra media is always available');
});
rejected('wrong-claim-status', 'CL-009', input => {
    input.claims.claims.find(item => item.id === 'CL-009').status = 'restricted_recheck';
});
rejected('wrong-proof-status', 'TECH-003', input => {
    input.technology.claims.find(item => item.id === 'TECH-003').publicStatus = 'approved_with_age_gated_language';
});
rejected('missing-production-proof', 'production-backed feature evidence', input => {
    input.releases.entries.find(item => item.id === 'UPDATE-031').releaseProof.villageHeartRefreshObserved = false;
});
rejected('player-data-overclaim', 'claims player personal data was sent', input => {
    input.releases.entries.find(item => item.id === 'UPDATE-031').releaseProof.playerPersonalDataSentToModel = true;
});
rejected('visual-overclaim', 'overstates visual approval', input => {
    input.releases.entries.find(item => item.id === 'UPDATE-031').releaseProof.gameplayVisualApproved = true;
});

assert.strictEqual(cases, 10);
console.log('Creature-media public-claim safeguards passed (10 cases).');
