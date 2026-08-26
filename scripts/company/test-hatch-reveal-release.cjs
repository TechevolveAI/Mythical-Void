#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-hatch-reveal-release.cjs');
const source = {
    release: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/generated/hatch-reveal-proof-release.json'), 'utf8')),
    playable: fs.readFileSync(path.join(root, 'public/playable-now/index.html'), 'utf8'),
    storefront: fs.readFileSync(path.join(root, 'src/site/storefront.js'), 'utf8'),
    signal: JSON.parse(fs.readFileSync(path.join(root, 'public/updates/releases.json'), 'utf8')),
    pressAssets: JSON.parse(fs.readFileSync(path.join(root, 'public/press/mythical-void-press-assets.json'), 'utf8')),
    llms: fs.readFileSync(path.join(root, 'public/llms.txt'), 'utf8'),
    manifest: JSON.parse(fs.readFileSync(path.join(root, 'public/press/gameplay/manifest.json'), 'utf8'))
};
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-hatch-release-'));

function run(name, mutate = () => {}) {
    const value = structuredClone(source);
    mutate(value);
    const paths = {
        release: path.join(temp, `${name}-release.json`),
        playable: path.join(temp, `${name}-playable.html`),
        storefront: path.join(temp, `${name}-storefront.js`),
        signal: path.join(temp, `${name}-signal.json`),
        pressAssets: path.join(temp, `${name}-press.json`),
        llms: path.join(temp, `${name}-llms.txt`),
        manifest: path.join(temp, `${name}-manifest.json`)
    };
    fs.writeFileSync(paths.release, JSON.stringify(value.release));
    fs.writeFileSync(paths.playable, value.playable);
    fs.writeFileSync(paths.storefront, value.storefront);
    fs.writeFileSync(paths.signal, JSON.stringify(value.signal));
    fs.writeFileSync(paths.pressAssets, JSON.stringify(value.pressAssets));
    fs.writeFileSync(paths.llms, value.llms);
    fs.writeFileSync(paths.manifest, JSON.stringify(value.manifest));
    return spawnSync(process.execPath, [validator, paths.release, paths.playable, paths.storefront, paths.signal, paths.pressAssets, paths.llms, paths.manifest], { cwd: root, encoding: 'utf8' });
}

let checks = 0;
try {
    if (run('valid').status !== 0) throw new Error('valid hatch release was rejected');
    checks += 1;
    const failures = [
        ['external-social-authority', value => { value.release.authority.externalSocialPublicationAuthorized = true; }],
        ['invented-production-proof', value => { value.release.verification.productionUrlVerified = true; }],
        ['absolute-uniqueness', value => { value.playable += ' Every creature is unique.'; }],
        ['retired-wording', value => { value.playable += ' Meet your companion.'; }],
        ['generated-art-substitution', value => { value.release.capture.generatedMarketingArtworkUsed = true; }],
        ['player-identity', value => { value.release.capture.playerIdentityUsed = true; }],
        ['wrong-fingerprint', value => { value.release.capture.sha256 = '0'.repeat(64); }],
        ['wrong-source-commit', value => { value.manifest.captures.find(item => item.id === 'GP-013').sourceCommit = '0'.repeat(40); }],
        ['two-actions', value => { value.release.presentation.visibleNextActionCount = 2; }],
        ['small-phone-creature', value => { value.release.presentation.creatureBoundsPhone.width = 120; }],
        ['failed-phone-review', value => { value.release.verification.phoneVisualReviewPassed = false; }],
        ['missing-playable-replacement', value => { value.playable = value.playable.replaceAll('/press/gameplay/real-creature-showcase/real-creature-showcase-wide.png', '/missing.png'); }],
        ['withdrawn-press-feature-exposed', value => { value.storefront += '<div id="real-creature-hatch"><img src="/press/gameplay/creature-cosmic-egg-reveal.png"></div>'; }],
        ['missing-press-record', value => { value.pressAssets.assets = value.pressAssets.assets.filter(item => !item.url.endsWith('creature-cosmic-egg-reveal.png')); }],
        ['withdrawn-machine-link-exposed', value => { value.llms += '\nSee one real creature generated and revealed by the running game: https://mythicalvoid.com/press/#real-creature-hatch'; }],
        ['withdrawn-signal-exposed', value => { value.signal.entries.push({ id: 'SIGNAL-012', status: 'live' }); }],
        ['owned-site-publication-reopened', value => { value.release.authority.ownedWebsitePublicationAuthorized = true; }],
        ['human-rejection-removed', value => { delete value.release.currentHumanReview; }],
        ['mock-classification', value => { value.manifest.captures.find(item => item.id === 'GP-013').classification = 'generated_mockup'; }]
    ];
    for (const [name, mutate] of failures) {
        if (run(name, mutate).status === 0) throw new Error(`${name} mutation was accepted`);
        checks += 1;
    }
    console.log(JSON.stringify({ valid: true, adversarialChecksPassed: checks }, null, 2));
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
