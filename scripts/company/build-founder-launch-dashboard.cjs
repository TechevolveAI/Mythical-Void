#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const defaultPaths = {
    evidence: path.join(root, 'docs/company/growth/live-launch-evidence-2026-08-14.json'),
    outreach: path.join(root, 'docs/company/content/channel-launch/FIRST_CREATOR_OUTREACH_WAVE.json'),
    activation: path.join(root, 'docs/company/content/channel-launch/channel-activation-pack.json'),
    itch: path.join(root, 'docs/company/distribution/itch-launch-pack-2026-08-14.json'),
    launch: path.join(root, 'docs/company/growth/launch-readiness.json')
};

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function buildDashboard({ evidence, outreach, activation, itch, launch }) {
    const checkedDate = evidence.checkedAt.slice(0, 10).split('-').reverse().join('/');
    const livePageCount = evidence.routes.filter(route => route.route !== '/play/' && route.verified).length;
    const firstWaveCount = outreach.messages.length;
    const laterOpportunityCount = outreach.nextWave.length;
    const preparedSocialCount = activation.channels.length;
    const firstAction = launch.nextAdmissibleWork.find(item => item.priority === 1)?.action;
    const secondAction = launch.nextAdmissibleWork.find(item => item.priority === 2)?.action;

    return `# Mythical Void — founder launch dashboard

**Last checked:** ${checkedDate}

**Public game:** https://mythicalvoid.com/

**Overall position:** The game and its useful discovery pages are live. The next growth work is prepared, but nothing is waiting on a new paid tool.

## Live now

- The public homepage and game entry are working.
- ${livePageCount} public information pages were checked: the homepage, creature genetics, NASA and STEM, parents, studio, and press room.
- The game created its playable canvas during the live check.
- Real gameplay screenshots and a short real gameplay video are available for truthful promotion.

## Ready but waiting

- **First outreach:** ${firstWaveCount} individual messages are written for Imirt, Alpha Beta Gamer, and Phaser. Nothing has been sent.
- **Later opportunities:** ${laterOpportunityCount} other routes are ranked for the right future moment.
- **Browser-game distribution:** the itch.io package, cover, page wording, screenshots, and private-test checklist are prepared. Nothing has been uploaded or published.
- **Social launch:** ${preparedSocialCount} channel plans are prepared for YouTube and LinkedIn, including the first posts and safety settings.

## Not live yet

- No official Mythical Void YouTube or LinkedIn page exists.
- No Mythical Void email address or chosen professional sending address is recorded.
- No itch.io account, private draft page, or public listing exists.
- The three deeper real-game proof sequences still need capturing: hatch to first response, a realm before and after restoration, and a spoiler-safe Project Beacon choice.
- There is no accepted player or parent research yet, so audience claims remain ideas to test rather than facts.
- Public play and share measurement is not trusted for company reporting yet.

## Kevin's two shortest next steps

1. ${firstAction}
2. ${secondAction}

Neither step needs a new Google Workspace subscription. The first can use Kevin's existing professional address if he chooses. The second needs an itch.io account and a private page, not a public launch.

## What the studio can keep doing automatically

- research suitable adult creators, press, platforms, and learning opportunities;
- prepare one truthful message or post at a time;
- check every claim against the game and label artwork separately from gameplay;
- prepare portable builds, test packs, review notes, and weekly summaries;
- stop and ask Kevin before sending, publishing, spending, opening public comments, or making a sensitive promise.

## Non-negotiable rules

- Call the beings creatures.
- Never make an absolute uniqueness promise.
- Never present generated artwork as gameplay.
- Never imply that NASA endorses Mythical Void.
- Never privately contact children or expose the son's identifying information.
- Nothing has been sent or published by the outreach system.
`;
}

if (require.main === module) {
    const values = Object.fromEntries(Object.entries(defaultPaths).map(([key, file]) => [key, readJson(file)]));
    process.stdout.write(buildDashboard(values));
}

module.exports = { buildDashboard, defaultPaths, readJson };
