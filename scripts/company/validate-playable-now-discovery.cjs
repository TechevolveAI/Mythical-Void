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
requireValue(page.includes('LOOKING FOR A NEW GAME? START HERE') && page.includes('<h1>What are you in the mood for?</h1>'), 'search-first game finder is missing from the first screen');
requireValue(page.indexOf('id="find-your-way"') < page.indexOf('class="truth-strip"'), 'the game finder must remain the first main section');
requireValue(page.includes('Mythical Void is a free alien creature adventure.'), 'plain playable category is missing from the first screen');
requireValue(page.includes('Free · No download · No account · No payment details · Early access'), 'first-screen access answer is missing');
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
requireValue(page.includes('/discovery.css?v=20260826-return-doorway') && page.includes('/discovery.js?v=20260826-return-doorway'), 'game-finder assets need a matching fresh cache version');

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

requireValue(sha256(Buffer.from(page)) === release.page?.sha256, 'page fingerprint drifted');
requireValue(release.state === 'owned_site_explanation_live_media_withdrawn_pending_rebuild', 'release state must record the current visual decision');
requireValue(release.visualDecision?.registerPath === 'public/press/visual-publication-register.json', 'release must point to the visual-review register');
requireValue(release.visualDecision?.withdrawnGameplayMedia === true && release.visualDecision?.replacementApproved === false, 'release must not imply replacement gameplay media is approved');
requireValue(release.visualDecision?.firstScreenArtRemoved === true && release.visualDecision?.firstScreenExperience === 'interactive_game_finder', 'release must record the art-free first-screen decision');
requireValue(release.visualDecision?.sharingImageClassification === 'ai_generated_marketing_illustration_not_gameplay', 'sharing-image boundary is missing');
requireValue(release.playIntentDoorway?.intentSpecificSharingEnabled === true && release.playIntentDoorway?.shareRouteLocation === 'URL fragment only', 'intent-specific sharing release is missing');
requireValue(JSON.stringify(release.playIntentDoorway?.shareRouteWords) === JSON.stringify(['wonder', 'create', 'challenge', 'story']), 'intent share route allowlist drifted');
requireValue(release.playIntentDoorway?.sharedChoiceSentToServer === false && release.playIntentDoorway?.recipientContactCollected === false, 'intent sharing privacy boundary drifted');
for (const [key, expected] of Object.entries({ ownedWebsitePublicationAuthorized: true, externalSocialPublicationAuthorized: false, emailOrOutreachSendingAuthorized: false, paidPromotionAuthorized: false, publicRepliesAuthorized: false, externalActionTaken: false })) {
    requireValue(release.authority?.[key] === expected, `authority.${key} must be ${expected}`);
}
for (const [key, expected] of Object.entries({ accountRequired: false, emailSignupEnabled: false, contactCollectionEnabled: false, recipientCollectionEnabled: false, trackingParametersPermitted: false, analyticsDefault: 'denied' })) {
    requireValue(release.privacy?.[key] === expected, `privacy.${key} must be ${expected}`);
}
requireValue(release.verification?.productionVerificationRequired === true, 'production verification must remain required');
requireValue(release.verification?.productionCommit === null && release.verification?.productionDeployId === null, 'production proof must remain empty until this release is live');

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
