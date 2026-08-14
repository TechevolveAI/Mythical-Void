#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-irish-founder-story.cjs');
const sourceRelease = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/IRISH_FOUNDER_STORY_RELEASE.json'), 'utf8'));
const sourceArticle = fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/IRISH_FOUNDER_STORY_ARTICLE.md'), 'utf8');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-founder-story-'));

function run(name, release = sourceRelease, article = sourceArticle) {
    const releaseFile = path.join(temp, `${name}-release.json`);
    const articleFile = path.join(temp, `${name}-article.md`);
    fs.writeFileSync(releaseFile, `${JSON.stringify(release, null, 2)}\n`);
    fs.writeFileSync(articleFile, article);
    return spawnSync(process.execPath, [validator, releaseFile, articleFile], { cwd: root, encoding: 'utf8' });
}

try {
    if (run('valid').status !== 0) throw new Error('Valid founder story was rejected.');

    const sent = structuredClone(sourceRelease);
    sent.pitch.sentAt = '2026-08-14T00:00:00Z';
    if (run('sent', sent).status === 0) throw new Error('An unapproved sent pitch was accepted.');

    const paid = structuredClone(sourceRelease);
    paid.authority.paidPlacementAuthorized = true;
    if (run('paid', paid).status === 0) throw new Error('Unauthorized paid placement was accepted.');

    const childInterview = structuredClone(sourceRelease);
    childInterview.authority.childParticipationAuthorized = true;
    if (run('child-interview', childInterview).status === 0) throw new Error('Child interview participation was accepted.');

    const absolutePromise = `${sourceArticle}\nEvery creature is unique.`;
    if (run('absolute-promise', sourceRelease, absolutePromise).status === 0) throw new Error('An absolute creature promise was accepted.');

    console.log('Irish founder story tests passed: valid release plus 4 authority, privacy and claim mutations checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
