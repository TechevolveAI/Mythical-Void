#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const validator = path.join(__dirname, 'validate-creature-concept-artist-brief.cjs');
const files = [
    'docs/company/product/CREATURE_CONCEPT_ARTIST_BRIEF.md',
    'docs/company/product/creature-concept-artist-brief.json',
    'docs/company/operations/founder-control-page.json',
    'package.json'
];
let cases = 0;

function fixture(mutate) {
    const targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-creature-art-brief-'));
    for (const relative of files) {
        const target = path.join(targetRoot, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, relative), target);
    }
    if (mutate) mutate(targetRoot);
    return targetRoot;
}

function execute(targetRoot) {
    return spawnSync(process.execPath, [validator, '--root', targetRoot], { encoding: 'utf8', timeout: 30_000 });
}

function mutateContract(name, change, expected) {
    const targetRoot = fixture(fixtureRoot => {
        const target = path.join(fixtureRoot, 'docs/company/product/creature-concept-artist-brief.json');
        const contract = JSON.parse(fs.readFileSync(target, 'utf8'));
        change(contract);
        fs.writeFileSync(target, `${JSON.stringify(contract, null, 2)}\n`);
    });
    try {
        const result = execute(targetRoot);
        assert.strictEqual(result.status, 1, `${name} should fail`);
        assert(result.stderr.includes(expected), `${name} should report ${expected}`);
        cases += 1;
    } finally {
        fs.rmSync(targetRoot, { recursive: true, force: true });
    }
}

const baseline = fixture();
try {
    const result = execute(baseline);
    assert.strictEqual(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.firstDeliverySilhouettes, 12);
    assert.strictEqual(output.automationMayApproveVisualQuality, false);
    assert.strictEqual(output.externalAuthorityGranted, false);
    cases += 1;
} finally {
    fs.rmSync(baseline, { recursive: true, force: true });
}

mutateContract('too few silhouettes', value => { value.firstDelivery.totalSilhouettes = 3; }, 'twelve silhouettes');
mutateContract('skip phone proof', value => { value.firstDelivery.phoneProofWidthPx = 256; }, 'phone-size label-free');
mutateContract('automation approval', value => { value.humanApproval.automationMayApproveVisualQuality = true; }, 'automation visual boundary');
mutateContract('skip Kevin selection', value => { value.secondDelivery.startsOnlyAfterKevinSelects = false; }, 'behind Kevin selection');
mutateContract('artist contact', value => { value.authority.artistContactAuthorized = true; }, 'artistContactAuthorized');
mutateContract('spend', value => { value.authority.spendAuthorized = true; }, 'spendAuthorized');
mutateContract('generation', value => { value.authority.imageGenerationAuthorized = true; }, 'imageGenerationAuthorized');
mutateContract('runtime integration', value => { value.authority.runtimeIntegrationAuthorized = true; }, 'runtimeIntegrationAuthorized');
mutateContract('publication', value => { value.authority.publicationAuthorized = true; }, 'publicationAuthorized');
mutateContract('unlicensed reference', value => { value.rights.unlicensedReferenceAllowed = true; }, 'unlicensedReferenceAllowed');

const wordingRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'docs/company/product/CREATURE_CONCEPT_ARTIST_BRIEF.md');
    fs.appendFileSync(target, '\nBuild an AI companion.\n');
});
try {
    const result = execute(wordingRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('outdated companion wording'));
    cases += 1;
} finally {
    fs.rmSync(wordingRoot, { recursive: true, force: true });
}

const privacyRoot = fixture(fixtureRoot => {
    const target = path.join(fixtureRoot, 'docs/company/product/CREATURE_CONCEPT_ARTIST_BRIEF.md');
    fs.appendFileSync(target, '\nMade with a nine-year-old child.\n');
});
try {
    const result = execute(privacyRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes("child's exact age"));
    cases += 1;
} finally {
    fs.rmSync(privacyRoot, { recursive: true, force: true });
}

assert.strictEqual(cases, 13);
console.log('Creature concept artist brief safeguards passed (13 cases).');

