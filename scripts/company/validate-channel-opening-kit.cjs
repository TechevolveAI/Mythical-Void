#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1
    ? path.resolve(__dirname, '..', '..')
    : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const kit = JSON.parse(read('docs/company/content/channel-launch/CHANNEL_OPENING_KIT_2026-08-27.json'));
const guide = read('docs/company/content/channel-launch/CHANNEL_OPENING_KIT_2026-08-27.md');
const channels = JSON.parse(read('docs/company/content/channels.json'));
const campaign = JSON.parse(read('docs/company/content/campaigns/playable-now-launch.json'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

requireValue(kit.id === 'CHANNEL-OPENING-KIT-001', 'kit identity is missing');
requireValue(kit.asOf === '2026-08-27', 'kit review date is stale');
requireValue(kit.state === 'prepared_no_external_account_change', 'kit must not claim an external account change');
requireValue(kit.costPosition?.additionalGoogleWorkspaceSubscriptionRequired === false, 'the no-extra-Workspace position is missing');
requireValue(kit.costPosition?.linkedinCompanyPageCreationCost === 'free', 'LinkedIn Page cost is not recorded');

const linkedIn = kit.channels?.find(channel => channel.channelRef === 'CH-004');
const youtube = kit.channels?.find(channel => channel.channelRef === 'CH-002');
requireValue(Boolean(linkedIn) && Boolean(youtube), 'LinkedIn and YouTube setup records are required');
requireValue(linkedIn?.publicIdentity?.name === 'Mythical Void', 'LinkedIn display name drifted');
requireValue(linkedIn?.publicIdentity?.publicUrlAvailabilityVerified === false, 'LinkedIn address availability must not be assumed');
requireValue(linkedIn?.firstPublicAction?.contentRef === 'PN-002', 'first post must stay tied to the founder story');
requireValue(linkedIn?.firstPublicAction?.automaticLinkPreviewOnly === true, 'first post must use the reviewed automatic preview');
requireValue(youtube?.publicIdentity?.name === 'Mythical Void', 'YouTube display name drifted');
requireValue(youtube?.publicIdentity?.handleAvailabilityVerified === false, 'YouTube handle availability must not be assumed');
requireValue(youtube?.releaseGate?.approvedAuthenticGameplayMoments === 0 && youtube?.releaseGate?.requiredAuthenticGameplayMoments === 4, 'YouTube visual gate must remain 0 of 4');
requireValue(youtube?.releaseGate?.videoPublicationReady === false, 'YouTube publication must remain closed');
requireValue(youtube?.assets?.banner === null, 'an unreviewed YouTube banner is attached');

for (const asset of [linkedIn?.assets?.logo, linkedIn?.assets?.coverSource, youtube?.assets?.profileImage]) {
    requireValue(Boolean(asset) && fs.existsSync(path.join(root, asset)), `required asset is missing: ${asset || 'unknown'}`);
}

const publicCopy = JSON.stringify(kit.channels || []);
requireValue(!/\bcompanions?\b/i.test(publicCopy), 'public channel copy uses retired companion wording');
requireValue(/NASA does not endorse Mythical Void\./.test(publicCopy), 'NASA non-endorsement boundary is missing');
requireValue(/father-and-son/i.test(publicCopy) && /nine-year-old son/i.test(publicCopy), 'father-and-son origin is missing');
requireValue(!/no two creatures|every creature is unique|sentient creature/i.test(publicCopy), 'unsupported creature claim is present');

for (const field of ['accountCreationAuthorized', 'platformTermsAcceptanceAuthorized', 'publishingAuthorized', 'replyingAuthorized', 'paidProductsAuthorized', 'paidPromotionAuthorized', 'externalActionTaken']) {
    requireValue(kit.authority?.[field] === false, `authority ${field} must remain false`);
}
requireValue(kit.ownership?.passwordSharingPermitted === false, 'password sharing must remain forbidden');
requireValue(kit.ownership?.credentialsStoredInRepository === false, 'credentials must remain outside the repository');
requireValue(kit.moderation?.automatedRepliesAuthorized === false, 'automated replies must remain closed');
requireValue(kit.moderation?.directMessagesToChildrenPermitted === false, 'private child contact must remain forbidden');
requireValue(kit.moderation?.personalDataRequestsPermitted === false, 'personal-data requests must remain forbidden');

const sourceUrls = new Set((kit.sources || []).map(source => source.url));
for (const url of [
    'https://www.linkedin.com/help/linkedin/answer/a545752',
    'https://www.linkedin.com/help/linkedin/answer/a6242790',
    'https://support.google.com/youtube/answer/1646861?hl=en-GB',
    'https://support.google.com/youtube/answer/9481328'
]) requireValue(sourceUrls.has(url), `official source is missing: ${url}`);

for (const phrase of ['do **not** need to buy another Google Workspace subscription', 'LinkedIn Page fields', 'YouTube fields', "Kevin's short checklist", 'no account has been created']) {
    requireValue(guide.includes(phrase), `plain-language guide is missing: ${phrase}`);
}

requireValue(channels.channels?.find(channel => channel.id === 'CH-002')?.accountOrProperty === null, 'registry wrongly claims a YouTube account');
requireValue(channels.channels?.find(channel => channel.id === 'CH-004')?.accountOrProperty === null, 'registry wrongly claims a LinkedIn Page');
requireValue(campaign.content?.find(item => item.id === 'PN-002')?.approvalState === 'awaiting_kevin_and_channel', 'founder post approval state drifted');

if (failures.length) {
    console.error('Channel opening kit is not safe or complete:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    channelsPrepared: ['LinkedIn', 'YouTube'],
    additionalWorkspaceRequired: false,
    externalAccountChangeMade: false,
    founderPostReadyForKevinPreview: true,
    youtubeVisualGate: '0/4'
}, null, 2));
