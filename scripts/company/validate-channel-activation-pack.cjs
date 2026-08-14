#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const activationPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/content/channel-launch/channel-activation-pack.json');
const outreachPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(root, 'docs/company/content/channel-launch/CREATOR_OUTREACH_PIPELINE.json');
const activation = JSON.parse(fs.readFileSync(activationPath, 'utf8'));
const outreach = JSON.parse(fs.readFileSync(outreachPath, 'utf8'));
const errors = [];
const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};

requireValue(activation.schemaVersion === 1, 'Activation pack schemaVersion must be 1.');
requireValue(activation.canonicalUrl === 'https://mythicalvoid.com/', 'Activation pack must use the canonical URL.');
for (const field of ['accountCreationAuthorized', 'publishingAuthorized', 'replyingAuthorized', 'directMessagingAuthorized', 'paidPromotionAuthorized', 'externalActionAuthorized']) {
    requireValue(activation.authority?.[field] === false, `Activation authority.${field} must remain false.`);
}

const youtube = activation.channels?.find((channel) => channel.channelRef === 'CH-002');
const linkedin = activation.channels?.find((channel) => channel.channelRef === 'CH-004');
requireValue(Boolean(youtube), 'YouTube activation plan is missing.');
requireValue(Boolean(linkedin), 'LinkedIn activation plan is missing.');
requireValue(youtube?.accountState === 'not_created_owner_confirmed', 'YouTube must record the owner-confirmed absence.');
requireValue(linkedin?.accountState === 'not_created_owner_confirmed', 'LinkedIn must record the owner-confirmed absence.');
requireValue(youtube?.handleAvailabilityVerified === false, 'YouTube handles must not be represented as available.');
requireValue(linkedin?.publicUrlAvailabilityVerified === false, 'LinkedIn URLs must not be represented as available.');
requireValue(youtube?.audienceSetting?.recommendedChoice === 'Review this setting for every video', 'YouTube must require a per-video audience decision.');
requireValue(youtube?.commentSetting?.beforeNamedAdultCoverage === 'off', 'YouTube comments must start off.');
requireValue(youtube?.commentSetting?.afterNamedAdultCoverage === 'hold_all', 'YouTube comments must be held after coverage begins.');
requireValue(youtube?.ownership?.passwordSharingAllowed === false && youtube?.ownership?.useScopedChannelPermissions === true, 'YouTube must use scoped roles without password sharing.');
requireValue(linkedin?.ownership?.passwordSharingAllowed === false, 'LinkedIn must not share passwords.');
requireValue(Array.isArray(youtube?.firstUploads) && youtube.firstUploads.length >= 5, 'YouTube needs at least five prepared uploads.');
requireValue(Array.isArray(linkedin?.firstPosts) && linkedin.firstPosts.length >= 5, 'LinkedIn needs at least five prepared posts.');

const publicCopy = [
    youtube?.profileDescription,
    linkedin?.tagline,
    linkedin?.about,
    ...(youtube?.firstUploads || []).flatMap((item) => [item.title, item.description]),
    ...(linkedin?.firstPosts || []).map((item) => item.copy),
    outreach?.messageTemplate?.subject,
    outreach?.messageTemplate?.body
].filter(Boolean).join('\n');
requireValue(!/\bcompanions?\b/i.test(publicCopy), 'Public launch copy must use creature language, not companion language.');
requireValue(!/\bno two creatures (?:are )?alike\b/i.test(publicCopy), 'Public launch copy must not promise absolute uniqueness.');
requireValue(!/\bevery creature is unique\b/i.test(publicCopy), 'Public launch copy must not promise absolute uniqueness.');

for (const item of youtube?.firstUploads || []) {
    requireValue(item.description?.includes(activation.canonicalUrl), `${item.id} must include the canonical URL.`);
    requireValue(item.audienceDecision === 'required_at_upload', `${item.id} must require an audience decision.`);
    requireValue(
        item.proofState?.startsWith('blocked_until_') || item.proofState === 'awaiting_kevin_and_channel',
        `${item.id} must remain proof-blocked or await Kevin and an official channel.`
    );
    if (item.proofState === 'awaiting_kevin_and_channel') {
        requireValue(Boolean(item.asset), `${item.id} needs a verified asset before it can await approval.`);
        requireValue(fs.existsSync(path.join(root, item.asset)), `${item.id} verified asset is missing: ${item.asset}`);
        requireValue(/Authentic running-build gameplay/i.test(item.assetRule || ''), `${item.id} must preserve the authentic-gameplay boundary.`);
    }
}
for (const item of linkedin?.firstPosts || []) {
    requireValue(item.copy?.includes('https://mythicalvoid.com/'), `${item.id} must include an approved Mythical URL.`);
    requireValue(item.approvalState !== 'publication_ready', `${item.id} cannot be publication-ready.`);
}

requireValue(outreach.schemaVersion === 1, 'Outreach pipeline schemaVersion must be 1.');
for (const field of ['recipientApproved', 'outreachAuthorized', 'directMessagingAuthorized', 'bulkOutreachAuthorized', 'paidPlacementAuthorized', 'externalActionAuthorized']) {
    requireValue(outreach.authority?.[field] === false, `Outreach authority.${field} must remain false.`);
}
requireValue(outreach.qualification?.minimumScore === 15, 'Outreach minimum score must remain 15.');
requireValue(Array.isArray(outreach.qualification?.criteria) && outreach.qualification.criteria.length === 6, 'Outreach needs six qualification criteria.');
requireValue(outreach.rules?.onePersonAtATime === true, 'Outreach must be one person at a time.');
requireValue(outreach.rules?.noPrivateContactWithChildren === true, 'Private contact with children must be forbidden.');
requireValue(outreach.rules?.maximumFollowUps === 1 && outreach.rules?.minimumDaysBeforeFollowUp >= 7, 'Outreach follow-up must be limited and spaced.');
requireValue(Array.isArray(outreach.researchCandidates) && outreach.researchCandidates.length >= 5, 'Outreach needs at least five researched candidates.');
for (const candidate of outreach.researchCandidates || []) {
    const scoreValues = Object.values(candidate.scores || {});
    const calculatedTotal = scoreValues.reduce((total, score) => total + score, 0);
    requireValue(/^RC-\d{3}$/.test(candidate.id || ''), `Invalid research candidate id: ${candidate.id || '(missing)'}.`);
    requireValue(candidate.stage === 'research', `${candidate.id} must remain research-only.`);
    requireValue(/^https:\/\//.test(candidate.source || ''), `${candidate.id} needs a public HTTPS source.`);
    requireValue(candidate.sourceCheckedAt === activation.asOf, `${candidate.id} needs a current source-check date.`);
    requireValue(scoreValues.length === 6 && scoreValues.every((score) => Number.isInteger(score) && score >= 0 && score <= 4), `${candidate.id} needs six valid 0-4 scores.`);
    requireValue(candidate.totalScore === calculatedTotal, `${candidate.id} total score is incorrect.`);
    requireValue(candidate.totalScore >= outreach.qualification.minimumScore, `${candidate.id} does not meet the qualification threshold.`);
    requireValue(candidate.outreachApproved === false && candidate.contactedAt === null, `${candidate.id} must remain unapproved and uncontacted.`);
}
requireValue(Array.isArray(outreach.recipients) && outreach.recipients.length === 0, 'Recipient list must remain empty until individual research and approval.');

if (errors.length) {
    console.error(`Channel activation validation failed (${errors.length}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Channel activation pack valid: ${youtube.firstUploads.length} YouTube uploads, ${linkedin.firstPosts.length} LinkedIn posts, ${outreach.researchCandidates.length} researched candidates, creator outreach safely gated.`);
