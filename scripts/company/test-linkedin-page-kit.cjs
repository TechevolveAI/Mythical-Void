#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-linkedin-page-kit.cjs');
const manifestSource = JSON.parse(fs.readFileSync(path.join(root, 'public/marketing/channel-kit/linkedin/manifest.json'), 'utf8'));
const activationSource = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/channel-activation-pack.json'), 'utf8'));
const handoffSource = fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/LINKEDIN_PAGE_HANDOFF.md'), 'utf8');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-linkedin-kit-'));

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
    if (run('valid').status !== 0) throw new Error('Valid LinkedIn kit was rejected.');

    const authorizedPost = structuredClone(manifestSource);
    authorizedPost.authority.postPublicationAuthorized = true;
    if (run('authorized-post', authorizedPost).status === 0) throw new Error('Unauthorized LinkedIn publication was accepted.');

    const falsePage = structuredClone(activationSource);
    falsePage.channels.find(channel => channel.channelRef === 'CH-004').accountState = 'created';
    if (run('false-page', manifestSource, falsePage).status === 0) throw new Error('Invented LinkedIn Page was accepted.');

    const publishedPost = structuredClone(activationSource);
    publishedPost.channels.find(channel => channel.channelRef === 'CH-004').firstPosts[0].approvalState = 'published';
    if (run('published-post', manifestSource, publishedPost).status === 0) throw new Error('Unapproved LinkedIn post was accepted as published.');

    const unsafeMessages = structuredClone(activationSource);
    unsafeMessages.channels.find(channel => channel.channelRef === 'CH-004').engagementSetting.pageMessagingBeforeAdultCoverage = 'on';
    if (run('unsafe-messages', manifestSource, unsafeMessages).status === 0) throw new Error('LinkedIn Page messaging without adult coverage was accepted.');

    const uniquenessClaim = `${handoffSource}\nEvery creature is unique.\n`;
    if (run('uniqueness-claim', manifestSource, activationSource, uniquenessClaim).status === 0) throw new Error('Absolute uniqueness wording was accepted.');

    console.log('LinkedIn Page kit tests passed: valid kit plus 5 authority, safety and truth mutations checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
