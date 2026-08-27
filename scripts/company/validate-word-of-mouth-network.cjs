#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1
    ? path.resolve(__dirname, '..', '..')
    : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const json = relative => JSON.parse(read(relative));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const pages = [
    { file: 'public/playable-now/index.html', route: '/playable-now/', url: 'https://mythicalvoid.com/playable-now/#find-your-way', subject: 'playable game' },
    { file: 'public/studio/index.html', route: '/studio/', url: 'https://mythicalvoid.com/studio/', subject: 'father-and-son beginning' },
    { file: 'public/nasa-space-science/index.html', route: '/nasa-space-science/', url: 'https://mythicalvoid.com/nasa-space-science/', subject: 'STEM Creature Lab' },
    { file: 'public/educators/index.html', route: '/educators/', url: 'https://mythicalvoid.com/educators/', subject: 'group mission' }
];
const discovery = read('public/discovery.js');
const discoveryCss = read('public/discovery.css');
const pack = json('docs/company/content/channel-launch/FOUNDING_SIGNAL_LAUNCH_PACK.json');
const packText = read('docs/company/content/channel-launch/FOUNDING_SIGNAL_LAUNCH_PACK.md');
const releases = json('public/updates/releases.json');
const hatchChallenge = json('docs/company/growth/HATCH_CHALLENGE_LOOP.json');
const packageJson = json('package.json');

for (const page of pages) {
    const source = read(page.file);
    requireValue(source.includes('data-share-card'), `${page.file}: share card is missing`);
    requireValue(source.includes(`data-share-url="${page.url}"`), `${page.file}: clean page-specific URL is missing`);
    requireValue(/data-share-title="[^"]{12,}"/.test(source), `${page.file}: share title is too weak`);
    requireValue(/data-share-text="[^"]{40,}"/.test(source), `${page.file}: share description is too weak`);
    for (const control of ['data-share-game', 'data-copy-game', 'data-share-status']) requireValue(source.includes(control), `${page.file}: ${control} is missing`);
    requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(source), `${page.file}: tracking code is not permitted`);
}

for (const required of [
    'shareCard.dataset.shareUrl',
    'shareCard.dataset.shareTitle',
    'shareCard.dataset.shareText',
    'navigator.share(shareData)',
    'navigator.clipboard.writeText(shareUrl)',
    "track('share_completed'",
    "track('share_link_copied'"
]) requireValue(discovery.includes(required), `public/discovery.js: missing ${required}`);
requireValue(!discovery.includes('mailto:') && !discovery.includes('tel:'), 'sharing must not collect or route contact details');
requireValue(discovery.includes("shareUrl = 'https://mythicalvoid.com/playable-now/#find-your-way/' + intentId"), 'game-finder word of mouth is not specific to the chosen reason');
requireValue(discovery.includes("window.history.replaceState(null, '', cleanAddress.pathname + cleanAddress.search + cleanAddress.hash)"), 'game-finder sharing must keep a clean owned URL');
for (const required of [
    "var hatchChallengeUrl = 'https://mythicalvoid.com/playable-now/#hatch-challenge'",
    'navigator.share(hatchChallengeData)',
    'navigator.clipboard.writeText(hatchChallengeUrl)',
    "track('share_completed', 'share_section')",
    "track('share_link_copied', 'share_section')"
]) requireValue(discovery.includes(required), `public/discovery.js: Hatch Challenge is missing ${required}`);
const playable = read('public/playable-now/index.html');
requireValue(playable.includes('id="hatch-challenge"') && playable.includes('data-hatch-challenge'), 'Hatch Challenge section is missing');
requireValue(playable.includes('This is not multiplayer.') && playable.includes('never asks who you invited'), 'Hatch Challenge must explain its honest boundary');
requireValue(!/every (?:possible )?creature is unique|guaranteed different/i.test(playable), 'Hatch Challenge must not guarantee a unique result');
requireValue(discoveryCss.includes('.hatch-challenge-shell') && discoveryCss.includes('.hatch-challenge-steps'), 'Hatch Challenge layout is missing');
requireValue(discoveryCss.includes('.hatch-challenge-actions .button { width: 100%; }') && discoveryCss.includes('.hatch-challenge-steps li:nth-child(2) { margin-left: 0; }'), 'Hatch Challenge phone layout is missing');

requireValue(hatchChallenge.releaseId === 'HATCH-CHALLENGE-2026-08-27', 'Hatch Challenge release identity is invalid');
requireValue(['owned_site_release_prepared', 'live_production_verified'].includes(hatchChallenge.state), 'Hatch Challenge release state is invalid');
requireValue(hatchChallenge.publicRoute === 'https://mythicalvoid.com/playable-now/#hatch-challenge', 'Hatch Challenge public route drifted');
requireValue(hatchChallenge.promise?.participants === 2 && hatchChallenge.promise?.multiplayerClaimed === false && hatchChallenge.promise?.differenceGuaranteed === false, 'Hatch Challenge promise drifted');
for (const field of ['recipientCollected', 'playerIdentityCollected', 'creatureDataReadForShare', 'creatureDataTransmitted', 'contactDetailsCollected', 'newAnalyticsEventAdded']) {
    requireValue(hatchChallenge.privacy?.[field] === false, `Hatch Challenge privacy.${field} must remain false`);
}
requireValue(hatchChallenge.visualBoundary?.newArtworkUsed === false && hatchChallenge.visualBoundary?.gameplayMediaUsed === false && hatchChallenge.visualBoundary?.visualLaunchGateChanged === false, 'Hatch Challenge visual boundary drifted');
for (const field of ['externalSocialPublicationAuthorized', 'emailOrOutreachSendingAuthorized', 'paidPromotionAuthorized', 'externalAccountChangeAuthorized', 'externalActionTaken']) {
    requireValue(hatchChallenge.authority?.[field] === false, `Hatch Challenge authority.${field} must remain false`);
}
requireValue(hatchChallenge.verification?.productionVerificationRequired === true && hatchChallenge.verification?.directDestination === 'https://mythicalvoid.com/play/', 'Hatch Challenge verification boundary drifted');
if (hatchChallenge.state === 'owned_site_release_prepared') {
    requireValue(hatchChallenge.verification?.productionCommit === null && hatchChallenge.verification?.productionDeployId === null && hatchChallenge.verification?.liveChallengeVisible === false, 'prepared Hatch Challenge must not invent production proof');
} else {
    requireValue(hatchChallenge.verification?.productionCommit === '18e6e69b5c478859fb9db9a137f9a0d48dfcb86c' && hatchChallenge.verification?.productionDeployId === '6a8fac1d80c28500086236a1' && hatchChallenge.verification?.liveChallengeVisible === true, 'live Hatch Challenge production proof is missing');
}

requireValue(pack.id === 'FOUNDING-SIGNAL-001' && pack.state === 'owned_word_of_mouth_live_first_external_post_waits_for_kevin', 'founding launch pack state is invalid');
requireValue(pack.primaryStoryUrl === 'https://mythicalvoid.com/studio/', 'founding launch pack must use the studio story');
requireValue(Array.isArray(pack.ownedShareRoutes) && pack.ownedShareRoutes.length === 5, 'launch pack must list five owned share routes');
for (const page of pages) requireValue(pack.ownedShareRoutes.some(item => item.route === page.route), `launch pack is missing ${page.route}`);
requireValue(pack.ownedShareRoutes.some(item => item.route === '/playable-now/#hatch-challenge'), 'launch pack is missing the Hatch Challenge route');
for (const field of ['socialPublishingAuthorized', 'paidPromotionAuthorized', 'bulkOutreachAuthorized', 'directChildContactAuthorized', 'recipientCollectionEnabled', 'trackingParametersEnabled', 'weakGameplayVisualPermitted']) {
    requireValue(pack.boundaries?.[field] === false, `launch boundary ${field} must remain false`);
}
requireValue(pack.nextChannel?.name === 'YouTube' && pack.nextChannel?.state === 'held_for_visual_quality', 'YouTube must remain behind the visual-quality gate');
for (const required of ['Nine-year-olds ask questions', 'No download or account is needed', 'NASA does not endorse Mythical Void', 'Do not continue a private conversation', 'exact public profile URL']) {
    requireValue(packText.includes(required), `founding launch copy is missing: ${required}`);
}
requireValue(!/https:\/\/mythicalvoid\.com\/[^\s)`"]*[?&]/.test(packText), 'founding launch pack must use clean Mythical Void links');

const release = releases.entries?.find(entry => entry.id === 'SIGNAL-017');
requireValue(release?.status === 'live' && release?.destination === '/studio/', 'Signal 017 must be a live owned release');
requireValue(release?.image === '/marketing/mythical-void-creature-universe-hero-v2.webp' && /not gameplay/i.test(release?.disclosure || ''), 'Signal 017 needs the approved artwork and disclosure');
const hatchRelease = releases.entries?.find(entry => entry.id === 'SIGNAL-023');
requireValue(hatchRelease?.status === 'live' && hatchRelease?.destination === '/playable-now/#hatch-challenge', 'Signal 023 must publish the Hatch Challenge on the owned Signal Log');
requireValue(hatchRelease?.image === '/marketing/mythical-void-creature-universe-hero-v2.webp' && /not gameplay/i.test(hatchRelease?.disclosure || ''), 'Signal 023 needs the approved artwork and disclosure');
requireValue(packageJson.scripts?.build?.includes('validate:word-of-mouth'), 'production build must run the word-of-mouth validator');

if (failures.length) {
    console.error('Word-of-mouth network is not ready:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    sharePageCount: pages.length,
    gameFinderShareRouteCount: 4,
    hatchChallengeRouteLive: hatchChallenge.state === 'live_production_verified',
    shareSubjects: pages.map(page => page.subject),
    recipientCollection: false,
    trackingParameters: false,
    socialPublishingAuthorized: false,
    firstExternalPostReadyForKevin: true,
    youtubeVisualGateOpen: false
}, null, 2));
