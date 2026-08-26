#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { isWithdrawnPublicVisual, readVisualPublicationRegister } = require('./visual-publication-policy.cjs');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative));
const text = relative => read(relative).toString('utf8');
const json = relative => JSON.parse(text(relative));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

const playable = text('public/playable-now/index.html');
const discovery = text('public/discovery.js');
const previews = json('public/press/mythical-void-social-previews.json');
const press = json('public/press/mythical-void-press-assets.json');
const register = readVisualPublicationRegister();
const scripts = json('package.json').scripts;
const fallbackPath = 'public/marketing/mythical-void-creature-universe-hero-v2.webp';
const fallbackBytes = read(fallbackPath);

requireValue(fallbackBytes.subarray(0, 4).toString('ascii') === 'RIFF' && fallbackBytes.subarray(8, 12).toString('ascii') === 'WEBP', 'Temporary sharing fallback must be a real WebP image.');
requireValue(fallbackBytes.length > 400_000, 'Temporary sharing fallback is unexpectedly small.');
requireValue(!isWithdrawnPublicVisual('/marketing/mythical-void-creature-universe-hero-v2.webp', register), 'Temporary sharing fallback is marked withdrawn.');

for (const route of ['/', '/playable-now/']) {
    const page = previews.pages.find(item => item.route === route);
    requireValue(page?.imagePath === fallbackPath, `${route} is not bound to the approved temporary fallback.`);
    requireValue(page?.imageUrl === 'https://mythicalvoid.com/marketing/mythical-void-creature-universe-hero-v2.webp', `${route} sharing image URL is incorrect.`);
    requireValue(page?.width === 1672 && page?.height === 941 && page?.imageType === 'image/webp', `${route} sharing image facts are incorrect.`);
    requireValue(page?.classification === 'ai_generated_marketing_illustration_not_gameplay' && /not gameplay/i.test(page?.disclosure || ''), `${route} must retain the imagined-art boundary.`);
}

requireValue(playable.includes('data-share-game') && playable.includes('data-copy-game') && playable.includes('data-share-status'), 'Playable Now needs native share, copy and accessible status controls.');
requireValue(playable.includes('never asks for their contact details') && playable.includes('adds no tracking code'), 'The sharing privacy promise is missing.');
requireValue(playable.includes('sharing image is AI-generated imagined-universe artwork') && playable.includes('it is not gameplay'), 'The page must explain the sharing artwork boundary.');
requireValue(discovery.includes("var shareUrl = 'https://mythicalvoid.com/playable-now/';"), 'Sharing must use the clean reviewed destination.');
requireValue(discovery.includes('navigator.share(shareData)'), 'Native device sharing is missing.');
requireValue(discovery.includes('navigator.clipboard.writeText(shareUrl)'), 'Clipboard fallback is missing.');
requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(`${playable} ${discovery}`), 'The owned sharing loop must not add tracking parameters.');
requireValue(!/email|phone number|recipient/i.test(discovery), 'The sharing script must not collect contact details.');

const oldShareAsset = press.assets.find(item => item.url?.endsWith('/press/social/mythical-void-share-wide.png'));
requireValue(Boolean(oldShareAsset) && press.mediaLibrary?.defaultAssetState === 'withdrawn_visual_quality_failed_do_not_publish' && isWithdrawnPublicVisual(oldShareAsset.url, register), 'Old sharing artwork must remain withdrawn.');
for (const weakAssetName of ['Mythical Forest phone gameplay', 'Village Heart builder']) {
    requireValue(press.assets.find(item => item.name === weakAssetName)?.state === 'withdrawn_visual_quality_failed_do_not_publish', `${weakAssetName} must remain withdrawn from promotion.`);
}

requireValue(register.authority.ownedPressRoomPublicationAuthorizedForApprovedListOnly === true, 'Owned website publication boundary is missing.');
requireValue(register.authority.externalSocialPublicationAuthorized === false && register.authority.creatorOutreachAuthorized === false && register.authority.paidPromotionAuthorized === false, 'The sharing release must not authorize external posting, outreach or spend.');
requireValue(scripts.build.includes('validate:owned-sharing') && scripts.build.includes('validate:social-previews'), 'Production build must run both sharing validators.');

if (failures.length) {
    console.error(`Owned sharing loop validation failed (${failures.length}):`);
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    preview: fallbackPath,
    dimensions: '1672x941',
    cleanDestination: 'https://mythicalvoid.com/playable-now/',
    nativeShare: true,
    clipboardFallback: true,
    contactCollection: false,
    externalPostingAuthorized: false,
    failures: []
}, null, 2));
