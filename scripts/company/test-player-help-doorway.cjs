const assert = require('assert');
const { loadCurrent, validatePlayerHelpDoorway } = require('./validate-player-help-doorway.cjs');

const source = loadCurrent();
assert.deepStrictEqual(validatePlayerHelpDoorway(source), [], 'current Help doorway should pass');

const mutations = [
    ['first objective removed', value => ({ ...value, helpHtml: value.helpHtml.replace('Recover the field kit', 'Keep exploring') })],
    ['save warning removed', value => ({ ...value, helpHtml: value.helpHtml.replace('do not clear browser data', 'clear browser data') })],
    ['false email channel added', value => ({ ...value, helpHtml: `${value.helpHtml}<a href="mailto:help@example.com">Email</a>` })],
    ['false service promise added', value => ({ ...value, helpHtml: `${value.helpHtml}<p>Our 24/7 support team will respond.</p>` })],
    ['trusted adult route removed', value => ({ ...value, helpHtml: value.helpHtml.replace('parent, guardian or another trusted adult', 'someone') })],
    ['homepage Help link removed', value => ({ ...value, storefront: value.storefront.replace('href="/help/">Help</a>', 'href="#">More</a>') })],
    ['sitemap entry removed', value => ({ ...value, sitemap: value.sitemap.replace('<loc>https://mythicalvoid.com/help/</loc>', '<loc>https://mythicalvoid.com/removed/</loc>') })]
];

for (const [name, mutate] of mutations) {
    assert.ok(validatePlayerHelpDoorway(mutate(source)).length > 0, `${name} should fail validation`);
}

console.log(`Player Help doorway mutation tests passed (${mutations.length}).`);
