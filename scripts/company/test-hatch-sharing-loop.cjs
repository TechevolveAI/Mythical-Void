#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validator = path.join(__dirname, 'validate-hatch-sharing-loop.cjs');
const files = [
    'src/ui/LivingFormHandoff.js',
    'src/ui/HamburgerMenu.js',
    'src/utils/HatchChallengeShare.js',
    'src/site/storefront.js',
    'public/hatch-challenge/index.html',
    'public/marketing/mythical-void-hatch-challenge-card-v1.jpg',
    'docs/company/content/generated/hatch-challenge-invitation-release.json',
    'scripts/company/hatch-challenge-link-card.html'
];
let caseCount = 0;

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-hatch-sharing-'));
    for (const relative of files) {
        const target = path.join(root, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(repositoryRoot, relative), target);
    }
    return root;
}

function execute(root) {
    return spawnSync(process.execPath, [validator, '--root', root], { encoding: 'utf8', timeout: 30_000 });
}

function invalidText(relative, mutate, expected) {
    caseCount += 1;
    const root = fixture();
    try {
        const target = path.join(root, relative);
        fs.writeFileSync(target, mutate(fs.readFileSync(target, 'utf8')));
        const result = execute(root);
        assert.strictEqual(result.status, 1);
        assert(result.stderr.includes(expected), `missing failure: ${expected}\n${result.stderr}`);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

caseCount += 1;
const baselineRoot = fixture();
try {
    const baseline = execute(baselineRoot);
    assert.strictEqual(baseline.status, 0, baseline.stderr);
    const output = JSON.parse(baseline.stdout);
    assert.strictEqual(output.ownedBrandPreviewPrepared, true);
    assert.strictEqual(output.creatureDataShared, false);
    assert.strictEqual(output.externalPublicationAuthorized, false);
} finally {
    fs.rmSync(baselineRoot, { recursive: true, force: true });
}

invalidText(
    'docs/company/content/generated/hatch-challenge-invitation-release.json',
    source => source.replace('5030a304f7f81b5b7d6284a0100efaef35eec1ff534db0744adbf4de5a7662f7', '0'.repeat(64)),
    'Hatch Challenge preview fingerprint drifted'
);
invalidText(
    'public/hatch-challenge/index.html',
    source => source.replaceAll('mythical-void-hatch-challenge-card-v1.jpg', 'mythical-void-creature-universe-hero-v2.webp'),
    'Hatch Challenge Open Graph preview is missing'
);
invalidText(
    'scripts/company/hatch-challenge-link-card.html',
    source => source.replace('BRAND ART · NOT GAMEPLAY', 'A GREAT GAME'),
    'Hatch Challenge preview source is missing: BRAND ART · NOT GAMEPLAY'
);
invalidText(
    'docs/company/content/generated/hatch-challenge-invitation-release.json',
    source => source.replace('"gameplayUsed": false', '"gameplayUsed": true'),
    'Hatch Challenge preview must not contain gameplay or player/creature data'
);
invalidText(
    'docs/company/content/generated/hatch-challenge-invitation-release.json',
    source => source.replace('"state": "source_ready_for_owned_release"', '"state": "live_production_verified"'),
    'live Hatch Challenge preview is missing its production commit'
);

caseCount += 1;
const missingAssetRoot = fixture();
try {
    fs.unlinkSync(path.join(missingAssetRoot, 'public/marketing/mythical-void-hatch-challenge-card-v1.jpg'));
    const result = execute(missingAssetRoot);
    assert.strictEqual(result.status, 1);
    assert(result.stderr.includes('Hatch Challenge preview must be an actual 1200 x 630 JPEG'));
} finally {
    fs.rmSync(missingAssetRoot, { recursive: true, force: true });
}

assert.strictEqual(caseCount, 7);
console.log('Hatch sharing loop evaluations passed (7 cases).');
