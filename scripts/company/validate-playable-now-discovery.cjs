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
const rendererManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/press/gameplay/real-creature-showcase/renderer-manifest.json'), 'utf8'));
const signalSource = JSON.parse(fs.readFileSync(path.join(root, 'public/updates/releases.json'), 'utf8'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(root, file));

requireValue(page.includes('<link rel="canonical" href="https://mythicalvoid.com/playable-now/">'), 'canonical URL is missing');
requireValue(page.includes('<meta name="robots" content="index, follow, max-image-preview:large, max-video-preview:-1">'), 'page must allow useful search and video previews');
requireValue((page.match(/<h1(?:\s[^>]*)?>/g) || []).length === 1, 'page must have exactly one main heading');
requireValue(page.includes('See the world. Then enter the Void.'), 'plain first-screen promise is missing');
requireValue(page.includes('No download. No account. No payment details needed to start.'), 'first-screen access answer is missing');
requireValue(page.includes('Early access') && /still (?:growing|in early access)/i.test(page), 'early-access boundary is missing');
requireValue(page.includes('NASA does not endorse Mythical Void.'), 'NASA non-endorsement is missing');
requireValue(page.includes('AI-generated marketing illustration') && page.includes('not gameplay'), 'marketing-art boundary is missing');
requireValue(page.includes('IN-GAME STORY MOMENT // 3.17 SECONDS') && page.includes('not a claim that it shows platforming or combat'), 'story-moment video boundary is missing');
requireValue(!/\bcompanions?\b/i.test(page), 'retired companion wording is present');
requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(page), 'unsupported creature-uniqueness promise is present');
requireValue(!/<form\b/i.test(page), 'page must not open contact or signup collection');
requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(page), 'page contains a tracking parameter');
requireValue(!/NASA (?:made|makes|endorses|partners with) Mythical Void/i.test(page), 'page implies a NASA relationship');
requireValue(page.includes('data-share-game') && page.includes('data-copy-game') && page.includes('data-share-status'), 'clean sharing controls are missing');
requireValue(page.includes('never asks for their contact details') && page.includes('adds no tracking code'), 'sharing privacy explanation is missing');
requireValue(page.includes('https://mythicalvoid.com/press/social/mythical-void-share-wide.png'), 'reviewed sharing preview metadata is missing');
requireValue(page.includes('labelled imagined-universe artwork') && !page.includes('sharing image is branded Project Beacon artwork'), 'sharing-image disclosure has drifted');

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
requireValue(videoObject?.duration === 'PT3.17S', 'structured video duration drifted');

const video = videoManifest.asset || {};
const videoBytes = read('public/press/gameplay-video/mythical-forest-authentic-gameplay.mp4');
const posterBytes = read('public/press/gameplay-video/mythical-forest-authentic-gameplay-poster.png');
requireValue(sha256(videoBytes) === video.sha256 && video.sha256 === release.authenticStoryMoment?.videoSha256, 'video fingerprint drifted');
requireValue(sha256(posterBytes) === video.posterSha256 && video.posterSha256 === release.authenticStoryMoment?.posterSha256, 'video poster fingerprint drifted');
requireValue(video.durationSeconds === 3.17 && release.authenticStoryMoment?.videoDurationSeconds === 3.17, 'video duration proof drifted');
requireValue(video.width === 1440 && video.height === 810 && video.classification === 'authentic_running_build_story_moment', 'video is not the reviewed landscape story moment');
requireValue(videoManifest.ownedWebsiteProofUseAuthorized === true && videoManifest.externalPromotionAuthorized === false && videoManifest.kevinApprovalRequiredBeforeExternalPublication === true, 'video authority boundary drifted');
requireValue(screenshotManifest.ownedWebsiteProofUseAuthorized === true && screenshotManifest.externalPromotionAuthorized === false && screenshotManifest.kevinApprovalRequiredBeforeExternalPublication === true, 'screenshot authority boundary drifted');

const screenshotPaths = [
    '/press/gameplay/project-beacon-start.png',
    '/press/gameplay/real-creature-showcase/real-creature-showcase-wide.png',
    '/press/gameplay/mythical-forest-arrival-wide.png',
    '/press/gameplay/nasa-apollo11-real-space-discovery.png'
];
for (const publicPath of screenshotPaths) {
    if (publicPath.includes('/real-creature-showcase/')) {
        requireValue(rendererManifest.gallery?.sha256 === sha256(read(`public${publicPath}`)), `${publicPath} renderer fingerprint drifted`);
        requireValue(rendererManifest.presentationBoundary?.includes('not a playable game scene'), `${publicPath} lost its renderer-proof boundary`);
        requireValue(page.includes(`src="${publicPath}"`), `${publicPath} is missing from the page`);
        continue;
    }
    const capture = screenshotManifest.captures?.find(item => item.publicPath === publicPath);
    requireValue(Boolean(capture), `${publicPath} is missing from the gameplay manifest`);
    if (capture) requireValue(sha256(read(`public${publicPath}`)) === capture.sha256, `${publicPath} fingerprint drifted`);
    requireValue(page.includes(`src="${publicPath}"`), `${publicPath} is missing from the page`);
}

requireValue(sha256(Buffer.from(page)) === release.page?.sha256, 'page fingerprint drifted');
requireValue(release.state === 'owned_site_visual_quality_correction_live_and_verified', 'release state must retain the verified visual-quality correction');
requireValue(release.authenticStoryMoment?.screenshotCount === 4 && release.authenticStoryMoment?.generatedFramesUsed === false && release.authenticStoryMoment?.playerIdentityUsed === false && release.authenticStoryMoment?.personalSaveUsed === false && release.authenticStoryMoment?.platformingOrCombatClaimed === false, 'story-moment proof or privacy boundary drifted');
for (const [key, expected] of Object.entries({ ownedWebsitePublicationAuthorized: true, externalSocialPublicationAuthorized: false, emailOrOutreachSendingAuthorized: false, paidPromotionAuthorized: false, publicRepliesAuthorized: false, externalActionTaken: false })) {
    requireValue(release.authority?.[key] === expected, `authority.${key} must be ${expected}`);
}
for (const [key, expected] of Object.entries({ accountRequired: false, emailSignupEnabled: false, contactCollectionEnabled: false, recipientCollectionEnabled: false, trackingParametersPermitted: false, analyticsDefault: 'denied' })) {
    requireValue(release.privacy?.[key] === expected, `privacy.${key} must be ${expected}`);
}
requireValue(release.verification?.desktopVisualReviewPassed === true && release.verification?.phoneVisualReviewPassed === true && release.verification?.phoneWidth === 390 && release.verification?.horizontalOverflowObserved === false && release.verification?.videoDurationObservedSeconds === 3.166667 && release.verification?.motionContactSheetReviewPassed === true && release.verification?.directPlayNavigationVerified === true && release.verification?.productionUrlVerified === true && /^[a-f0-9]{40}$/.test(release.verification?.productionCommit || '') && Boolean(release.verification?.productionDeployId), 'release must retain its visual, video, play-route and exact production checks');

for (const [file, fragment, label] of [
    ['public/sitemap.xml', '<loc>https://mythicalvoid.com/playable-now/</loc>', 'sitemap'],
    ['public/llms.txt', 'See real gameplay and the game at a glance: https://mythicalvoid.com/playable-now/', 'machine-readable site guide'],
    ['public/press/mythical-void-press-assets.json', '"playableNowUrl": "https://mythicalvoid.com/playable-now/"', 'press manifest'],
    ['src/site/storefront.js', 'href="/playable-now/">Watch real gameplay</a>', 'homepage first screen'],
    ['src/site/storefront.js', 'href="/playable-now/">Game at a glance</a>', 'press room'],
    ['netlify.toml', 'from = "/playable-now/"', 'Netlify route'],
    ['vercel.json', '"source": "/playable-now/"', 'Vercel route']
]) requireValue(fs.readFileSync(path.join(root, file), 'utf8').includes(fragment), `${label} discovery is missing`);

const signal = signalSource.entries?.find(entry => entry.id === 'SIGNAL-015');
requireValue(signal?.status === 'live' && signal?.destination === '/playable-now/' && signal?.image === video.posterPublicPath, 'SIGNAL-015 is missing or drifted');
requireValue(fs.readFileSync(path.join(root, 'public/updates/feed.xml'), 'utf8').includes('A better standard for showing the game'), 'RSS feed is missing the visual-quality correction');
requireValue(JSON.parse(fs.readFileSync(path.join(root, 'public/updates/feed.json'), 'utf8')).items?.some(item => item.external_url === 'https://mythicalvoid.com/playable-now/'), 'JSON feed is missing the playable page');

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
