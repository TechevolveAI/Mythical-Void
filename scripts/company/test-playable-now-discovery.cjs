#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-playable-now-discovery.cjs');
const sourcePage = fs.readFileSync(path.join(root, 'public/playable-now/index.html'), 'utf8');
const sourceRelease = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/generated/playable-now-discovery-release.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-playable-now-'));

function run(name, page = sourcePage, release = sourceRelease) {
    const pagePath = path.join(temp, `${name}.html`);
    const releasePath = path.join(temp, `${name}.json`);
    fs.writeFileSync(pagePath, page);
    fs.writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`);
    return spawnSync(process.execPath, [validator, pagePath, releasePath], { cwd: root, encoding: 'utf8' });
}

let checks = 0;
try {
    if (run('valid').status !== 0) throw new Error('valid playable-now release was rejected');
    checks += 1;
    for (const [name, replace] of [
        ['withdrawn-video-restored', page => page.replace('</main>', '<video src="/press/gameplay-video/mythical-forest-authentic-gameplay.mp4"></video></main>')],
        ['companion-wording', page => page.replace('alien creature', 'AI companion')],
        ['uniqueness-promise', page => page.replace('</main>', '<p>Every creature is unique.</p></main>')],
        ['tracked-play', page => page.replace('href="/play/"', 'href="/play/?utm_source=test"')],
        ['external-play', page => page.replaceAll('href="/play/"', 'href="https://example.com/play"')],
        ['missing-early-access', page => page.replaceAll('early-access', 'current').replaceAll('Early access', 'Available')],
        ['nasa-endorsement', page => page.replace('NASA does not endorse Mythical Void.', 'NASA endorses Mythical Void.')],
        ['contact-form', page => page.replace('</main>', '<form><input name="email"></form></main>')],
        ['stale-sharing-script', page => page.replace('/discovery.js?v=20260826-intent-sharing', '/discovery.js?v=20260826-intent')],
        ['missing-art-boundary', page => page.replace('not gameplay', 'gameplay')],
        ['invalid-structured-data', page => page.replace('"@type": "VideoGame"', '"@type": VideoGame')]
    ]) {
        if (run(name, replace(sourcePage)).status === 0) throw new Error(`${name} was accepted`);
        checks += 1;
    }
    for (const [name, mutate] of [
        ['wrong-page-proof', release => { release.page.sha256 = '0'.repeat(64); }],
        ['external-social-authority', release => { release.authority.externalSocialPublicationAuthorized = true; }],
        ['email-collection', release => { release.privacy.emailSignupEnabled = true; }],
        ['invented-production-proof', release => { release.verification.productionCommit = '0'.repeat(40); }]
    ]) {
        const release = structuredClone(sourceRelease);
        mutate(release);
        if (run(name, sourcePage, release).status === 0) throw new Error(`${name} was accepted`);
        checks += 1;
    }
    console.log(JSON.stringify({ valid: true, adversarialChecksPassed: checks }, null, 2));
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
