#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { rewriteLocalAssetPaths } = require('./build-itch-package.cjs');
const { inspectItchPackage } = require('./validate-itch-package.cjs');

let cases = 0;
const rewritten = rewriteLocalAssetPaths('src="/assets/main.js";"/game/world.webp";https://mythicalvoid.com/marketing/hero.webp');
assert(rewritten.includes('src="./assets/main.js"'));
assert(rewritten.includes('"./game/world.webp"'));
assert(rewritten.includes('https://mythicalvoid.com/marketing/hero.webp'));
cases += 1;

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-itch-package-'));
    fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(root, 'game'), { recursive: true });
    fs.writeFileSync(path.join(root, 'assets', 'main.js'), 'const image="./game/world.webp";');
    fs.writeFileSync(path.join(root, 'game', 'world.webp'), 'world');
    fs.writeFileSync(path.join(root, 'index.html'), '<html data-distribution-target="itch"><head><meta name="robots" content="noindex, nofollow"></head><body><script src="./assets/main.js"></script></body></html>');
    fs.writeFileSync(path.join(root, 'itch-package-manifest.json'), JSON.stringify({
        target: 'itch.io-html5',
        directPlay: true,
        experience: { accountRequired: false, paymentRequired: false, optionalHostedAiPortraitsAndVideosPromised: false },
        releaseGates: { externalPublicationAuthorized: false, approvedAuthenticGameplayMoments: 0, requiredAuthenticGameplayMoments: 4 }
    }));
    return root;
}

const validRoot = fixture();
assert.strictEqual(inspectItchPackage(validRoot).valid, true);
fs.rmSync(validRoot, { recursive: true, force: true });
cases += 1;

for (const [relative, mutate, expected] of [
    ['index.html', source => source.replace('data-distribution-target="itch"', ''), 'direct-play itch marker'],
    ['assets/main.js', source => `${source}\nconst broken="/game/world.webp";`, 'root-only local asset path'],
    ['itch-package-manifest.json', source => source.replace('"externalPublicationAuthorized":false', '"externalPublicationAuthorized":true'), 'external publication must wait'],
    ['game/world.webp', () => null, 'referenced local asset is missing']
]) {
    const root = fixture();
    const target = path.join(root, relative);
    const source = fs.readFileSync(target, 'utf8');
    const value = mutate(source);
    if (value === null) fs.rmSync(target);
    else fs.writeFileSync(target, value);
    const result = inspectItchPackage(root);
    assert.strictEqual(result.valid, false);
    assert(result.failures.some(failure => failure.includes(expected)), `missing failure: ${expected}`);
    fs.rmSync(root, { recursive: true, force: true });
    cases += 1;
}

assert.strictEqual(cases, 6);
console.log('itch.io package evaluations passed (6 cases).');
