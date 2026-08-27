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
    { file: 'public/parents/index.html', route: '/parents/', url: 'https://mythicalvoid.com/parents/', subject: 'family guide' },
    { file: 'public/studio/index.html', route: '/studio/', url: 'https://mythicalvoid.com/studio/', subject: 'father-and-son beginning' },
    { file: 'public/nasa-space-science/index.html', route: '/nasa-space-science/', url: 'https://mythicalvoid.com/nasa-space-science/', subject: 'STEM Creature Lab' },
    { file: 'public/educators/index.html', route: '/educators/', url: 'https://mythicalvoid.com/educators/', subject: 'group mission' }
];
const discovery = read('public/discovery.js');
const discoveryCss = read('public/discovery.css');
const pack = json('docs/company/content/channel-launch/FOUNDING_SIGNAL_LAUNCH_PACK.json');
const packText = read('docs/company/content/channel-launch/FOUNDING_SIGNAL_LAUNCH_PACK.md');
const firstWeekCampaign = json('docs/company/content/campaigns/playable-now-launch.json');
const releases = json('public/updates/releases.json');
const hatchChallenge = json('docs/company/growth/HATCH_CHALLENGE_LOOP.json');
const familyGuide = json('docs/company/growth/FAMILY_GUIDE_RECOMMENDATION_LOOP.json');
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
const parentGuidePage = read('public/parents/index.html');
requireValue(parentGuidePage.includes('no public player profiles or chat with other players, and no account needed to begin'), 'family-guide share description must carry the checked trust promise');
requireValue(parentGuidePage.includes('does not ask who receives the link') && parentGuidePage.includes('adds no tracking code'), 'family-guide recommendation privacy promise is missing');

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
    "var hatchChallengeUrl = 'https://mythicalvoid.com/hatch-challenge/'",
    'navigator.share(hatchChallengeData)',
    'navigator.clipboard.writeText(hatchChallengeUrl)',
    "track('share_completed', 'share_section')",
    "track('share_link_copied', 'share_section')"
]) requireValue(discovery.includes(required), `public/discovery.js: Hatch Challenge is missing ${required}`);
const playable = read('public/playable-now/index.html');
const hatchPage = read('public/hatch-challenge/index.html');
requireValue(playable.includes('id="hatch-challenge"') && playable.includes('data-hatch-challenge'), 'Hatch Challenge section is missing');
requireValue(playable.includes('This is not multiplayer.') && playable.includes('never asks who you invited'), 'Hatch Challenge must explain its honest boundary');
requireValue(!/every (?:possible )?creature is unique|guaranteed different/i.test(playable), 'Hatch Challenge must not guarantee a unique result');
requireValue(hatchPage.includes('<link rel="canonical" href="https://mythicalvoid.com/hatch-challenge/">'), 'dedicated Hatch Challenge canonical URL is missing');
requireValue(hatchPage.includes('data-share-url="https://mythicalvoid.com/hatch-challenge/"'), 'dedicated Hatch Challenge share URL is missing');
requireValue(hatchPage.includes('This is not multiplayer.') && hatchPage.includes('never asks who you invited'), 'dedicated Hatch Challenge must explain its honest boundary');
for (const control of ['data-hatch-challenge-share', 'data-hatch-challenge-copy', 'data-hatch-challenge-status']) requireValue(hatchPage.includes(control), `dedicated Hatch Challenge ${control} is missing`);
requireValue((hatchPage.match(/href="\/play\/#hatch-challenge"/g) || []).length >= 4 && !hatchPage.includes('<form'), 'dedicated Hatch Challenge must lead directly to the clean challenge entry without collecting details');
requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(hatchPage), 'dedicated Hatch Challenge must use clean links');
requireValue(discoveryCss.includes('.hatch-challenge-shell') && discoveryCss.includes('.hatch-challenge-steps'), 'Hatch Challenge layout is missing');
requireValue(discoveryCss.includes('.hatch-challenge-actions .button { width: 100%; }') && discoveryCss.includes('.hatch-challenge-steps li:nth-child(2) { margin-left: 0; }'), 'Hatch Challenge phone layout is missing');

requireValue(hatchChallenge.releaseId === 'HATCH-CHALLENGE-2026-08-27', 'Hatch Challenge release identity is invalid');
requireValue(['owned_site_release_prepared', 'live_production_verified'].includes(hatchChallenge.state), 'Hatch Challenge release state is invalid');
requireValue(hatchChallenge.publicRoute === 'https://mythicalvoid.com/hatch-challenge/', 'Hatch Challenge public route drifted');
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
    requireValue(hatchChallenge.verification?.productionCommit === '148ca62d0c466bd031a5529ae83389067bb4e342' && hatchChallenge.verification?.productionDeployId === '6a8fb0d5da9b150008b16ec2' && hatchChallenge.verification?.liveChallengeVisible === true, 'live Hatch Challenge production proof is missing');
}

requireValue(familyGuide.releaseId === 'FAMILY-GUIDE-RECOMMENDATION-2026-08-27', 'family-guide recommendation release identity is invalid');
requireValue(['owned_site_release_prepared', 'live_production_verified'].includes(familyGuide.state), 'family-guide recommendation release state is invalid');
requireValue(familyGuide.publicRoute === 'https://mythicalvoid.com/parents/', 'family-guide recommendation route drifted');
requireValue(familyGuide.promise?.noGameAds === true && familyGuide.promise?.noPublicProfiles === true && familyGuide.promise?.noChatWithOtherPlayers === true && familyGuide.promise?.noAccountNeededToBegin === true, 'family-guide trust promise drifted');
for (const field of ['recipientCollected', 'contactDetailsCollected', 'trackingParametersAdded', 'creatureDataRead', 'saveDataRead']) {
    requireValue(familyGuide.privacy?.[field] === false, `family-guide privacy.${field} must remain false`);
}
for (const field of ['externalSocialPublicationAuthorized', 'emailOrOutreachSendingAuthorized', 'paidPromotionAuthorized', 'externalAccountChangeAuthorized', 'externalActionTaken']) {
    requireValue(familyGuide.authority?.[field] === false, `family-guide authority.${field} must remain false`);
}
requireValue(familyGuide.verification?.productionVerificationRequired === true, 'family-guide production verification boundary drifted');
if (familyGuide.state === 'owned_site_release_prepared') {
    requireValue(familyGuide.verification?.productionCommit === null && familyGuide.verification?.productionDeployId === null && familyGuide.verification?.liveShareCardVisible === false, 'prepared family-guide recommendation must not invent production proof');
} else {
    requireValue(/^[0-9a-f]{40}$/.test(familyGuide.verification?.productionCommit || '') && /^[0-9a-f]{24}$/.test(familyGuide.verification?.productionDeployId || '') && familyGuide.verification?.liveShareCardVisible === true, 'live family-guide production proof is missing');
}

requireValue(pack.id === 'FOUNDING-SIGNAL-001' && pack.state === 'owned_word_of_mouth_live_first_external_post_waits_for_kevin', 'founding launch pack state is invalid');
requireValue(pack.primaryStoryUrl === 'https://mythicalvoid.com/studio/', 'founding launch pack must use the studio story');
requireValue(pack.firstWeekCampaignRef === 'docs/company/content/campaigns/playable-now-launch.json', 'founding launch pack is not connected to the first-week campaign');
requireValue(JSON.stringify(pack.firstWeekContentIds) === JSON.stringify(['PN-002', 'PN-001', 'PN-003']) && pack.firstWeekAutomaticLinkPreviewsOnly === true, 'founding launch pack first-week sequence is missing or unsafe');
requireValue(JSON.stringify(firstWeekCampaign.firstWeekSequence?.map(item => item.contentId)) === JSON.stringify(pack.firstWeekContentIds), 'founding launch pack and first-week campaign have drifted apart');
requireValue(firstWeekCampaign.authority?.publishingAuthorized === false && firstWeekCampaign.firstWeekPublishing?.commentsAndRepliesAuthorized === false, 'first-week campaign invents publishing or reply authority');
requireValue(pack.livePreviewCheck?.url === 'https://mythicalvoid.com/studio/' && pack.livePreviewCheck?.title === 'The Father-and-Son Story | Mythical Void Studio', 'founding launch preview identity is missing');
requireValue(pack.livePreviewCheck?.image === 'https://mythicalvoid.com/marketing/mythical-void-creature-universe-hero-v2.webp' && pack.livePreviewCheck?.imageWidth === 1672 && pack.livePreviewCheck?.imageHeight === 941, 'founding launch preview image proof is missing');
requireValue(pack.livePreviewCheck?.imageSha256 === '33900887fb56104c3fada02ccd965747b0dfab12be7b2c883c624ff8f448fc47', 'founding launch preview image fingerprint drifted');
requireValue(pack.livePreviewCheck?.brokenImagesObserved === false && pack.livePreviewCheck?.horizontalOverflowObserved === false, 'founding launch preview visual check failed');
requireValue(Array.isArray(pack.ownedShareRoutes) && pack.ownedShareRoutes.length === 6, 'launch pack must list six owned share routes');
for (const page of pages) requireValue(pack.ownedShareRoutes.some(item => item.route === page.route), `launch pack is missing ${page.route}`);
requireValue(pack.ownedShareRoutes.some(item => item.route === '/hatch-challenge/'), 'launch pack is missing the Hatch Challenge route');
for (const field of ['socialPublishingAuthorized', 'paidPromotionAuthorized', 'bulkOutreachAuthorized', 'directChildContactAuthorized', 'recipientCollectionEnabled', 'trackingParametersEnabled', 'weakGameplayVisualPermitted']) {
    requireValue(pack.boundaries?.[field] === false, `launch boundary ${field} must remain false`);
}
requireValue(pack.nextChannel?.name === 'YouTube' && pack.nextChannel?.state === 'held_for_visual_quality', 'YouTube must remain behind the visual-quality gate');
for (const required of ['Nine-year-olds ask questions', 'No download or account is needed', 'NASA does not endorse Mythical Void', 'Do not continue a private conversation', 'exact public profile URL']) {
    requireValue(packText.includes(required), `founding launch copy is missing: ${required}`);
}
for (const required of ['The rest of the first week', 'https://mythicalvoid.com/playable-now/', 'https://mythicalvoid.com/creature-genetics/', 'Use the automatic link preview only']) requireValue(packText.includes(required), `founding launch first week is missing: ${required}`);
requireValue(packText.includes('This exact preview is live and checked') && packText.includes('1672 × 941 pixels'), 'founding launch live-preview explanation is missing');
requireValue(!/https:\/\/mythicalvoid\.com\/[^\s)`"]*[?&]/.test(packText), 'founding launch pack must use clean Mythical Void links');

const release = releases.entries?.find(entry => entry.id === 'SIGNAL-017');
requireValue(release?.status === 'live' && release?.destination === '/studio/', 'Signal 017 must be a live owned release');
requireValue(release?.image === '/marketing/mythical-void-creature-universe-hero-v2.webp' && /not gameplay/i.test(release?.disclosure || ''), 'Signal 017 needs the approved artwork and disclosure');
const hatchRelease = releases.entries?.find(entry => entry.id === 'SIGNAL-023');
requireValue(hatchRelease?.status === 'live' && hatchRelease?.destination === '/hatch-challenge/', 'Signal 023 must publish the Hatch Challenge on the owned Signal Log');
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
