#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const releasePath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'docs/company/content/generated/father-son-story-social-release.json');
const sourcePackPath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'docs/company/content/generated/signal-log-release-pack.json');
const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
const sourcePack = JSON.parse(fs.readFileSync(sourcePackPath, 'utf8'));
const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };

function readPng(file) {
    const bytes = fs.readFileSync(file);
    return {
        signatureValid: bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a',
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
        sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    };
}

requireValue(release.schemaVersion === 1 && release.id === 'FATHER-SON-STORY-SOCIAL-RELEASE-2026-08-14', 'Founder-story release identity is invalid.');
requireValue(release.state === 'complete_review_pack_waiting_for_verified_channel_and_kevin_approval', 'Founder-story release must remain a gated review pack.');
requireValue(release.selection?.sourceEntryId === 'SIGNAL-007', 'Founder-story release must stay bound to SIGNAL-007.');
requireValue(release.selection?.destination === 'https://mythicalvoid.com/press/#father-son-story-social-assets' && release.selection?.storyDestination === 'https://mythicalvoid.com/studio/', 'Founder-story owned destinations have drifted.');
requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(JSON.stringify(release.selection || {})), 'Founder-story destinations must not contain tracking parameters.');

const sourceItem = sourcePack.items?.find(item => item.id === 'DRAFT-SIGNAL-007');
requireValue(Boolean(sourceItem), 'Source-bound founder-story draft is missing.');
requireValue(release.drafts?.professionalNetwork?.copy === sourceItem?.drafts?.professionalNetwork?.body, 'Professional draft has drifted from SIGNAL-007.');
requireValue(release.drafts?.videoCommunity?.copy === sourceItem?.drafts?.videoCommunity?.body, 'Video-community draft has drifted from SIGNAL-007.');
requireValue(release.drafts?.professionalNetwork?.channelRef === 'CH-004' && release.drafts?.videoCommunity?.channelRef === 'CH-002', 'Drafts must retain their planned channel references.');

requireValue(Array.isArray(release.assets) && release.assets.length === 2, 'Founder-story release needs exactly one wide and one square asset.');
for (const asset of release.assets || []) {
    const file = path.join(root, asset.path || '');
    requireValue(fs.existsSync(file), `${asset.id || 'asset'} file is missing.`);
    if (!fs.existsSync(file)) continue;
    const png = readPng(file);
    requireValue(png.signatureValid, `${asset.id} must be a real PNG file.`);
    requireValue(png.width === asset.width && png.height === asset.height, `${asset.id} dimensions do not match the record.`);
    requireValue(png.sha256 === asset.sha256, `${asset.id} digest has changed; review and rebind it.`);
    requireValue(asset.classification === 'branded_founder_story_artwork_with_ai_marketing_background_and_authentic_gameplay_frame', `${asset.id} has the wrong media class.`);
    requireValue(asset.sourceGameplayPath === 'public/press/gameplay/project-beacon-live-egg.png' && fs.existsSync(path.join(root, asset.sourceGameplayPath)), `${asset.id} must retain its authentic source frame.`);
    requireValue(asset.sourceMarketingArtworkPath === 'public/marketing/mythical-void-creature-universe-hero-v2.webp' && fs.existsSync(path.join(root, asset.sourceMarketingArtworkPath)), `${asset.id} must retain its disclosed marketing-art source.`);
    requireValue(/founder-story sharing layout, not a raw screenshot/i.test(asset.disclosure || '') && /not gameplay/i.test(asset.disclosure || '') && /real gameplay/i.test(asset.disclosure || '') && /no player information/i.test(asset.disclosure || '') && /identifying detail of the child/i.test(asset.disclosure || ''), `${asset.id} disclosure must explain the layout, marketing art, gameplay, privacy and child-identity boundaries.`);
    requireValue(asset.publicUrl === `https://mythicalvoid.com/${asset.path.replace(/^public\//, '')}`, `${asset.id} public URL must match its owned path.`);
    requireValue(Boolean(asset.alt) && asset.alt.length >= 50, `${asset.id} needs useful alt text.`);
}

const allText = JSON.stringify(release);
requireValue(!/\bcompanions?\b/i.test(allText), 'Founder-story release uses retired companion wording.');
requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(allText), 'Founder-story release contains an unsupported uniqueness promise.');
requireValue(!/\b\d[\d,.]*\s+(?:players|customers|downloads|followers|visits)\b/i.test(allText), 'Founder-story release contains an unverified audience metric.');
requireValue(release.audience?.childTargetedAdvertising === false && release.audience?.behaviouralTargeting === false && release.audience?.directMinorContact === false, 'Child targeting, behavioural targeting and direct minor contact must remain off.');
requireValue(release.identityBoundary?.childPhotoUsed === false && release.identityBoundary?.childNameUsed === false && release.identityBoundary?.childDirectQuoteUsed === false && release.identityBoundary?.childContactDetailUsed === false && release.identityBoundary?.childIdentifyingDetailUsed === false && release.identityBoundary?.futureExpansionRequiresKevinReview === true, 'The child-identity boundary must remain closed and Kevin-gated.');
requireValue(release.identityBoundary?.approvedPublicDetail === "Kevin's son was nine years old when the project began", 'The public child detail must stay narrow and exact.');
requireValue(release.qualityEvidence?.wideArtworkVisuallyReviewed === true && release.qualityEvidence?.squareArtworkVisuallyReviewed === true && release.qualityEvidence?.browserWarningsOrErrorsObserved === false, 'Both artworks must retain clean visual-review evidence.');
requireValue(release.qualityEvidence?.realGameplayLabelShownInArtwork === true && release.qualityEvidence?.marketingArtworkNotGameplayDisclosureShown === true && release.qualityEvidence?.childIdentityBoundaryShown === true && release.qualityEvidence?.trackingParametersUsed === false, 'Artwork must retain its gameplay, marketing-art, child-identity and clean-link boundaries.');

for (const [field, expected] of Object.entries({ officialSocialAccountVerified: false, contentApproved: false, channelApproved: false, publishingAuthorized: false, schedulingAuthorized: false, replyingAuthorized: false, paidPromotionAuthorized: false, externalActionPerformed: false })) requireValue(release.authority?.[field] === expected, `authority.${field} must remain ${expected}.`);
requireValue(release.authority?.approvedBy === null && release.authority?.approvedAt === null && release.authority?.publishedAt === null, 'Approval and publication evidence must not be invented.');
requireValue(/Kevin sees the exact artwork, copy, destination, audience, child-identity boundary and engagement setting/i.test((release.releaseOrder || []).join(' ')), 'Release order must retain Kevin\'s complete-preview gate.');
requireValue(/adult reply coverage/i.test((release.releaseOrder || []).join(' ')), 'Release order must retain adult reply coverage.');

const storefront = fs.readFileSync(path.join(root, 'src/site/storefront.js'), 'utf8');
const pressManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/press/mythical-void-press-assets.json'), 'utf8'));
const preview = fs.readFileSync(path.join(root, 'scripts/company/father-son-story-social-card.html'), 'utf8');
for (const asset of release.assets || []) {
    const publicPath = `/${asset.path.replace(/^public\//, '')}`;
    requireValue(storefront.includes(publicPath), `${asset.id} is not offered in the public press room.`);
    requireValue(pressManifest.assets?.some(entry => entry.url === asset.publicUrl && entry.kind === asset.classification), `${asset.id} is missing from the press manifest.`);
}
requireValue(preview.includes('REAL GAMEPLAY') && preview.includes('AI-generated marketing illustration, not gameplay') && preview.includes('No image or identifying detail of the child is used.'), 'Artwork source must retain its gameplay, marketing-art and child-identity labels.');

if (errors.length) {
    console.error(`Founder-story social release validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log('Founder-story social release valid: 2 checked artworks, 2 source-bound drafts, child identity protected, no outward authority.');
