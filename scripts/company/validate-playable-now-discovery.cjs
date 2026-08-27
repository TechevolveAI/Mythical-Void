#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { isWithdrawnPublicVisual, readVisualPublicationRegister } = require('./visual-publication-policy.cjs');

const root = path.resolve(__dirname, '../..');
const pagePath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'public/playable-now/index.html');
const releasePath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'docs/company/content/generated/playable-now-discovery-release.json');
const page = fs.readFileSync(pagePath, 'utf8');
const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
const register = readVisualPublicationRegister();
const signalSource = JSON.parse(fs.readFileSync(path.join(root, 'public/updates/releases.json'), 'utf8'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

requireValue(page.includes('<link rel="canonical" href="https://mythicalvoid.com/playable-now/">'), 'canonical URL is missing');
requireValue(page.includes('<meta name="robots" content="index, follow, max-image-preview:large'), 'page must remain indexable');
requireValue((page.match(/<h1(?:\s[^>]*)?>/g) || []).length === 1, 'page must have exactly one main heading');
requireValue(page.includes('LOOKING FOR A NEW GAME? PLAY THIS ONE') && page.includes('<h1>Hatch a strange alien creature. Save six living realms.</h1>'), 'search-first game promise is missing from the first screen');
requireValue(page.indexOf('id="find-your-way"') < page.indexOf('class="truth-strip"'), 'the game finder must remain the first main section');
requireValue(page.includes('Mythical Void is a free browser adventure with platforming, battles, building and story choices.'), 'plain playable category is missing from the first screen');
requireValue(page.includes('Free · No game ads · No chat with other players · No download · No account · No payment details · Early access'), 'first-screen access and family trust answer is missing');
requireValue(page.includes('Early access') && /still (?:growing|in early access)/i.test(page), 'early-access boundary is missing');
requireValue(page.includes('NASA does not endorse Mythical Void.'), 'NASA non-endorsement is missing');
requireValue(page.includes('AI-generated marketing artwork') && page.includes('It is not gameplay.'), 'marketing-art boundary is missing');
requireValue(!/<section class="hero playable-hero">/.test(page), 'imagined artwork must not displace the game finder on the first screen');
requireValue(page.includes('previous gameplay media pack is withdrawn'), 'human visual-review decision is missing');
requireValue(page.includes('creature stays visible') && page.includes('watched every frame'), 'replacement quality bar is missing');
requireValue(!/<video\b/i.test(page), 'withdrawn video must not be embedded');
requireValue(!/\bcompanions?\b/i.test(page), 'retired companion wording is present');
requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(page), 'unsupported creature-uniqueness promise is present');
requireValue(!/<form\b/i.test(page), 'page must not open contact or signup collection');
requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(page), 'page contains a tracking parameter');
requireValue(!/NASA (?:made|makes|endorses|partners with) Mythical Void/i.test(page), 'page implies a NASA relationship');
requireValue(page.includes('data-share-game') && page.includes('data-copy-game') && page.includes('data-share-status'), 'clean sharing controls are missing');
requireValue(page.includes('never asks for their contact details') && page.includes('adds no tracking code'), 'sharing privacy explanation is missing');
requireValue(page.includes('/discovery.css?v=20260827-funnel-source') && page.includes('/discovery.js?v=20260827-funnel-source'), 'game-finder assets need a matching fresh cache version');
requireValue(page.includes('id="hatch-challenge"') && page.includes('Same signal. Two creatures. What will hatch?'), 'Hatch Challenge is missing');
requireValue(page.includes('<strong>This is not multiplayer.</strong>') && page.includes('nothing is uploaded') && page.includes('never asks who you invited'), 'Hatch Challenge boundaries are missing');
for (const control of ['data-hatch-challenge-share', 'data-hatch-challenge-copy', 'data-hatch-challenge-status']) requireValue(page.includes(control), `Hatch Challenge control ${control} is missing`);

for (const prefix of register.withdrawnPathFamilies) requireValue(!page.includes(prefix), `withdrawn path family ${prefix} is published on the page`);
for (const publicPath of register.withdrawnIndividualPaths) requireValue(!page.includes(publicPath), `withdrawn asset ${publicPath} is published on the page`);
requireValue(!isWithdrawnPublicVisual('/marketing/mythical-void-creature-universe-hero-v2.webp', register), 'temporary imagined-universe artwork is incorrectly withdrawn');

const playLinks = [...page.matchAll(/href="(\/play\/[^\"]*)"/g)].map(match => match[1]);
requireValue(playLinks.length >= release.page?.directPlayLinkMinimum, 'page needs at least three direct play links');
requireValue(playLinks.every(link => link === '/play/'), 'every play link must use the clean owned route');

let structured;
try { structured = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]); }
catch (error) { failures.push(`structured data is invalid: ${error.message}`); }
const types = Array.isArray(structured) ? structured.map(item => item?.['@type']) : [];
for (const type of ['VideoGame', 'FAQPage']) requireValue(types.includes(type), `${type} structured data is missing`);
requireValue(!types.includes('VideoObject'), 'withdrawn video must not remain in structured data');
const structuredGame = Array.isArray(structured) ? structured.find(item => item?.['@type'] === 'VideoGame') : null;
requireValue(structuredGame?.['@id'] === 'https://mythicalvoid.com/#video-game', 'structured game identity is missing');
requireValue(structuredGame?.mainEntityOfPage === 'https://mythicalvoid.com/playable-now/', 'structured game does not identify the canonical decision page');
requireValue(structuredGame?.creator?.['@id'] === 'https://mythicalvoid.com/#studio' && structuredGame?.creator?.url === 'https://mythicalvoid.com/studio/', 'structured game creator is missing or drifted');
requireValue(structuredGame?.potentialAction?.['@type'] === 'PlayAction', 'structured direct Play action is missing');
requireValue(structuredGame?.potentialAction?.target?.['@type'] === 'EntryPoint' && structuredGame?.potentialAction?.target?.urlTemplate === 'https://mythicalvoid.com/play/', 'structured Play target must use the clean owned game route');
requireValue(structuredGame?.potentialAction?.target?.actionPlatform?.includes('https://schema.org/DesktopWebPlatform') && structuredGame?.potentialAction?.target?.actionPlatform?.includes('https://schema.org/MobileWebPlatform'), 'structured Play platforms are incomplete');
requireValue(/modern JavaScript and WebGL-capable browser/.test(structuredGame?.softwareRequirements || ''), 'truthful browser requirements are missing');
requireValue(!Object.hasOwn(structuredGame || {}, 'screenshot'), 'withdrawn or unapproved gameplay screenshots must not enter structured data');

requireValue(sha256(Buffer.from(page)) === release.page?.sha256, 'page fingerprint drifted');
requireValue(release.state === 'owned_site_explanation_live_media_withdrawn_pending_rebuild', 'release state must record the current visual decision');
requireValue(release.visualDecision?.registerPath === 'public/press/visual-publication-register.json', 'release must point to the visual-review register');
requireValue(release.visualDecision?.withdrawnGameplayMedia === true && release.visualDecision?.replacementApproved === false, 'release must not imply replacement gameplay media is approved');
requireValue(release.visualDecision?.firstScreenArtRemoved === true && release.visualDecision?.firstScreenExperience === 'interactive_game_finder', 'release must record the art-free first-screen decision');
requireValue(release.visualDecision?.sharingImageClassification === 'ai_generated_marketing_illustration_not_gameplay', 'sharing-image boundary is missing');
requireValue(release.firstScreenMessage?.headline === 'Hatch a strange alien creature. Save six living realms.', 'release does not record the clear game promise');
requireValue(release.firstScreenMessage?.moodChooserPreserved === true && release.firstScreenMessage?.directPlayPreserved === true, 'release lost the optional choice or direct Play route');
requireValue(release.firstScreenMessage?.gameplayMediaAdded === false, 'release must not imply that gameplay media was added');
requireValue(release.page?.structuredDirectPlay?.action === 'PlayAction' && release.page?.structuredDirectPlay?.target === 'https://mythicalvoid.com/play/' && release.page?.structuredDirectPlay?.entryPoint === true, 'release does not record the structured direct Play route');
requireValue(release.page?.structuredDirectPlay?.desktopWeb === true && release.page?.structuredDirectPlay?.mobileWeb === true, 'release does not record the supported web entry points');
requireValue(release.page?.structuredDirectPlay?.unapprovedScreenshotIncluded === false && release.page?.structuredDirectPlay?.rankingOrRichResultClaimed === false, 'structured discovery must not smuggle in an unapproved screenshot or a search-result promise');
requireValue(release.familyTrust?.paidAdvertisingInCurrentGame === false && release.familyTrust?.publicPlayerProfiles === false && release.familyTrust?.chatWithOtherPlayers === false, 'release must record the current family trust boundaries');
requireValue(release.familyTrust?.creatureDialogueAvailable === true && release.familyTrust?.creatureDialogueIsPersonToPersonChat === false, 'release must distinguish creature dialogue from person-to-person chat');
requireValue(release.playIntentDoorway?.intentSpecificSharingEnabled === true && release.playIntentDoorway?.shareRouteLocation === 'URL fragment only', 'intent-specific sharing release is missing');
requireValue(release.playIntentDoorway?.choiceRequiredBeforePlay === false && release.playIntentDoorway?.firstScreenDirectPlay === true, 'release must preserve a direct first-screen Play route');
requireValue(release.playIntentDoorway?.starterMissionCount === 4 && release.playIntentDoorway?.stepsPerStarterMission === 3 && release.playIntentDoorway?.starterMissionRequiredBeforePlay === false, 'release must record four optional three-step starter missions');
requireValue(JSON.stringify(release.playIntentDoorway?.shareRouteWords) === JSON.stringify(['wonder', 'create', 'challenge', 'story']), 'intent share route allowlist drifted');
requireValue(release.playIntentDoorway?.sharedChoiceSentToServer === false && release.playIntentDoorway?.recipientContactCollected === false, 'intent sharing privacy boundary drifted');
requireValue(release.playIntentDoorway?.selectedPlaySourceSentAfterConsent === true && release.playIntentDoorway?.playEvent === 'play_selected' && release.playIntentDoorway?.playSourceProperty === 'source_area', 'Play measurement contract drifted');
requireValue(release.playIntentDoorway?.arrivalEvent === 'discovery_arrival' && release.playIntentDoorway?.entrySourceProperty === 'entry_source', 'arrival measurement contract drifted');
requireValue(release.playIntentDoorway?.entrySourceBuckets?.join('|') === 'direct_or_private|owned_site|search|game_shelf|social_or_creator|other_site', 'arrival source buckets drifted');
requireValue(release.playIntentDoorway?.fullReferrerSent === false && release.playIntentDoorway?.gameMeasured === false, 'arrival measurement privacy boundary drifted');
requireValue(release.hatchChallenge?.route === 'https://mythicalvoid.com/hatch-challenge/', 'Hatch Challenge route is missing');
requireValue(release.hatchChallenge?.participants === 2 && release.hatchChallenge?.multiplayerClaimed === false && release.hatchChallenge?.differenceGuaranteed === false, 'Hatch Challenge promise drifted');
requireValue(release.hatchChallenge?.accountRequired === false && release.hatchChallenge?.contactCollected === false && release.hatchChallenge?.creatureDataShared === false && release.hatchChallenge?.trackingParametersAdded === false, 'Hatch Challenge privacy boundary drifted');
requireValue(release.hatchChallenge?.directPlayRoute === '/play/', 'Hatch Challenge direct Play route drifted');
for (const [key, expected] of Object.entries({ ownedWebsitePublicationAuthorized: true, externalSocialPublicationAuthorized: false, emailOrOutreachSendingAuthorized: false, paidPromotionAuthorized: false, publicRepliesAuthorized: false, externalActionTaken: false })) {
    requireValue(release.authority?.[key] === expected, `authority.${key} must be ${expected}`);
}
for (const [key, expected] of Object.entries({ accountRequired: false, emailSignupEnabled: false, contactCollectionEnabled: false, recipientCollectionEnabled: false, trackingParametersPermitted: false, analyticsDefault: 'denied' })) {
    requireValue(release.privacy?.[key] === expected, `privacy.${key} must be ${expected}`);
}
requireValue(release.privacy?.fullReferrerSent === false && release.privacy?.broadArrivalGroupOnly === true, 'privacy must preserve broad arrival groups without the full referrer');
requireValue(release.verification?.productionVerificationRequired === true, 'production verification must remain required');
if (release.verification?.state === 'prepared_for_owned_release') {
    requireValue(release.verification?.productionCommit === null && release.verification?.productionDeployId === null && release.verification?.verifiedAt === null, 'prepared release must not invent production proof');
    requireValue(release.verification?.liveMeasurementVerified === false && release.verification?.directButtonVisible === false && release.verification?.directDestination === null, 'prepared release must not claim live behaviour');
} else {
    requireValue(release.verification?.state === 'live_production_verified', 'production verification state is invalid');
    requireValue(/^[0-9a-f]{40}$/.test(release.verification?.productionCommit || '') && !/^0{40}$/.test(release.verification?.productionCommit || ''), 'production commit proof is missing or drifted');
    requireValue(/^[0-9a-f]{24}$/.test(release.verification?.productionDeployId || '') && !/^0{24}$/.test(release.verification?.productionDeployId || ''), 'production deploy proof is missing or drifted');
    requireValue(!Number.isNaN(Date.parse(release.verification?.verifiedAt || '')), 'production verification time is missing or invalid');
    requireValue(release.verification?.liveMeasurementVerified === true && release.verification?.directButtonVisible === true && release.verification?.directDestination === 'https://mythicalvoid.com/play/', 'live direct-Play or measurement proof is missing');
}

for (const [file, fragment, label] of [
    ['public/sitemap.xml', '<loc>https://mythicalvoid.com/playable-now/</loc>', 'sitemap'],
    ['public/press/mythical-void-press-assets.json', '"playableNowUrl": "https://mythicalvoid.com/playable-now/"', 'press manifest'],
    ['netlify.toml', 'from = "/playable-now/"', 'Netlify route'],
    ['vercel.json', '"source": "/playable-now/"', 'Vercel route']
]) requireValue(fs.readFileSync(path.join(root, file), 'utf8').includes(fragment), `${label} discovery is missing`);

const signal = signalSource.entries?.find(entry => entry.id === 'SIGNAL-015');
requireValue(signal?.status === 'live' && signal?.destination === '/playable-now/', 'SIGNAL-015 is missing or drifted');
requireValue(fs.readFileSync(path.join(root, 'public/updates/feed.xml'), 'utf8').includes('A better standard for showing the game'), 'RSS feed is missing the visual-quality correction');
requireValue(JSON.parse(fs.readFileSync(path.join(root, 'public/updates/feed.json'), 'utf8')).items?.some(item => item.external_url === 'https://mythicalvoid.com/playable-now/'), 'JSON feed is missing the playable page');

console.log(JSON.stringify({
    valid: failures.length === 0,
    publicUrl: 'https://mythicalvoid.com/playable-now/',
    directPlayLinks: playLinks.length,
    withdrawnMediaEmbedded: false,
    analyticsDefault: 'denied',
    externalPublicationAuthorized: false,
    failures
}, null, 2));
if (failures.length) process.exit(1);
