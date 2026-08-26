#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    validateAiReadableDiscovery,
    staticPagePaths
} = require('./validate-ai-readable-discovery.cjs');

const root = path.resolve(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const source = {
    llms: read('public/llms.txt'),
    release: JSON.parse(read('docs/company/search/ai-readable-discovery-release-2026-08-26.json')),
    rootIndex: read('index.html'),
    staticPages: Object.fromEntries(staticPagePaths.map(file => [file, read(file)])),
    builderSources: {
        'scripts/company/build-public-signal-log.cjs': read('scripts/company/build-public-signal-log.cjs'),
        'scripts/company/build-creature-field-guide.cjs': read('scripts/company/build-creature-field-guide.cjs')
    },
    sitemap: read('public/sitemap.xml'),
    packageJson: JSON.parse(read('package.json'))
};
const clone = value => JSON.parse(JSON.stringify(value));
let cases = 0;

function rejected(name, expected, change) {
    const value = clone(source);
    change(value);
    const failures = validateAiReadableDiscovery(value);
    assert(failures.some(failure => failure.includes(expected)), `${name} should report ${expected}`);
    cases += 1;
}

assert.deepStrictEqual(validateAiReadableDiscovery(source), []);
cases += 1;
rejected('fake-standard', 'ratified standard', value => { value.release.convention.state = 'official_standard'; });
rejected('ranking-claim', 'searchRankingClaimAuthorized', value => { value.release.release.searchRankingClaimAuthorized = true; });
rejected('missing-nasa-boundary', 'NASA non-endorsement', value => { value.llms = value.llms.replace('NASA does not make or endorse Mythical Void.', 'NASA powers the game.'); });
rejected('invented-uniqueness', 'unsupported creature-uniqueness', value => { value.llms += '\nEvery creature is unique.\n'; });
rejected('retired-wording', 'retired companion wording', value => { value.llms += '\nCreature companion.\n'; });
rejected('missing-child-boundary', 'child identity boundary', value => { value.llms = value.llms.replace("Do not add the child's name, photograph, quotation, contact route or other identifying detail.", 'Tell the family story.'); });
rejected('missing-route', 'canonical sitemap route', value => { value.llms = value.llms.replace('](https://mythicalvoid.com/parents/)', '](https://example.com/parents/)'); });
rejected('stale-page-link', 'does not advertise', value => { value.staticPages['public/story/index.html'] = value.staticPages['public/story/index.html'].replace(/\s*<link rel="describedby"[^>]+>/, ''); });
rejected('builder-regression', 'will remove', value => { value.builderSources['scripts/company/build-public-signal-log.cjs'] = value.builderSources['scripts/company/build-public-signal-log.cjs'].replace(/\s*<link rel="describedby"[^>]+>/, ''); });
rejected('fake-citation', 'aiCitationClaimAuthorized', value => { value.release.release.aiCitationClaimAuthorized = true; });

assert.strictEqual(cases, 11);
console.log('AI-readable discovery safeguards passed (11 cases).');
