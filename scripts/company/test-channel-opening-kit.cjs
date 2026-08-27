#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validator = path.join(__dirname, 'validate-channel-opening-kit.cjs');
const sourcePath = 'docs/company/content/channel-launch/CHANNEL_OPENING_KIT_2026-08-27.json';
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, sourcePath), 'utf8'));
let checks = 0;

function rejected(name, expected, mutate) {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-channel-kit-'));
    for (const relative of [
        sourcePath,
        'docs/company/content/channel-launch/CHANNEL_OPENING_KIT_2026-08-27.md',
        'docs/company/content/channels.json',
        'docs/company/content/campaigns/playable-now-launch.json',
        'public/marketing/mythical-void-mark-512.png',
        'public/marketing/mythical-void-creature-universe-hero-v2.webp'
    ]) {
        const target = path.join(sandbox, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(repositoryRoot, relative), target);
    }
    const altered = structuredClone(source);
    mutate(altered);
    fs.writeFileSync(path.join(sandbox, sourcePath), `${JSON.stringify(altered, null, 2)}\n`);
    const result = spawnSync(process.execPath, [validator, '--root', sandbox], { encoding: 'utf8' });
    assert.notStrictEqual(result.status, 0, `${name} should fail`);
    assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(expected, 'i'), `${name} should explain the failure`);
    fs.rmSync(sandbox, { recursive: true, force: true });
    checks += 1;
}

rejected('fake LinkedIn handle verification', 'availability must not be assumed', value => {
    value.channels.find(channel => channel.platform === 'LinkedIn').publicIdentity.publicUrlAvailabilityVerified = true;
});
rejected('premature YouTube publication', 'publication must remain closed', value => {
    value.channels.find(channel => channel.platform === 'YouTube').releaseGate.videoPublicationReady = true;
});
rejected('weak visual gate bypass', 'visual gate must remain 0 of 4', value => {
    value.channels.find(channel => channel.platform === 'YouTube').releaseGate.approvedAuthenticGameplayMoments = 4;
});
rejected('authorized external account creation', 'accountCreationAuthorized must remain false', value => {
    value.authority.accountCreationAuthorized = true;
});
rejected('password sharing', 'password sharing must remain forbidden', value => {
    value.ownership.passwordSharingPermitted = true;
});
rejected('automated replies', 'automated replies must remain closed', value => {
    value.moderation.automatedRepliesAuthorized = true;
});
rejected('child direct messages', 'private child contact must remain forbidden', value => {
    value.moderation.directMessagesToChildrenPermitted = true;
});
rejected('retired wording', 'companion wording', value => {
    value.channels[0].publicIdentity.tagline = 'A universe of companions.';
});
rejected('false uniqueness promise', 'unsupported creature claim', value => {
    value.channels[1].publicIdentity.description = 'Every creature is unique. NASA does not endorse Mythical Void.';
});

const valid = spawnSync(process.execPath, [validator], { encoding: 'utf8' });
assert.strictEqual(valid.status, 0, valid.stderr || valid.stdout);
checks += 1;

console.log(`Channel opening kit tests passed (${checks} checks).`);
