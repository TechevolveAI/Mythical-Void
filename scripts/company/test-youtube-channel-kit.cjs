#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-youtube-channel-kit.cjs');
const manifestSource = JSON.parse(fs.readFileSync(path.join(root, 'public/marketing/channel-kit/youtube/manifest.json'), 'utf8'));
const activationSource = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/channel-activation-pack.json'), 'utf8'));
const handoffSource = fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/YOUTUBE_CHANNEL_HANDOFF.md'), 'utf8');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-youtube-kit-'));

function run(name, manifest = manifestSource, activation = activationSource, handoff = handoffSource) {
    const manifestFile = path.join(temp, `${name}-manifest.json`);
    const activationFile = path.join(temp, `${name}-activation.json`);
    const handoffFile = path.join(temp, `${name}-handoff.md`);
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(activationFile, `${JSON.stringify(activation, null, 2)}\n`);
    fs.writeFileSync(handoffFile, handoff);
    return spawnSync(process.execPath, [validator, manifestFile, activationFile, handoffFile], { cwd: root, encoding: 'utf8' });
}

try {
    if (run('valid').status !== 0) throw new Error('Valid YouTube kit was rejected.');

    const authorizedUpload = structuredClone(manifestSource);
    authorizedUpload.authority.assetUploadAuthorized = true;
    if (run('authorized-upload', authorizedUpload).status === 0) throw new Error('Unauthorized channel-art upload was accepted.');

    const falseAccount = structuredClone(activationSource);
    falseAccount.channels.find(channel => channel.channelRef === 'CH-002').accountState = 'created';
    if (run('false-account', manifestSource, falseAccount).status === 0) throw new Error('Invented YouTube account was accepted.');

    const weakDisclosure = structuredClone(manifestSource);
    weakDisclosure.artworkDisclosure = 'Mythical Void artwork.';
    if (run('weak-disclosure', weakDisclosure).status === 0) throw new Error('Weak generated-art disclosure was accepted.');

    const unsafeComments = structuredClone(activationSource);
    unsafeComments.channels.find(channel => channel.channelRef === 'CH-002').commentSetting.beforeNamedAdultCoverage = 'on';
    if (run('unsafe-comments', manifestSource, unsafeComments).status === 0) throw new Error('Open comments without adult coverage were accepted.');

    const uniquenessClaim = `${handoffSource}\nEvery creature is unique.\n`;
    if (run('uniqueness-claim', manifestSource, activationSource, uniquenessClaim).status === 0) throw new Error('Absolute uniqueness wording was accepted.');

    console.log('YouTube channel kit tests passed: valid kit plus 5 authority, safety and truth mutations checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
