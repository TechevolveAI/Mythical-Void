#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildReleaseToAudienceQueue, loadDefaults } = require('./build-release-to-audience-queue.cjs');

const validator = path.join(__dirname, 'validate-release-to-audience-queue.cjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-release-to-audience-'));
const sourcePaths = {
    releases: 'public/updates/releases.json',
    releasePack: 'docs/company/content/generated/signal-log-release-pack.json',
    communityRun: 'docs/company/growth/COMMUNITY_DISCOVERY_RUN_2026-09-08.json',
    phaserShowcase: 'docs/company/growth/PHASER_SHOWCASE_ACTIVATION_2026-09-08.json',
    channels: 'docs/company/content/channels.json',
    visualPlan: 'docs/company/content/visual-launch-moments.json',
    socialIdentity: 'docs/company/content/channel-launch/SOCIAL_IDENTITY_RESERVATION_2026-09-08.json'
};

function run(name, mutate) {
    const queue = buildReleaseToAudienceQueue(loadDefaults());
    mutate(queue);
    const queuePath = path.join(temp, `${name}.json`);
    fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);
    return spawnSync(process.execPath, [validator, queuePath], { encoding: 'utf8' });
}

try {
    const valid = run('valid', () => {});
    if (valid.status !== 0) throw new Error(`Valid audience queue was rejected: ${valid.stderr}`);

    const failures = [
        ['publish-authority', queue => { queue.authority.externalPublishingAuthorized = true; }],
        ['fake-engagement', queue => { queue.authority.fakeEngagementAuthorized = true; }],
        ['tracking-link', queue => { queue.nextMove.exactPost.url += '?utm_source=reddit'; }],
        ['invented-metric', queue => { queue.nextMove.exactPost.firstComment += ' 500 players joined.'; }],
        ['retired-companion-word', queue => { queue.nextMove.exactPost.firstComment += ' Meet your companion.'; }],
        ['vague-signal-word', queue => { queue.nextMove.exactPost.firstComment += ' Follow the signal.'; }],
        ['skip-first-community', queue => { queue.nextMove.route = 'Phaser Showcase'; }],
        ['invented-visual-approval', queue => { queue.generatedFrom.approvedGameplayVisuals = 1; }]
    ];

    for (const [name, mutate] of failures) {
        if (run(name, mutate).status === 0) throw new Error(`${name} mutation was accepted.`);
    }

    console.log(`Release-to-audience safeguards passed (${failures.length} failure cases across ${Object.keys(sourcePaths).length} checked sources).`);
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
