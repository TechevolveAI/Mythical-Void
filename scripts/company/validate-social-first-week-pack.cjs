#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RECORD_PATH = 'docs/company/content/channel-launch/SOCIAL_FIRST_WEEK_OPERATING_PACK_2026-09-09.json';
const GUIDE_PATH = 'docs/company/content/channel-launch/SOCIAL_FIRST_WEEK_OPERATING_PACK_2026-09-09.md';

function validateSocialFirstWeek({ record, guide, campaign, founding, packageJson }) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const authority = record.authority || {};
    const channels = record.channelActions || [];
    const week = record.firstWeek || [];
    const rules = (record.contentRules || []).join(' ');
    const profiles = channels.map(channel => JSON.stringify(channel.profile || {})).join(' ');

    requireValue(record.schemaVersion === 1 && record.id === 'SOCIAL-FIRST-WEEK-001', 'first-week identity is missing');
    requireValue(record.asOf === '2026-09-09', 'first-week pack date drifted');
    requireValue(record.state === 'content_ready_waiting_for_profile_and_approval', 'first-week pack overstates external progress');
    requireValue(record.recommendedStart?.firstPublicRoute === "Kevin's existing LinkedIn profile", 'existing LinkedIn profile is not first');
    requireValue(record.recommendedStart?.firstContentId === 'PN-002', 'founder story is not first');
    const exactPostBody = record.recommendedStart?.exactPostBody || '';
    const exactPostHash = crypto.createHash('sha256').update(exactPostBody).digest('hex');
    requireValue(exactPostBody === founding.firstPost?.copy, 'first LinkedIn post has drifted from its source pack');
    requireValue(record.recommendedStart?.exactPostSha256 === exactPostHash && founding.firstPost?.sha256 === exactPostHash, 'first LinkedIn post fingerprint is invalid');
    requireValue(founding.firstPost?.state === 'content_ready_waiting_for_profile_preview_and_fresh_approval', 'founder post source overstates readiness');
    requireValue(founding.firstPost?.profileUrlConfirmed === false && founding.firstPost?.completePreviewApproved === false && founding.firstPost?.publishingAuthorized === false, 'founder post source invents account, preview or publication authority');
    requireValue(founding.livePreviewCheck?.checkedAt === '2026-09-09T03:22:20Z', 'founder story live preview check is stale');
    requireValue(founding.livePreviewCheck?.sourceCommit === '2f3843a9b24199565596064007568b9f2516288f' && founding.livePreviewCheck?.sourceDeployId === '6aa0c27a200b4400095861ae', 'founder story live preview is not tied to the published release');
    requireValue(founding.livePreviewCheck?.pageStatus === 200 && founding.livePreviewCheck?.imageStatus === 200 && founding.livePreviewCheck?.imageContentType === 'image/webp', 'founder story page or preview image was not healthy');
    requireValue(founding.livePreviewCheck?.generatedArtworkDisclosureObserved === true, 'founder story preview does not record the generated-art disclosure');
    requireValue(founding.livePreviewCheck?.linkedInCrawlerPreviewObserved === false && /does not prove LinkedIn/i.test(founding.livePreviewCheck?.note || ''), 'generic page health is being mistaken for a checked LinkedIn preview');
    requireValue(/^My son and I started Mythical Void at home/i.test(exactPostBody), 'first LinkedIn post loses Kevin\'s direct founder voice');
    requireValue(/asking each other strange questions/i.test(exactPostBody) && /gravity points sideways/i.test(exactPostBody) && /hear energy as music/i.test(exactPostBody), 'first LinkedIn post loses the shared father-and-son imagination');
    requireValue(/free to play and still in early access/i.test(exactPostBody) && /no download or account/i.test(exactPostBody), 'first LinkedIn post loses the playable-now promise');
    requireValue(/AI helped us build, but people made the story, safety and release decisions/i.test(exactPostBody) && /tested, rejected and rebuilt/i.test(exactPostBody), 'first LinkedIn post loses its honest account of AI and human responsibility');
    requireValue(/credited public NASA material/i.test(exactPostBody) && /NASA does not endorse the game/i.test(exactPostBody) && !/NASA-powered/i.test(exactPostBody), 'first LinkedIn post has an inaccurate NASA claim');
    requireValue(/If LinkedIn shows the page picture, it is imagined artwork/i.test(exactPostBody) && /not gameplay/i.test(exactPostBody), 'first LinkedIn post does not explain the automatic artwork preview');
    requireValue(/try the first minute/i.test(exactPostBody) && /what made sense and what did not/i.test(exactPostBody), 'first LinkedIn post loses the useful founder feedback invitation');
    requireValue(exactPostBody.trim().split(/\s+/).length <= 200, 'first LinkedIn post is too long for the intended founder note');
    requireValue(!/\b(?:nine|9)[ -]years?[ -]old\b/i.test(exactPostBody), 'first LinkedIn post exposes an unnecessary child detail');
    requireValue(!/\bcompanions?\b|\bsignals?\b/i.test(exactPostBody), 'first LinkedIn post uses retired public wording');
    requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(exactPostBody), 'first LinkedIn post contains a tracking link');
    requireValue(record.recommendedStart?.automaticLinkPreviewOnly === true && record.recommendedStart?.uploadedMediaRequired === false, 'first post must use the checked link preview only');
    requireValue(record.identity?.displayName === 'Mythical Void', 'display name drifted');
    requireValue(record.identity?.primaryHandle === 'PlayMythicalVoid' && record.identity?.fallbackHandle === 'MythicalVoidGame', 'handle family drifted');
    requireValue(record.identity?.handleAvailabilityConfirmed === false && record.identity?.officialAccountsConfirmed === 0, 'account or handle ownership was invented');
    requireValue(record.costAndAccountPosition?.additionalGoogleWorkspaceSubscriptionRequired === false, 'pack incorrectly requires another Google Workspace subscription');
    requireValue(record.costAndAccountPosition?.paidProductRequired === false, 'pack incorrectly requires a paid product');

    requireValue(channels.map(channel => channel.platform).join(',') === 'LinkedIn,YouTube,Instagram,TikTok,Discord', 'channel order is incomplete');
    const linkedIn = channels.find(channel => channel.platform === 'LinkedIn');
    requireValue(linkedIn?.accountCreationRequired === false, 'LinkedIn start should use Kevin\'s existing profile');
    requireValue(linkedIn?.contentReady === true && linkedIn?.publishingReady === false && linkedIn?.publicationAuthorized === false, 'LinkedIn content readiness is being confused with publication readiness');
    for (const platform of ['YouTube', 'Instagram', 'TikTok']) {
        const channel = channels.find(item => item.platform === platform);
        requireValue(channel?.accountCreationRequired === true, `${platform} reservation is missing`);
        requireValue(channel?.publishingReady === false && channel?.publicationAuthorized === false, `${platform} was made publication-ready`);
        requireValue(JSON.stringify(channel?.profile?.handleCandidates) === JSON.stringify(['@PlayMythicalVoid', '@MythicalVoidGame']), `${platform} handles drifted`);
    }
    requireValue(channels.find(channel => channel.platform === 'Discord')?.state === 'deferred', 'Discord must remain deferred');

    requireValue(JSON.stringify(week.filter(item => item.contentId).map(item => item.contentId)) === JSON.stringify(['PN-002', 'PN-001', 'PN-003']), 'first-week content sequence drifted');
    requireValue(JSON.stringify(campaign.firstWeekSequence?.map(item => item.contentId)) === JSON.stringify(['PN-002', 'PN-001', 'PN-003']), 'campaign first-week sequence drifted');
    requireValue(week.every(item => item.externalActionAuthorized === false), 'first-week step invents external authority');
    requireValue(record.replyRules?.coverageWindowHours === 48 && record.replyRules?.automatedRepliesAuthorized === false, 'human 48-hour reply cover is missing');
    requireValue(record.replyRules?.privateConversationWithChildPermitted === false && record.replyRules?.personalDataRequestsPermitted === false, 'child-safety reply boundary is missing');
    const actionGate = record.actionTimeGate || {};
    requireValue(actionGate.existingAdultProfileUrl === null && actionGate.profileOwnershipConfirmed === false, 'an adult LinkedIn profile was invented');
    requireValue(actionGate.multiFactorSecurityConfirmed === false && actionGate.recoveryConfirmed === false && actionGate.trustedAdultBackupNamed === false, 'account security or backup cover was invented');
    requireValue(actionGate.exactPostApprovedAt === null && actionGate.completePreviewApproved === false && actionGate.replyCoverageConfirmed === false, 'action-time approval or reply cover was invented');
    requireValue(actionGate.approvalWindowMinutes === 30 && actionGate.allRequiredBeforePublication === true, 'fresh all-or-nothing publication gate is missing');

    for (const field of ['accountCreationAuthorized', 'platformTermsAcceptanceAuthorized', 'publishingAuthorized', 'replyingAuthorized', 'automatedRepliesAuthorized', 'paidProductsAuthorized', 'paidPromotionAuthorized', 'childContactAuthorized', 'externalActionTaken']) {
        requireValue(authority[field] === false, `authority ${field} must remain false`);
    }

    requireValue(/never presented as gameplay/i.test(rules), 'generated-art boundary is missing');
    requireValue(/NASA does not endorse Mythical Void/i.test(rules), 'NASA boundary is missing');
    requireValue(/Never invent followers, reactions, players, testimonials or popularity/i.test(rules), 'honest audience rule is missing');
    requireValue(/until Kevin confirms ownership/i.test(rules), 'ownership-before-linking rule is missing');
    requireValue(!/\bcompanions?\b|\bsignals?\b/i.test(`${record.purpose} ${profiles} ${record.nextRequiredAction}`), 'retired public wording appears in the new core copy');

    const normalizedGuide = guide.replace(/\s+/g, ' ');
    for (const phrase of ['No account has been opened', 'existing LinkedIn profile', '@PlayMythicalVoid', 'second Google Workspace subscription', 'name reservations only', 'Exact first post', 'My son and I started Mythical Void at home', 'imagined artwork', 'try the first minute', 'Content ready', 'fresh approval lasting 30 minutes', 'Day 7', 'Never invent followers', 'NASA does not endorse Mythical Void', "Kevin's one next step"]) {
        requireValue(normalizedGuide.includes(phrase), `plain-language guide is missing: ${phrase}`);
    }
    requireValue(packageJson.scripts?.['validate:social-first-week']?.includes('validate-social-first-week-pack.cjs'), 'first-week validation command is missing');
    requireValue(packageJson.scripts?.['test:social-first-week']?.includes('test-social-first-week-pack.cjs'), 'first-week test command is missing');
    requireValue(packageJson.scripts?.['validate:channel-opening']?.includes('validate-social-first-week-pack.cjs'), 'first-week validation is not connected to the channel-opening gate');
    requireValue(packageJson.scripts?.['test:channel-opening']?.includes('test-social-first-week-pack.cjs'), 'first-week tests are not connected to the channel-opening gate');
    requireValue(packageJson.scripts?.build?.includes('npm run validate:channel-opening') && packageJson.scripts?.build?.includes('npm run test:channel-opening'), 'channel-opening safeguards are not in the production build');
    return failures;
}

function loadFromRoot(root) {
    const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
    return {
        record: JSON.parse(read(RECORD_PATH)),
        guide: read(GUIDE_PATH),
        campaign: JSON.parse(read('docs/company/content/campaigns/playable-now-launch.json')),
        founding: JSON.parse(read('docs/company/content/channel-launch/FOUNDING_SIGNAL_LAUNCH_PACK.json')),
        packageJson: JSON.parse(read('package.json'))
    };
}

function main() {
    const root = path.resolve(__dirname, '..', '..');
    const failures = validateSocialFirstWeek(loadFromRoot(root));
    if (failures.length) {
        console.error('Social first-week pack is unsafe or incomplete:\n');
        failures.forEach(failure => console.error(`- ${failure}`));
        process.exit(1);
    }
    console.log(JSON.stringify({ valid: true, firstRoute: "Kevin's existing LinkedIn profile", exactPostSha256: loadFromRoot(root).record.recommendedStart.exactPostSha256, contentReady: true, publishingReady: false, reservedChannels: 3, publicActionsTaken: 0, externalActionAuthorized: false }, null, 2));
}

if (require.main === module) main();
module.exports = { validateSocialFirstWeek, loadFromRoot };
