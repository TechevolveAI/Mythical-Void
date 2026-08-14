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

const publicCopy = campaign.content.map((item) => item.copy).join('\n');
requireValue(!/\bcompanions?\b/i.test(publicCopy), 'Public campaign copy must use creature language, not companion language.');
requireValue(!/\bno two creatures (?:are )?alike\b/i.test(publicCopy), 'Campaign must not make an absolute uniqueness claim.');
requireValue(!/\bevery creature is unique\b/i.test(publicCopy), 'Campaign must not make an absolute uniqueness claim.');

for (const item of campaign.content) {
    requireValue(/^PN-\d{3}$/.test(item.id || ''), `Invalid content id: ${item.id || '(missing)'}.`);
    requireValue(Boolean(item.title && item.audience && item.recommendedChannel), `${item.id} needs a title, audience and channel.`);
    requireValue(item.copy?.includes(campaign.canonicalUrl), `${item.id} must include the canonical website URL.`);
    requireValue(Array.isArray(item.claimIds) && item.claimIds.length > 0, `${item.id} needs claim references.`);
    for (const claimId of item.claimIds || []) {
        requireValue(knownClaims.has(claimId), `${item.id} references unknown claim ${claimId}.`);
    }
    requireValue(Boolean(item.assetType && item.disclosure && item.approvalState), `${item.id} needs asset, disclosure and approval state.`);
    requireValue(item.approvalState !== 'publication_ready', `${item.id} cannot be publication-ready before an account and approval exist.`);
}

if (errors.length) {
    console.error(`Playable Now launch validation failed (${errors.length}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Playable Now launch pack valid: ${campaign.content.length} content units, publishing gated, canonical link and creature language confirmed.`);
