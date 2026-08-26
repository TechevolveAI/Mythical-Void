#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-social-preview-metadata.cjs');
const sourceManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/press/mythical-void-social-previews.json'), 'utf8'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-social-previews-'));

function prepareSite(name) {
    const site = path.join(temporary, name);
    fs.mkdirSync(site, { recursive: true });
    for (const page of sourceManifest.pages) {
        const htmlTarget = path.join(site, page.htmlPath);
        const imageTarget = path.join(site, page.imagePath);
        fs.mkdirSync(path.dirname(htmlTarget), { recursive: true });
        fs.mkdirSync(path.dirname(imageTarget), { recursive: true });
        fs.copyFileSync(path.join(root, page.htmlPath), htmlTarget);
        if (!fs.existsSync(imageTarget)) fs.copyFileSync(path.join(root, page.imagePath), imageTarget);
    }
    return site;
}

function run(name, mutateManifest = value => value, mutateSite = () => {}) {
    const manifest = structuredClone(sourceManifest);
    mutateManifest(manifest);
    const site = prepareSite(name);
    mutateSite(site, manifest);
    const manifestFile = path.join(temporary, `${name}.json`);
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    return spawnSync(process.execPath, [validator, manifestFile, site], { cwd: root, encoding: 'utf8' });
}

try {
    assert.strictEqual(run('valid').status, 0);
    assert.notStrictEqual(run('tracked-image', manifest => { manifest.pages[0].imageUrl += '?utm_source=test'; }).status, 0);
    assert.notStrictEqual(run('wrong-width', manifest => { manifest.pages[0].width = 1200; }).status, 0);
    assert.notStrictEqual(run('unsafe-generated-label', manifest => { manifest.pages.find(page => page.classification === 'ai_generated_marketing_illustration').disclosure = 'Beautiful game image.'; }).status, 0);
    assert.notStrictEqual(run('missing-nasa-boundary', manifest => { manifest.pages.find(page => /nasa/i.test(page.classification)).disclosure = 'NASA learning image.'; }).status, 0);
    assert.notStrictEqual(run('missing-founder-identity-boundary', manifest => { manifest.pages.find(page => /founder_story/i.test(page.classification)).disclosure = 'Founder artwork with a game image.'; }).status, 0);
    assert.notStrictEqual(run('missing-renderer-proof-boundary', manifest => { manifest.pages.find(page => page.route === '/creature-field-guide/').disclosure = 'A collection of creatures.'; }).status, 0);
    assert.notStrictEqual(run('hidden-press-limit', manifest => { manifest.knownLimitations = []; }).status, 0);
    assert.notStrictEqual(run('opened-social-authority', manifest => { manifest.authority.autonomousSocialPostingAuthorized = true; }).status, 0);
    assert.notStrictEqual(run('missing-twitter-alt', value => value, (site, manifest) => {
        const page = manifest.pages.find(item => item.route === '/story/');
        const file = path.join(site, page.htmlPath);
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\s*<meta name="twitter:image:alt"[^>]+>/, ''));
    }).status, 0);
    assert.notStrictEqual(run('companion-copy', value => value, (site, manifest) => {
        const page = manifest.pages.find(item => item.route === '/parents/');
        const file = path.join(site, page.htmlPath);
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('For Parents & Guardians | Mythical Void', 'AI companions for families'));
    }).status, 0);
    assert.notStrictEqual(run('missing-image', value => value, (site, manifest) => {
        const page = manifest.pages.find(item => item.route === '/nasa-space-science/');
        fs.rmSync(path.join(site, page.imagePath));
    }).status, 0);
    console.log('Social preview metadata safeguards passed (12 failure cases).');
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
