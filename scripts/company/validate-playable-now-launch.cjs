const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const campaignPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/content/campaigns/playable-now-launch.json');
const claimsPath = path.join(root, 'docs/company/content/claims.json');
const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));
const claims = JSON.parse(fs.readFileSync(claimsPath, 'utf8'));
const knownClaims = new Set(claims.claims.map((claim) => claim.id));
const errors = [];

const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};

requireValue(campaign.canonicalUrl === 'https://mythicalvoid.com/', 'Campaign must use the canonical website URL.');
requireValue(campaign.authority?.publishingAuthorized === false, 'Publishing must remain gated.');
requireValue(campaign.authority?.externalActionAuthorized === false, 'External action must remain gated.');
requireValue(campaign.authority?.paidPromotionAuthorized === false, 'Paid promotion must remain gated.');
requireValue(Array.isArray(campaign.content) && campaign.content.length >= 6, 'Campaign needs at least six useful content units.');
requireValue(JSON.stringify(campaign.firstWeekSequence?.map(item => [item.day, item.contentId])) === JSON.stringify([[1, 'PN-002'], [3, 'PN-001'], [5, 'PN-003']]), 'First-week sequence must lead with founder, playable-now and creature-system posts on days 1, 3 and 5.');
for (const [field, expected] of Object.entries({ weakGameplayMediaUsed: false, uploadedMediaRequired: false, automaticLinkPreviewsOnly: true, commentsAndRepliesAuthorized: false, directMessagesToChildrenPermitted: false, kevinExactPreviewApprovalRequired: true, verifiedChannelRequired: true, namedReplyOwnerRequired: true, namedBackupRequired: true, coverageWindowRequired: true })) {
    requireValue(campaign.firstWeekPublishing?.[field] === expected, `First-week publishing boundary ${field} must be ${expected}.`);
}

const publicCopy = campaign.content.map((item) => item.copy).join('\n');
requireValue(!/\bcompanions?\b/i.test(publicCopy), 'Public campaign copy must use creature language, not companion language.');
requireValue(!/\bno two creatures (?:are )?alike\b/i.test(publicCopy), 'Campaign must not make an absolute uniqueness claim.');
requireValue(!/\bevery creature is unique\b/i.test(publicCopy), 'Campaign must not make an absolute uniqueness claim.');

for (const item of campaign.content) {
    requireValue(/^PN-\d{3}$/.test(item.id || ''), `Invalid content id: ${item.id || '(missing)'}.`);
    requireValue(Boolean(item.title && item.audience && item.recommendedChannel), `${item.id} needs a title, audience and channel.`);
    requireValue(/^https:\/\/mythicalvoid\.com\/[a-z0-9-]*\/$/.test(item.destinationUrl || ''), `${item.id} needs one clean owned destination URL.`);
    requireValue(item.copy?.includes(item.destinationUrl), `${item.id} must include its exact destination URL.`);
    requireValue(Array.isArray(item.claimIds) && item.claimIds.length > 0, `${item.id} needs claim references.`);
    for (const claimId of item.claimIds || []) {
        requireValue(knownClaims.has(claimId), `${item.id} references unknown claim ${claimId}.`);
    }
    requireValue(Boolean(item.assetType && item.disclosure && item.approvalState), `${item.id} needs asset, disclosure and approval state.`);
    requireValue(item.approvalState !== 'publication_ready', `${item.id} cannot be publication-ready before an account and approval exist.`);
}

const firstWeekIds = campaign.firstWeekSequence?.map(item => item.contentId) || [];
const firstWeekPreviewPages = {
    'PN-002': { destinationUrl: 'https://mythicalvoid.com/studio/', file: 'public/studio/index.html' },
    'PN-001': { destinationUrl: 'https://mythicalvoid.com/playable-now/', file: 'public/playable-now/index.html' },
    'PN-003': { destinationUrl: 'https://mythicalvoid.com/creature-genetics/', file: 'public/creature-genetics/index.html' }
};
for (const id of firstWeekIds) {
    const item = campaign.content.find(candidate => candidate.id === id);
    const preview = firstWeekPreviewPages[id];
    requireValue(Boolean(item), `First-week sequence references missing content ${id}.`);
    requireValue(item?.destinationUrl === preview?.destinationUrl, `${id} points to the wrong first-week destination.`);
    requireValue(item?.presentation === 'automatic_link_preview_only', `${id} must use only the reviewed automatic link preview.`);
    requireValue(item?.asset === 'public/marketing/mythical-void-creature-universe-hero-v2.webp', `${id} must use the reviewed creature-universe preview.`);
    requireValue(item?.assetType === 'ai_generated_marketing_illustration' && /not gameplay/i.test(item?.disclosure || ''), `${id} must disclose the preview as marketing artwork, not gameplay.`);
    requireValue(item?.approvalState === 'awaiting_kevin_and_channel', `${id} must remain gated on Kevin and a verified channel.`);
    const previewHtml = preview ? fs.readFileSync(path.join(root, preview.file), 'utf8') : '';
    requireValue(/<meta property="og:title" content="[^"]{12,}">/.test(previewHtml) && /<meta property="og:description" content="[^"]{40,}">/.test(previewHtml), `${id} automatic preview title or description is missing.`);
    requireValue(previewHtml.includes('<meta property="og:image" content="https://mythicalvoid.com/marketing/mythical-void-creature-universe-hero-v2.webp">') && previewHtml.includes('<meta property="og:image:alt" content="An imagined luminous universe filled with many possible alien creature forms">'), `${id} automatic preview image or description has drifted.`);
}

if (errors.length) {
    console.error(`Playable Now launch validation failed (${errors.length}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Playable Now launch pack valid: ${campaign.content.length} content units, 3 reviewed automatic previews, publishing gated, clean page-specific links and creature language confirmed.`);
