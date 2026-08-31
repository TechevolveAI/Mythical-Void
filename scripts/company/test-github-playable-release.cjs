#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const validator = path.join(__dirname, 'validate-github-playable-release.cjs');
const files = [
    'docs/company/growth/GITHUB_PLAYABLE_RELEASE.json',
    'docs/company/content/github-release/PLAYABLE_NOW_RELEASE.md'
];
let cases = 0;

function fixture(mutate) {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-github-release-'));
    for (const relative of files) {
        const target = path.join(fixtureRoot, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, relative), target);
    }
    if (mutate) mutate(fixtureRoot);
    return fixtureRoot;
}

function execute(fixtureRoot) {
    return spawnSync(process.execPath, [validator, '--root', fixtureRoot], { encoding: 'utf8', timeout: 30_000 });
}

function invalid(name, mutate, expected) {
    const fixtureRoot = fixture(mutate);
    try {
        const result = execute(fixtureRoot);
        assert.strictEqual(result.status, 1, `${name} should fail`);
        assert(result.stderr.includes(expected), `${name} should report ${expected}`);
        cases += 1;
    } finally {
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
}

const baseline = fixture();
try {
    const result = execute(baseline);
    assert.strictEqual(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.prerelease, true);
    assert.strictEqual(output.assetCount, 0);
    assert.strictEqual(output.satisfiedGateCount, 8);
    assert.strictEqual(output.publicationAuthorized, true);
    assert.strictEqual(output.publicationCompleted, false);
    assert.strictEqual(output.weakGameplayMediaPublished, false);
    cases += 1;
} finally {
    fs.rmSync(baseline, { recursive: true, force: true });
}

const mutateContract = (change) => fixtureRoot => {
    const target = path.join(fixtureRoot, files[0]);
    const contract = JSON.parse(fs.readFileSync(target, 'utf8'));
    change(contract);
    fs.writeFileSync(target, `${JSON.stringify(contract, null, 2)}\n`);
};
const mutateBody = replace => fixtureRoot => {
    const target = path.join(fixtureRoot, files[1]);
    fs.writeFileSync(target, replace(fs.readFileSync(target, 'utf8')));
};

invalid('stable release', mutateContract(value => { value.release.prerelease = false; value.release.latestRelease = true; }), 'honest public prerelease');
invalid('attached build', mutateContract(value => { value.release.assets = ['game.zip']; value.truth.downloadableBuildAttached = true; }), 'must not attach');
invalid('unapproved account', mutateContract(value => { value.authority.newAccountAuthorized = true; }), 'newAccountAuthorized');
invalid('premature completion', mutateContract(value => { value.publicationCompleted = true; }), 'publication boundary');
invalid('premature gate', mutateContract(value => { value.gates[8].satisfied = true; }), 'gate 9 state');
invalid('tracked link', mutateBody(source => source.replace('https://mythicalvoid.com/playable-now/', 'https://mythicalvoid.com/playable-now/?utm_source=github')), 'tracking parameters');
invalid('gameplay image', mutateBody(source => `${source}\n![Gameplay](gameplay.png)\n`), 'contains media');
invalid('NASA endorsement', mutateBody(source => source.replace('NASA does not make or endorse Mythical Void.', 'This is a NASA-powered game.')), 'missing: NASA does not');
invalid('uniqueness claim', mutateBody(source => source.replace('an alien creature shaped by a genetics system', 'a unique creature shaped by a genetics system')), 'unsupported or inflated');
invalid('missing family link', mutateBody(source => source.replace('[Read the family guide](https://mythicalvoid.com/parents/)', 'Family details coming soon')), 'missing: [Read the family guide]');
invalid('child exact age', mutateBody(source => source.replace('father-and-son project', 'father-and-son project with his nine-year-old son')), "exposes a child's exact age");

assert.strictEqual(cases, 12);
console.log('GitHub playable release safeguards passed (12 cases).');
