#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative));
const text = relative => read(relative).toString('utf8');
const json = relative => JSON.parse(text(relative));
const sha256 = relative => crypto.createHash('sha256').update(read(relative)).digest('hex');
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

const release = json('docs/company/content/generated/owned-sharing-loop-release.json');
const previewSource = text(release.preview.sourcePath);
const previewBytes = read(release.preview.path);
const playable = text(release.sharingJourney.pagePath);
const discovery = text(release.sharingJourney.scriptPath);
const previews = json('public/press/mythical-void-social-previews.json');
const press = json('public/press/mythical-void-press-assets.json');
const scripts = json('package.json').scripts;

requireValue(release.schemaVersion === 1 && release.state === 'owned_site_release_live_and_verified', 'Owned sharing release identity or state is invalid.');
requireValue(sha256(release.preview.path) === release.preview.sha256, 'Sharing preview fingerprint has drifted.');
requireValue(sha256(release.preview.sourcePath) === release.preview.sourceSha256, 'Sharing preview source fingerprint has drifted.');
requireValue(sha256(release.sharingJourney.pagePath) === release.sharingJourney.pageSha256, 'Playable Now sharing page fingerprint has drifted.');
requireValue(sha256(release.sharingJourney.scriptPath) === release.sharingJourney.scriptSha256, 'Playable Now sharing script fingerprint has drifted.');
requireValue(previewBytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'Sharing preview must be a real PNG.');
requireValue(previewBytes.readUInt32BE(16) === 1200 && previewBytes.readUInt32BE(20) === 630, 'Sharing preview must be 1200×630.');
requireValue(previewBytes.length > 500_000, 'Sharing preview is unexpectedly small.');

requireValue(previewSource.includes('<h1>What will <span>you</span> hatch?</h1>'), 'Sharing preview lost its one clear question.');
requireValue(previewSource.includes('FREE CREATURE ADVENTURE'), 'Sharing preview lost the plain-language game category.');
requireValue(previewSource.includes('PLAY IN YOUR BROWSER'), 'Sharing preview lost its readable action.');
requireValue(previewSource.includes('IMAGINED UNIVERSE ART'), 'Sharing preview must visibly label the artwork boundary.');
requireValue(!/class=["'](?:summary|disclaimer|phone|game-frame)/.test(previewSource), 'Sharing preview has regained dense miniature-page content.');

for (const route of ['/', '/playable-now/']) {
    const page = previews.pages.find(item => item.route === route);
    requireValue(page?.imagePath === release.preview.path, `${route} is not bound to the reviewed sharing preview.`);
    requireValue(page?.imageUrl === `https://mythicalvoid.com/${release.preview.path.replace(/^public\//, '')}`, `${route} sharing image URL is incorrect.`);
    requireValue(page?.classification === 'ai_generated_marketing_illustration' && /not gameplay/i.test(page?.disclosure || ''), `${route} must retain the imagined-art boundary.`);
}

requireValue(playable.includes('data-share-game') && playable.includes('data-copy-game') && playable.includes('data-share-status'), 'Playable Now needs native share, copy and accessible status controls.');
requireValue(playable.includes('never asks for their contact details') && playable.includes('adds no tracking code'), 'The sharing privacy promise is missing.');
requireValue(playable.includes('labelled imagined-universe artwork') && playable.includes('it is not gameplay'), 'The page must explain the sharing artwork boundary.');
requireValue(discovery.includes("var shareUrl = 'https://mythicalvoid.com/playable-now/';"), 'Sharing must use the clean reviewed destination.');
requireValue(discovery.includes('navigator.share(shareData)'), 'Native device sharing is missing.');
requireValue(discovery.includes('navigator.clipboard.writeText(shareUrl)'), 'Clipboard fallback is missing.');
requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(`${playable} ${discovery}`), 'The owned sharing loop must not add tracking parameters.');
requireValue(!/email|phone number|recipient/i.test(discovery), 'The sharing script must not collect contact details.');

const shareAsset = press.assets.find(item => item.url?.endsWith('/press/social/mythical-void-share-wide.png'));
requireValue(Boolean(shareAsset) && /imagined universe art, not gameplay/i.test(shareAsset.description || ''), 'Press manifest must describe the sharing preview truthfully.');
for (const weakAssetName of ['Mythical Forest phone gameplay', 'Village Heart builder']) {
    requireValue(press.assets.find(item => item.name === weakAssetName)?.state === 'withdrawn_visual_quality_failed_do_not_publish', `${weakAssetName} must remain withdrawn from promotion.`);
}

requireValue(Object.values(release.humanReview).every(Boolean), 'Every recorded human preview review must be complete.');
requireValue(release.verification.productionBuildPassed === true && release.verification.desktopBrowserReviewed === true && release.verification.phoneBrowserReviewed === true && release.verification.clipboardFallbackVerified === true, 'The owned sharing loop must retain its build, desktop, phone and copy-link checks.');
requireValue(release.verification.productionUrlVerified === true && /^[a-f0-9]{40}$/.test(release.verification.productionCommit || '') && Boolean(release.verification.productionDeployId), 'Production verification must identify the exact live commit and deploy.');
requireValue(release.verification.liveHomepagePreviewVerified === true && release.verification.livePlayablePreviewVerified === true && release.verification.liveImageDimensionsVerified === '1200x630' && release.verification.liveClipboardFallbackVerified === true && release.verification.liveBrokenImageCount === 0 && release.verification.liveHorizontalOverflowObserved === false, 'Live sharing checks have drifted or are incomplete.');
requireValue(release.authority.ownedWebsitePublicationAuthorized === true, 'Owned website publication must be authorized.');
requireValue(release.authority.autonomousSocialPostingAuthorized === false && release.authority.emailOrOutreachSendingAuthorized === false && release.authority.paidPromotionAuthorized === false, 'The owned sharing release must not authorize external posting, outreach or spend.');
requireValue(scripts.build.includes('validate:owned-sharing') && scripts.build.includes('validate:social-previews'), 'Production build must run both sharing validators.');

if (failures.length) {
    console.error(`Owned sharing loop validation failed (${failures.length}):`);
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    preview: release.preview.path,
    dimensions: `${release.preview.width}x${release.preview.height}`,
    cleanDestination: release.sharingJourney.cleanUrl,
    nativeShare: true,
    clipboardFallback: true,
    contactCollection: false,
    externalPostingAuthorized: false,
    failures: []
}, null, 2));
