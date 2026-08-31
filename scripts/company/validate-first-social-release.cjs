#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const releasePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/content/generated/project-beacon-first-social-release.json');
const sourcePackPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(root, 'docs/company/content/generated/signal-log-release-pack.json');
const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
const sourcePack = JSON.parse(fs.readFileSync(sourcePackPath, 'utf8'));
const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };

function readPng(file) {
    const bytes = fs.readFileSync(file);
    const pngSignature = '89504e470d0a1a0a';
    return {
        signatureValid: bytes.subarray(0, 8).toString('hex') === pngSignature,
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
        sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    };
}

requireValue(release.schemaVersion === 1 && release.id === 'FIRST-SOCIAL-RELEASE-PROJECT-BEACON-2026-08-14', 'First social release identity is invalid.');
requireValue(release.state === 'complete_review_pack_waiting_for_verified_channel_and_kevin_approval', 'First social release must remain a complete, gated review pack.');
requireValue(release.selection?.sourceEntryId === 'UPDATE-001' && release.selection?.destination === 'https://mythicalvoid.com/story/', 'First release must stay bound to the live Project Beacon story note and destination.');
requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(release.selection?.destination || ''), 'First release destination must not contain tracking parameters.');

const sourceItem = sourcePack.items?.find(item => item.id === 'DRAFT-UPDATE-001');
requireValue(Boolean(sourceItem), 'Source-bound Project Beacon draft is missing.');
requireValue(release.drafts?.professionalNetwork?.copy === sourceItem?.drafts?.professionalNetwork?.body, 'Professional draft has drifted from the Latest News source pack.');
requireValue(release.drafts?.videoCommunity?.copy === sourceItem?.drafts?.videoCommunity?.body, 'Video-community draft has drifted from the Latest News source pack.');
requireValue(release.drafts?.professionalNetwork?.channelRef === 'CH-004' && release.drafts?.videoCommunity?.channelRef === 'CH-002', 'Drafts must retain their planned channel references.');

requireValue(Array.isArray(release.assets) && release.assets.length === 2, 'First social release needs exactly one wide and one square asset.');
for (const asset of release.assets || []) {
    const file = path.join(root, asset.path || '');
    requireValue(fs.existsSync(file), `${asset.id || 'asset'} file is missing.`);
    if (!fs.existsSync(file)) continue;
    const png = readPng(file);
    requireValue(png.signatureValid, `${asset.id} must be a real PNG file.`);
    requireValue(png.width === asset.width && png.height === asset.height, `${asset.id} dimensions do not match the record.`);
    requireValue(png.sha256 === asset.sha256, `${asset.id} digest has changed; review and rebind it.`);
    requireValue(asset.classification === 'branded_social_artwork_with_authentic_gameplay_frame', `${asset.id} has the wrong media class.`);
    requireValue(asset.sourceGameplayPath === 'public/press/gameplay/project-beacon-start.png' && fs.existsSync(path.join(root, asset.sourceGameplayPath)), `${asset.id} must retain its authentic source frame.`);
    requireValue(/branded sharing layout, not a raw screenshot/i.test(asset.disclosure || '') && /real gameplay/i.test(asset.disclosure || '') && /no player information/i.test(asset.disclosure || ''), `${asset.id} disclosure must explain the branded layout, real gameplay frame and privacy boundary.`);
    requireValue(asset.publicUrl === `https://mythicalvoid.com/${asset.path.replace(/^public\//, '')}`, `${asset.id} public URL must match its owned path.`);
    requireValue(Boolean(asset.alt) && asset.alt.length >= 40, `${asset.id} needs useful alt text.`);
}

const allText = JSON.stringify(release);
requireValue(!/\bcompanions?\b/i.test(allText), 'First social release uses retired companion wording.');
requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(allText), 'First social release contains an unsupported uniqueness promise.');
requireValue(!/\b\d[\d,.]*\s+(?:players|customers|downloads|followers|visits)\b/i.test(allText), 'First social release contains an unverified audience metric.');
requireValue(release.audience?.childTargetedAdvertising === false && release.audience?.behaviouralTargeting === false && release.audience?.directMinorContact === false, 'Child targeting, behavioural targeting and direct minor contact must remain off.');
requireValue(release.qualityEvidence?.wideArtworkVisuallyReviewed === true && release.qualityEvidence?.squareArtworkVisuallyReviewed === true && release.qualityEvidence?.browserWarningsOrErrorsObserved === false, 'Both artworks must retain clean visual-review evidence.');
requireValue(release.qualityEvidence?.realGameplayLabelShownInArtwork === true && release.qualityEvidence?.generatedMarketingArtworkUsed === false && release.qualityEvidence?.trackingParametersUsed === false, 'Artwork must retain its real-gameplay, no-generated-art and clean-link boundaries.');

for (const [field, expected] of Object.entries({
    officialSocialAccountVerified: false,
    contentApproved: false,
    channelApproved: false,
    publishingAuthorized: false,
    schedulingAuthorized: false,
    replyingAuthorized: false,
    paidPromotionAuthorized: false,
    externalActionPerformed: false
})) requireValue(release.authority?.[field] === expected, `authority.${field} must remain ${expected}.`);
requireValue(release.authority?.approvedBy === null && release.authority?.approvedAt === null && release.authority?.publishedAt === null, 'Approval and publication evidence must not be invented.');
requireValue(/Kevin sees the exact artwork, copy, destination, audience and engagement setting/i.test((release.releaseOrder || []).join(' ')), 'Release order must retain Kevin\'s complete-preview gate.');
requireValue(/adult reply coverage/i.test((release.releaseOrder || []).join(' ')), 'Release order must retain adult reply coverage.');

const storefront = fs.readFileSync(path.join(root, 'src/site/storefront.js'), 'utf8');
const pressManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/press/mythical-void-press-assets.json'), 'utf8'));
const preview = fs.readFileSync(path.join(root, 'scripts/company/project-beacon-social-card.html'), 'utf8');
for (const asset of release.assets || []) {
    const publicPath = `/${asset.path.replace(/^public\//, '')}`;
    requireValue(storefront.includes(publicPath), `${asset.id} is not offered in the public press room.`);
    requireValue(pressManifest.assets?.some(entry => entry.url === asset.publicUrl && entry.kind === asset.classification), `${asset.id} is missing from the press manifest.`);
}
requireValue(preview.includes('REAL GAMEPLAY') && preview.includes('No player information is shown.'), 'Artwork source must retain its gameplay and privacy labels.');

if (errors.length) {
    console.error(`First social release validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log('First social release valid: 2 checked artworks, 2 source-bound drafts, clean story link, no outward authority.');
