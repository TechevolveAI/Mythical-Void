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
const storefront = text('src/site/storefront.js');
const sharePages = [
    ['public/playable-now/index.html', 'https://mythicalvoid.com/playable-now/#find-your-way'],
    ['public/parents/index.html', 'https://mythicalvoid.com/parents/'],
    ['public/studio/index.html', 'https://mythicalvoid.com/studio/'],
    ['public/nasa-space-science/index.html', 'https://mythicalvoid.com/nasa-space-science/'],
    ['public/educators/index.html', 'https://mythicalvoid.com/educators/']
];
const previews = json('public/press/mythical-void-social-previews.json');
const press = json('public/press/mythical-void-press-assets.json');
const register = readVisualPublicationRegister();
const scripts = json('package.json').scripts;
const fallbackPath = 'public/marketing/mythical-void-creature-universe-hero-v2.webp';
const fallbackBytes = read(fallbackPath);
const brandCardPath = 'public/marketing/mythical-void-brand-link-card-v1.png';
const brandCardBytes = read(brandCardPath);

requireValue(fallbackBytes.subarray(0, 4).toString('ascii') === 'RIFF' && fallbackBytes.subarray(8, 12).toString('ascii') === 'WEBP', 'Temporary sharing fallback must be a real WebP image.');
requireValue(fallbackBytes.length > 400_000, 'Temporary sharing fallback is unexpectedly small.');
requireValue(!isWithdrawnPublicVisual('/marketing/mythical-void-creature-universe-hero-v2.webp', register), 'Temporary sharing fallback is marked withdrawn.');

requireValue(brandCardBytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'Main application sharing card must be a real PNG image.');
requireValue(brandCardBytes.length > 100_000, 'Main application sharing card is unexpectedly small.');
requireValue(!isWithdrawnPublicVisual('/marketing/mythical-void-brand-link-card-v1.png', register), 'Main application sharing card is marked withdrawn.');

const rootPreview = previews.pages.find(item => item.route === '/');
requireValue(rootPreview?.imagePath === brandCardPath && rootPreview?.imageUrl === 'https://mythicalvoid.com/marketing/mythical-void-brand-link-card-v1.png', 'Main application shell is not bound to the labelled brand card.');
requireValue(rootPreview?.width === 1200 && rootPreview?.height === 630 && rootPreview?.imageType === 'image/png', 'Main application sharing-card facts are incorrect.');
requireValue(rootPreview?.classification === 'code_authored_brand_card_with_approved_emblem_not_gameplay' && /brand art.+not gameplay/i.test(rootPreview?.disclosure || ''), 'Main application sharing card must retain its brand-art boundary.');

const playableNowPreview = previews.pages.find(item => item.route === '/playable-now/');
requireValue(playableNowPreview?.imagePath === fallbackPath, '/playable-now/ is not bound to the approved temporary fallback.');
requireValue(playableNowPreview?.imageUrl === 'https://mythicalvoid.com/marketing/mythical-void-creature-universe-hero-v2.webp', '/playable-now/ sharing image URL is incorrect.');
requireValue(playableNowPreview?.width === 1672 && playableNowPreview?.height === 941 && playableNowPreview?.imageType === 'image/webp', '/playable-now/ sharing image facts are incorrect.');
requireValue(playableNowPreview?.classification === 'ai_generated_marketing_illustration_not_gameplay' && /not gameplay/i.test(playableNowPreview?.disclosure || ''), '/playable-now/ must retain the imagined-art boundary.');

requireValue(playable.includes('data-share-game') && playable.includes('data-copy-game') && playable.includes('data-share-status'), 'Playable Now needs native share, copy and accessible status controls.');
requireValue(playable.includes('never asks for their contact details') && playable.includes('adds no tracking code'), 'The sharing privacy promise is missing.');
requireValue(playable.includes('sharing image is AI-generated marketing artwork') && playable.includes('It is not gameplay.'), 'The page must explain the sharing artwork boundary.');
for (const [pagePath, destination] of sharePages) {
    const page = text(pagePath);
    requireValue(page.includes('data-share-card') && page.includes(`data-share-url="${destination}"`), `${pagePath} must use its own clean reviewed destination.`);
    requireValue(page.includes('data-share-title=') && page.includes('data-share-text='), `${pagePath} needs a useful share title and description.`);
    requireValue(page.includes('data-share-game') && page.includes('data-copy-game') && page.includes('data-share-status'), `${pagePath} needs native share, copy and accessible status controls.`);
}
const parents = text('public/parents/index.html');
requireValue(parents.includes('no public player profiles or chat with other players') && parents.includes('no account needed to begin'), 'The family-guide share message must carry the checked trust promise.');
requireValue(parents.includes('does not ask who receives the link') && parents.includes('adds no tracking code'), 'The family-guide sharing privacy promise is missing.');
requireValue(discovery.includes("shareCard.dataset.shareUrl"), 'Sharing must read the reviewed destination from each page.');
requireValue(discovery.includes('navigator.share(shareData)'), 'Native device sharing is missing.');
requireValue(discovery.includes('navigator.clipboard.writeText(shareUrl)'), 'Clipboard fallback is missing.');
requireValue(playable.includes('data-intent-share data-source-area') && discovery.includes("#find-your-way/' + intentId"), 'The four game-finder answers need their own clean sharing route.');
requireValue(discovery.includes('/^#find-your-way\\/(wonder|create|challenge|story)$/') && discovery.includes('sharedIntentId'), 'Shared game-finder routes must be allowlisted and reopen the chosen answer.');
requireValue(storefront.includes("url: 'https://mythicalvoid.com/playable-now/#find-your-way'") && storefront.includes('Hatch a strange alien creature, cross six living realms'), 'Homepage sharing must send the recipient into the game finder with the current game promise.');
requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(`${sharePages.map(([pagePath]) => text(pagePath)).join(' ')} ${discovery}`), 'The owned sharing loop must not add tracking parameters.');
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
    applicationPreview: brandCardPath,
    applicationPreviewDimensions: '1200x630',
    staticFallbackPreview: fallbackPath,
    cleanDestination: 'https://mythicalvoid.com/playable-now/#find-your-way',
    intentSpecificDestinations: ['wonder', 'create', 'challenge', 'story'].map(intent => `https://mythicalvoid.com/playable-now/#find-your-way/${intent}`),
    sharePageCount: sharePages.length,
    shareDestinations: sharePages.map(([, destination]) => destination),
    nativeShare: true,
    clipboardFallback: true,
    contactCollection: false,
    externalPostingAuthorized: false,
    failures: []
}, null, 2));
