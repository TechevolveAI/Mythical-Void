#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-father-son-story-social-release.cjs');
const originalRelease = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/generated/father-son-story-social-release.json'), 'utf8'));
const originalSource = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/generated/signal-log-release-pack.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-founder-story-social-'));

function run(name, mutateRelease = () => {}, mutateSource = () => {}) {
    const release = structuredClone(originalRelease);
    const source = structuredClone(originalSource);
    mutateRelease(release);
    mutateSource(source);
    const releaseFile = path.join(temp, `${name}-release.json`);
    const sourceFile = path.join(temp, `${name}-source.json`);
    fs.writeFileSync(releaseFile, `${JSON.stringify(release, null, 2)}\n`);
    fs.writeFileSync(sourceFile, `${JSON.stringify(source, null, 2)}\n`);
    return spawnSync(process.execPath, [validator, releaseFile, sourceFile], { cwd: root, encoding: 'utf8' });
}

try {
    if (run('valid').status !== 0) throw new Error('Valid founder-story social release was rejected.');
    const failures = [
        ['wrong-digest', release => { release.assets[0].sha256 = '0'.repeat(64); }, () => {}],
        ['wrong-dimensions', release => { release.assets[1].height = 1080; }, () => {}],
        ['weak-disclosure', release => { release.assets[0].disclosure = 'Founder artwork.'; }, () => {}],
        ['copy-drift', release => { release.drafts.professionalNetwork.copy += '\nBiggest launch ever.'; }, () => {}],
        ['tracking-link', release => { release.selection.destination += '?utm_source=linkedin'; }, () => {}],
        ['invented-account', release => { release.authority.officialSocialAccountVerified = true; }, () => {}],
        ['publishing-open', release => { release.authority.publishingAuthorized = true; }, () => {}],
        ['invented-approval', release => { release.authority.approvedAt = '2026-08-14T23:00:00Z'; }, () => {}],
        ['retired-wording', release => { release.purpose += ' Meet your companion.'; }, () => {}],
        ['absolute-uniqueness', release => { release.purpose += ' Every creature is unique.'; }, () => {}],
        ['invented-audience', release => { release.purpose += ' 100,000 players joined.'; }, () => {}],
        ['child-targeting', release => { release.audience.childTargetedAdvertising = true; }, () => {}],
        ['child-photo', release => { release.identityBoundary.childPhotoUsed = true; }, () => {}],
        ['child-name', release => { release.identityBoundary.childNameUsed = true; }, () => {}],
        ['external-action', release => { release.authority.externalActionPerformed = true; }, () => {}],
        ['source-pack-drift', () => {}, source => { source.items.find(item => item.id === 'DRAFT-SIGNAL-007').drafts.videoCommunity.body += ' New claim.'; }]
    ];
    for (const [name, mutateRelease, mutateSource] of failures) if (run(name, mutateRelease, mutateSource).status === 0) throw new Error(`${name} mutation was accepted.`);
    console.log(`Founder-story social release safeguards passed (${failures.length} failure cases).`);
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
