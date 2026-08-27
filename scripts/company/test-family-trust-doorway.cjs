const assert = require('assert');
const { loadCurrent, validateFamilyTrustDoorway } = require('./validate-family-trust-doorway.cjs');

const source = loadCurrent();

assert.deepStrictEqual(validateFamilyTrustDoorway(source), [], 'current family trust doorway should pass');

const mutations = [
    {
        name: 'missing visible other-player boundary',
        mutate: value => ({
            ...value,
            parentsHtml: value.parentsHtml.replace('No public profiles or chat with other players.', 'Single-player adventure.')
        })
    },
    {
        name: 'advertising host introduced',
        mutate: value => ({ ...value, runtimeSources: `${value.runtimeSources}\nhttps://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js` })
    },
    {
        name: 'other-player claim removed from registry',
        mutate: value => ({ ...value, claimsText: value.claimsText.replace('"id": "CL-015"', '"id": "REMOVED"') })
    },
    {
        name: 'creature dialogue distinction removed',
        mutate: value => ({
            ...value,
            playableHtml: value.playableHtml.replaceAll('not a conversation with another person', 'no chat')
        })
    }
];

for (const mutation of mutations) {
    const failures = validateFamilyTrustDoorway(mutation.mutate(source));
    assert.ok(failures.length > 0, `${mutation.name} should fail validation`);
}

console.log(`Family trust doorway mutation tests passed (${mutations.length}).`);

