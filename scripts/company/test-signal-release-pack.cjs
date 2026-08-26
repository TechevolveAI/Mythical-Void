#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildReleasePack, defaultSourcePath } = require('./build-signal-release-pack.cjs');

const validator = path.join(__dirname, 'validate-signal-release-pack.cjs');
const originalSource = JSON.parse(fs.readFileSync(defaultSourcePath, 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-signal-release-pack-'));

function run(name, mutateSource = () => {}, mutatePack = () => {}) {
    const source = structuredClone(originalSource);
    mutateSource(source);
    const pack = buildReleasePack(source);
    mutatePack(pack);
    const sourceFile = path.join(temp, `${name}-source.json`);
    const packFile = path.join(temp, `${name}-pack.json`);
    fs.writeFileSync(sourceFile, `${JSON.stringify(source, null, 2)}\n`);
    fs.writeFileSync(packFile, `${JSON.stringify(pack, null, 2)}\n`);
    return spawnSync(process.execPath, [validator, sourceFile, packFile], { encoding: 'utf8' });
}

try {
    if (run('valid').status !== 0) throw new Error('Valid Signal release pack was rejected.');

    const failures = [
        ['draft-source', source => { source.entries[0].status = 'draft'; }, () => {}],
        ['tracking-link', source => { source.entries[0].destination += '?utm_source=social'; }, () => {}],
        ['missing-renderer-proof-disclosure', source => { source.entries.find(entry => entry.imageClass === 'branded_renderer_proof_layout_with_authentic_game_sprite_exports').disclosure = 'Creature artwork.'; }, () => {}],
        ['missing-generated-art-disclosure', source => { source.entries.find(entry => entry.imageClass === 'ai_generated_marketing_illustration').disclosure = 'Creature artwork.'; }, () => {}],
        ['publishing-authorized', () => {}, pack => { pack.authority.publishingAuthorized = true; }],
        ['invented-channel', () => {}, pack => { pack.authority.socialAccountsVerified = true; }],
        ['new-claim', () => {}, pack => { pack.items[0].drafts.professionalNetwork.body += '\nThe biggest game launch of the year.'; }],
        ['retired-wording', source => { source.entries[0].summary += ' Meet your companion.'; }, () => {}],
        ['absolute-uniqueness', source => { source.entries[0].summary += ' Every creature is unique.'; }, () => {}],
        ['invented-audience-metric', source => { source.entries[0].summary += ' 10,000 players joined.'; }, () => {}],
        ['invented-approval', () => {}, pack => { pack.items[0].approval.approvedAt = '2026-08-14T21:00:00Z'; }],
        ['bulk-recipient', () => {}, pack => { pack.items[0].drafts.pressCreatorSourceNote.recipient = 'press-list@example.com'; }]
    ];

    for (const [name, mutateSource, mutatePack] of failures) {
        if (run(name, mutateSource, mutatePack).status === 0) throw new Error(`${name} mutation was accepted.`);
    }

    console.log(`Signal release pack safeguards passed (${failures.length} failure cases).`);
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
