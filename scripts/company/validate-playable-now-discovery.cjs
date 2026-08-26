#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const pagePath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'public/playable-now/index.html');
const releasePath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'docs/company/content/generated/playable-now-discovery-release.json');
const page = fs.readFileSync(pagePath, 'utf8');
const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
const videoManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/press/gameplay-video/manifest.json'), 'utf8'));
const screenshotManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/press/gameplay/manifest.json'), 'utf8'));
const signalSource = JSON.parse(fs.readFileSync(path.join(root, 'public/updates/releases.json'), 'utf8'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(root, file));

requireValue(page.includes('<link rel="canonical" href="https://mythicalvoid.com/playable-now/">'), 'canonical URL is missing');
requireValue(page.includes('<meta name="robots" content="index, follow, max-image-preview:large, max-video-preview:-1">'), 'page must allow useful search and video previews');
requireValue((page.match(/<h1(?:\s[^>]*)?>/g) || []).length === 1, 'page must have exactly one main heading');
requireValue(page.includes('See the real game. Then enter the Void.'), 'plain first-screen promise is missing');
requireValue(page.includes('No download. No account. No payment details needed to start.'), 'first-screen access answer is missing');
requireValue(page.includes('Early access') && /still (?:growing|in early access)/i.test(page), 'early-access boundary is missing');
requireValue(page.includes('NASA does not endorse Mythical Void.'), 'NASA non-endorsement is missing');
requireValue(page.includes('AI-generated marketing illustration') && page.includes('not gameplay'), 'marketing-art boundary is missing');
requireValue(page.includes('no generated frames') || page.includes('No generated frames'), 'authentic video boundary is missing');
requireValue(!/\bcompanions?\b/i.test(page), 'retired companion wording is present');
requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(page), 'unsupported creature-uniqueness promise is present');
requireValue(!/<form\b/i.test(page), 'page must not open contact or signup collection');
requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(page), 'page contains a tracking parameter');
requireValue(!/NASA (?:made|makes|endorses|partners with) Mythical Void/i.test(page), 'page implies a NASA relationship');

const playLinks = [...page.matchAll(/href="(\/play\/[^"]*)"/g)].map(match => match[1]);
requireValue(playLinks.length >= release.page?.directPlayLinkMinimum, 'page needs at least three direct play links');
requireValue(playLinks.every(link => link === '/play/'), 'every play link must use the clean owned route');

let structured;
try { structured = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]); }
catch (error) { failures.push(`structured data is invalid: ${error.message}`); }
const types = Array.isArray(structured) ? structured.map(item => item?.['@type']) : [];
for (const type of ['VideoGame', 'VideoObject', 'FAQPage']) requireValue(types.includes(type), `${type} structured data is missing`);
const videoObject = (structured || []).find(item => item?.['@type'] === 'VideoObject');
requireValue(videoObject?.contentUrl === 'https://mythicalvoid.com/press/gameplay-video/mythical-forest-authentic-gameplay.mp4', 'structured video URL drifted');
requireValue(videoObject?.duration === 'PT19.58S', 'structured video duration drifted');

const video = videoManifest.asset || {};
const videoBytes = read('public/press/gameplay-video/mythical-forest-authentic-gameplay.mp4');
const posterBytes = read('public/press/gameplay-video/mythical-forest-authentic-gameplay-poster.png');
requireValue(sha256(videoBytes) === video.sha256 && video.sha256 === release.authenticGameplay?.videoSha256, 'video fingerprint drifted');
requireValue(sha256(posterBytes) === video.posterSha256 && video.posterSha256 === release.authenticGameplay?.posterSha256, 'video poster fingerprint drifted');
requireValue(video.durationSeconds === 19.58 && release.authenticGameplay?.videoDurationSeconds === 19.58, 'video duration proof drifted');
requireValue(video.classification === 'authentic_running_build_gameplay_video', 'video is not classified as authentic gameplay');
requireValue(videoManifest.ownedWebsiteProofUseAuthorized === true && videoManifest.externalPromotionAuthorized === false && videoManifest.kevinApprovalRequiredBeforeExternalPublication === true, 'video authority boundary drifted');
requireValue(screenshotManifest.ownedWebsiteProofUseAuthorized === true && screenshotManifest.externalPromotionAuthorized === false && screenshotManifest.kevinApprovalRequiredBeforeExternalPublication === true, 'screenshot authority boundary drifted');

const screenshotPaths = [
    '/press/gameplay/project-beacon-start.png',
    '/press/gameplay/creature-cosmic-egg-hatch.png',
    '/press/gameplay/realm-reef.png',
    '/press/gameplay/village-base-builder.png'
];
for (const publicPath of screenshotPaths) {
    const capture = screenshotManifest.captures?.find(item => item.publicPath === publicPath);
    requireValue(Boolean(capture), `${publicPath} is missing from the gameplay manifest`);
    if (capture) requireValue(sha256(read(`public${publicPath}`)) === capture.sha256, `${publicPath} fingerprint drifted`);
    requireValue(page.includes(`src="${publicPath}"`), `${publicPath} is missing from the page`);
}

requireValue(sha256(Buffer.from(page)) === release.page?.sha256, 'page fingerprint drifted');
requireValue(release.state === 'owned_site_release_visually_verified_waiting_for_production_verification', 'release state must retain completed visual review while waiting for production verification');
requireValue(release.authenticGameplay?.screenshotCount === 4 && release.authenticGameplay?.generatedFramesUsed === false && release.authenticGameplay?.playerIdentityUsed === false && release.authenticGameplay?.personalSaveUsed === false, 'gameplay proof or privacy boundary drifted');
for (const [key, expected] of Object.entries({ ownedWebsitePublicationAuthorized: true, externalSocialPublicationAuthorized: false, emailOrOutreachSendingAuthorized: false, paidPromotionAuthorized: false, publicRepliesAuthorized: false, externalActionTaken: false })) {
    requireValue(release.authority?.[key] === expected, `authority.${key} must be ${expected}`);
}
for (const [key, expected] of Object.entries({ accountRequired: false, emailSignupEnabled: false, contactCollectionEnabled: false, recipientCollectionEnabled: false, trackingParametersPermitted: false, analyticsDefault: 'denied' })) {
    requireValue(release.privacy?.[key] === expected, `privacy.${key} must be ${expected}`);
}
requireValue(release.verification?.desktopVisualReviewPassed === true && release.verification?.phoneVisualReviewPassed === true && release.verification?.phoneWidth === 390 && release.verification?.horizontalOverflowObserved === false && release.verification?.videoDurationObservedSeconds === 19.583333 && release.verification?.directPlayNavigationVerified === true && release.verification?.productionUrlVerified === false, 'release must retain its visual, video and play-route checks without inventing production verification');

for (const [file, fragment, label] of [
    ['public/sitemap.xml', '<loc>https://mythicalvoid.com/playable-now/</loc>', 'sitemap'],
    ['public/llms.txt', 'See real gameplay and the game at a glance: https://mythicalvoid.com/playable-now/', 'machine-readable site guide'],
    ['public/press/mythical-void-press-assets.json', '"playableNowUrl": "https://mythicalvoid.com/playable-now/"', 'press manifest'],
    ['src/site/storefront.js', 'href="/playable-now/">Watch real gameplay</a>', 'homepage first screen'],
    ['src/site/storefront.js', 'href="/playable-now/">Game at a glance</a>', 'press room'],
    ['netlify.toml', 'from = "/playable-now/"', 'Netlify route'],
    ['vercel.json', '"source": "/playable-now/"', 'Vercel route']
]) requireValue(fs.readFileSync(path.join(root, file), 'utf8').includes(fragment), `${label} discovery is missing`);

const signal = signalSource.entries?.find(entry => entry.id === 'SIGNAL-009');
requireValue(signal?.status === 'live' && signal?.destination === '/playable-now/' && signal?.image === video.posterPublicPath, 'SIGNAL-009 is missing or drifted');
requireValue(fs.readFileSync(path.join(root, 'public/updates/feed.xml'), 'utf8').includes('See the real game before you play'), 'RSS feed is missing SIGNAL-009');
requireValue(JSON.parse(fs.readFileSync(path.join(root, 'public/updates/feed.json'), 'utf8')).items?.[0]?.external_url === 'https://mythicalvoid.com/playable-now/', 'JSON feed is missing the latest playable page');

console.log(JSON.stringify({
    valid: failures.length === 0,
    publicUrl: 'https://mythicalvoid.com/playable-now/',
    directPlayLinks: playLinks.length,
    authenticVideoSeconds: video.durationSeconds,
    authenticScreenshots: screenshotPaths.length,
    analyticsDefault: 'denied',
    externalPublicationAuthorized: false,
    failures
}, null, 2));
if (failures.length) process.exit(1);
