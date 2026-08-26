#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const page = fs.readFileSync(path.join(root, 'public/playable-now/index.html'), 'utf8');
const press = fs.readFileSync(path.join(root, 'src/site/storefront.js'), 'utf8');
const release = JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/generated/playable-now-discovery-release.json'), 'utf8'));
const videoManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/press/gameplay-video/manifest.json'), 'utf8'));
const screenshotManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/press/gameplay/manifest.json'), 'utf8'));
const rendererManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/press/gameplay/real-creature-showcase/renderer-manifest.json'), 'utf8'));
const socialManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/press/social-video/manifest.json'), 'utf8'));
const creatorManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/press/creator-kit/manifest.json'), 'utf8'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(root, file));

requireValue(page.includes('<link rel="canonical" href="https://mythicalvoid.com/playable-now/">'), 'canonical URL is missing');
requireValue((page.match(/<h1(?:\s[^>]*)?>/g) || []).length === 1, 'page must have exactly one main heading');
requireValue(page.includes('See the world. Then enter the Void.'), 'clear first-screen promise is missing');
requireValue(page.includes('IN-GAME STORY MOMENT // 3.17 SECONDS'), 'lead media is not plainly labelled');
requireValue(page.includes('not a claim that it shows platforming or combat'), 'lead media boundary is missing');
requireValue(page.includes('No download. No account. No payment details needed to start.'), 'first-screen access answer is missing');
requireValue(page.includes('NASA does not endorse Mythical Void.'), 'NASA non-endorsement is missing');
requireValue(page.includes('AI-generated marketing illustration') && page.includes('not gameplay'), 'imagined-art boundary is missing');
requireValue(!/\bcompanions?\b/i.test(page), 'retired companion wording is present');
requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(page), 'unsupported uniqueness promise is present');
requireValue(!/<form\b/i.test(page), 'page must not collect contact details');
requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(page), 'page contains a tracking parameter');

const playLinks = [...page.matchAll(/href="(\/play\/[^\"]*)"/g)].map(match => match[1]);
requireValue(playLinks.length >= release.page?.directPlayLinkMinimum, 'page needs at least three direct play links');
requireValue(playLinks.every(link => link === '/play/'), 'every play link must use the clean owned route');

let structured;
try { structured = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]); }
catch (error) { failures.push(`structured data is invalid: ${error.message}`); }
const videoObject = (structured || []).find(item => item?.['@type'] === 'VideoObject');
requireValue(videoObject?.duration === 'PT3.17S', 'structured video duration drifted');

const video = videoManifest.asset || {};
const evidence = release.authenticStoryMoment || {};
const videoBytes = read('public/press/gameplay-video/mythical-forest-authentic-gameplay.mp4');
const posterBytes = read('public/press/gameplay-video/mythical-forest-authentic-gameplay-poster.png');
requireValue(sha256(videoBytes) === video.sha256 && video.sha256 === evidence.videoSha256, 'video fingerprint drifted');
requireValue(sha256(posterBytes) === video.posterSha256 && video.posterSha256 === evidence.posterSha256, 'video poster fingerprint drifted');
requireValue(video.durationSeconds === 3.17 && video.width === 1440 && video.height === 810, 'lead video must remain a 3.17-second landscape capture');
requireValue(video.classification === 'authentic_running_build_story_moment', 'video must remain classified as an in-game story moment');

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
    requireValue(Boolean(capture), `${publicPath} is missing from the screenshot record`);
    if (capture) requireValue(sha256(read(`public${publicPath}`)) === capture.sha256, `${publicPath} fingerprint drifted`);
    requireValue(page.includes(`src="${publicPath}"`), `${publicPath} is missing from the page`);
}
for (const weakLead of ['/press/gameplay/realm-reef.png', '/press/gameplay/village-base-builder.png']) {
    requireValue(!page.includes(weakLead), `${weakLead} returned to the Playable Now gallery`);
    requireValue(!press.includes(weakLead), `${weakLead} returned to the public press gallery`);
}
requireValue(!page.includes('/press/gameplay/creature-cosmic-egg-reveal.png'), 'withdrawn hatch screenshot returned to Playable Now');
requireValue(!press.includes('/press/gameplay/creature-cosmic-egg-reveal.png'), 'withdrawn hatch screenshot returned to the press gallery');

requireValue(press.includes('The public media library is being rebuilt.'), 'public visual-library withdrawal notice is missing');
requireValue(press.includes('No gameplay download pack is approved.'), 'public gameplay download decision is missing');
requireValue(!press.includes('id="real-gameplay-social-video"'), 'withdrawn social pack is still exposed in the press room');
requireValue(!press.includes('id="creator-download-kit"'), 'withdrawn creator download is still exposed in the press room');
requireValue(!press.includes('<video'), 'withdrawn gameplay video is still embedded in the press room');
requireValue(socialManifest.state === 'withdrawn_visual_quality_failed_do_not_publish', 'social-video manifest is not withdrawn');
requireValue(creatorManifest.state === 'withdrawn_visual_quality_failed_do_not_publish', 'creator-kit manifest is not withdrawn');
requireValue(socialManifest.authority?.ownedPressRoomPublicationAuthorized === false, 'withdrawn social media still permits owned press publication');
requireValue(creatorManifest.authority?.truthfulEditorialUsePermitted === false, 'withdrawn creator kit still permits editorial use');

requireValue(sha256(Buffer.from(page)) === release.page?.sha256, 'page fingerprint drifted');
requireValue(release.state === 'owned_site_visual_quality_correction_live_and_verified', 'visual-quality correction state drifted');
requireValue(
    release.verification?.desktopVisualReviewPassed === true &&
    release.verification?.phoneVisualReviewPassed === true &&
    release.verification?.motionContactSheetReviewPassed === true &&
    release.verification?.productionUrlVerified === true &&
    /^[0-9a-f]{40}$/.test(release.verification?.productionCommit || '') &&
    /^[0-9a-f]{24}$/.test(release.verification?.productionDeployId || ''),
    'review or exact production evidence drifted'
);

console.log(JSON.stringify({
    valid: failures.length === 0,
    leadMedia: 'in-game Mythical Forest story moment',
    leadVideoSeconds: video.durationSeconds,
    selectedScreenshots: screenshotPaths.length,
    withdrawnSocialPack: true,
    failures
}, null, 2));
if (failures.length) process.exit(1);
