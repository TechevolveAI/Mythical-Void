#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const register = JSON.parse(read('public/press/visual-publication-register.json'));
const pressManifest = JSON.parse(read('public/press/mythical-void-press-assets.json'));
const storefront = read('src/site/storefront.js');
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

requireValue(register.state === 'public_media_library_withdrawn_pending_rebuild', 'visual register is not in the withdrawn rebuild state');
requireValue(register.publicApproved?.length === 4, 'approved public list must remain deliberately small and explicit');
requireValue(register.replacementRequirements?.length >= 7, 'replacement visual requirements are incomplete');
requireValue(register.nextCaptureBrief?.length >= 4, 'replacement capture brief is incomplete');
requireValue(register.authority?.externalSocialPublicationAuthorized === false, 'register must not authorize external social publication');
requireValue(register.authority?.creatorOutreachAuthorized === false, 'register must not authorize creator outreach');
requireValue(register.authority?.paidPromotionAuthorized === false, 'register must not authorize paid promotion');

requireValue(pressManifest.mediaLibrary?.state === 'withdrawn_pending_human_visual_rebuild_do_not_publish', 'press manifest does not expose the current media-library decision');
requireValue(pressManifest.mediaLibrary?.defaultAssetState === 'withdrawn_visual_quality_failed_do_not_publish', 'old press assets do not default to withdrawn');
requireValue(pressManifest.realCreatureShowcase?.state === 'withdrawn_visual_quality_failed_do_not_publish', 'creature proof layout is still marked for promotion');
requireValue(pressManifest.sharingResources?.every(item => item.state === 'withdrawn_visual_quality_failed_do_not_publish'), 'old play-and-share resource is still marked for promotion');

for (const requiredCopy of [
    'The public media library is being rebuilt.',
    'No gameplay download pack is approved.',
    'The creature must be visible',
    'Show real play',
    'Watch the whole thing',
    '/press/visual-publication-register.json'
]) requireValue(storefront.includes(requiredCopy), `press room is missing: ${requiredCopy}`);

for (const forbidden of [
    '<video',
    '/press/gameplay-video/mythical-forest-authentic-gameplay.mp4',
    '/press/gameplay/project-beacon-start.png',
    '/press/gameplay/project-beacon-live-egg.png',
    '/press/gameplay/real-creature-showcase/real-creature-showcase-wide.png',
    '/press/gameplay/nasa-apollo11-real-space-discovery.png',
    '/press/social/project-beacon-story-wide.png',
    '/press/social/nasa-stem-discovery-wide.png',
    '/press/social/father-son-story-wide.png',
    '/resources/mythical-void-play-share-card.pdf',
    'READY TO SHARE'
]) requireValue(!storefront.includes(forbidden), `withdrawn public visual or claim remains in the press room: ${forbidden}`);

requireValue(storefront.includes('/marketing/mythical-void-emblem-v3.png'), 'approved emblem download is missing');
requireValue(storefront.includes('AI-generated marketing illustration') && storefront.includes('It is not gameplay footage.'), 'press hero needs a plain artwork disclosure');

console.log(JSON.stringify({
    valid: failures.length === 0,
    approvedPublicDownloads: register.publicApproved.length,
    gameplayDownloadPackApproved: false,
    humanReviewRequired: true,
    failures
}, null, 2));
if (failures.length) process.exit(1);
