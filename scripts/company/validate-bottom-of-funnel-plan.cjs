#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1
    ? path.resolve(__dirname, '..', '..')
    : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const plan = JSON.parse(read('docs/company/growth/BOTTOM_OF_FUNNEL_DISTRIBUTION_PLAN.json'));
const planText = read('docs/company/growth/BOTTOM_OF_FUNNEL_DISTRIBUTION_PLAN.md');
const playable = read('public/playable-now/index.html');
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

requireValue(plan.id === 'BOTTOM-OF-FUNNEL-001', 'distribution plan id is missing');
requireValue(plan.primaryNextShelf?.name === 'itch.io', 'itch.io must remain the first candidate shelf');
requireValue(plan.primaryNextShelf?.publicationAuthorized === false, 'external publication must wait for Kevin');
requireValue(plan.primaryNextShelf?.gates?.includes('four authentic gameplay moments approved'), 'the four-moment visual gate is missing');
requireValue(plan.primaryNextShelf?.gates?.includes('embedded browser package tested'), 'the embedded build gate is missing');
requireValue(plan.routeOrder?.[0]?.url === 'https://mythicalvoid.com/playable-now/', 'the owned search doorway must stay first and live');
requireValue(plan.routeOrder?.find(route => route.name === 'YouTube')?.state === 'held_for_visual_quality', 'YouTube must remain behind the visual gate');
for (const field of ['externalPublishingAuthorized', 'paidPromotionAuthorized', 'bulkOutreachAuthorized', 'directChildContactAuthorized', 'imaginedArtMayBeCalledGameplay', 'portalAcceptanceMayBePromised']) {
    requireValue(plan.boundaries?.[field] === false, `boundary ${field} must remain false`);
}
for (const phrase of ['A free browser adventure', 'Why itch.io is first', 'Three to five real game images', 'No action is needed now', 'NASA endorsement']) {
    requireValue(planText.includes(phrase), `plain-language plan is missing: ${phrase}`);
}
for (const source of plan.sources || []) requireValue(planText.includes(source), `plain-language plan is missing source: ${source}`);
for (const phrase of ['PLAYABLE NOW // FREE BROWSER GAME', 'No download. No account.', 'Hatch a strange alien creature']) {
    requireValue(playable.includes(phrase), `playable search doorway is missing: ${phrase}`);
}

if (failures.length) {
    console.error('Bottom-of-funnel distribution plan is not ready:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    ownedSearchDoorway: 'live',
    primaryNextShelf: 'itch.io',
    itchPublicationAuthorized: false,
    visualGateOpen: false,
    externalSpendAuthorized: false
}, null, 2));
