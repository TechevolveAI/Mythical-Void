#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const RECORD_PATH = 'docs/company/content/channel-launch/SOCIAL_FIRST_WEEK_OPERATING_PACK_2026-09-09.json';
const GUIDE_PATH = 'docs/company/content/channel-launch/SOCIAL_FIRST_WEEK_OPERATING_PACK_2026-09-09.md';

function validateSocialFirstWeek({ record, guide, campaign, packageJson }) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const authority = record.authority || {};
    const channels = record.channelActions || [];
    const week = record.firstWeek || [];
    const rules = (record.contentRules || []).join(' ');
    const profiles = channels.map(channel => JSON.stringify(channel.profile || {})).join(' ');

    requireValue(record.schemaVersion === 1 && record.id === 'SOCIAL-FIRST-WEEK-001', 'first-week identity is missing');
    requireValue(record.asOf === '2026-09-09', 'first-week pack date drifted');
    requireValue(record.state === 'ready_no_account_or_public_action', 'first-week pack overstates external progress');
    requireValue(record.recommendedStart?.firstPublicRoute === "Kevin's existing LinkedIn profile", 'existing LinkedIn profile is not first');
    requireValue(record.recommendedStart?.firstContentId === 'PN-002', 'founder story is not first');
    requireValue(record.recommendedStart?.automaticLinkPreviewOnly === true && record.recommendedStart?.uploadedMediaRequired === false, 'first post must use the checked link preview only');
    requireValue(record.identity?.displayName === 'Mythical Void', 'display name drifted');
    requireValue(record.identity?.primaryHandle === 'PlayMythicalVoid' && record.identity?.fallbackHandle === 'MythicalVoidGame', 'handle family drifted');
    requireValue(record.identity?.handleAvailabilityConfirmed === false && record.identity?.officialAccountsConfirmed === 0, 'account or handle ownership was invented');
    requireValue(record.costAndAccountPosition?.additionalGoogleWorkspaceSubscriptionRequired === false, 'pack incorrectly requires another Google Workspace subscription');
    requireValue(record.costAndAccountPosition?.paidProductRequired === false, 'pack incorrectly requires a paid product');

    requireValue(channels.map(channel => channel.platform).join(',') === 'LinkedIn,YouTube,Instagram,TikTok,Discord', 'channel order is incomplete');
    requireValue(channels.find(channel => channel.platform === 'LinkedIn')?.accountCreationRequired === false, 'LinkedIn start should use Kevin\'s existing profile');
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

    for (const field of ['accountCreationAuthorized', 'platformTermsAcceptanceAuthorized', 'publishingAuthorized', 'replyingAuthorized', 'automatedRepliesAuthorized', 'paidProductsAuthorized', 'paidPromotionAuthorized', 'childContactAuthorized', 'externalActionTaken']) {
        requireValue(authority[field] === false, `authority ${field} must remain false`);
    }

    requireValue(/never presented as gameplay/i.test(rules), 'generated-art boundary is missing');
    requireValue(/NASA does not endorse Mythical Void/i.test(rules), 'NASA boundary is missing');
    requireValue(/Never invent followers, reactions, players, testimonials or popularity/i.test(rules), 'honest audience rule is missing');
    requireValue(/until Kevin confirms ownership/i.test(rules), 'ownership-before-linking rule is missing');
    requireValue(!/\bcompanions?\b|\bsignals?\b/i.test(`${record.purpose} ${profiles} ${record.nextRequiredAction}`), 'retired public wording appears in the new core copy');

    const normalizedGuide = guide.replace(/\s+/g, ' ');
    for (const phrase of ['No account has been opened', 'existing LinkedIn profile', '@PlayMythicalVoid', 'second Google Workspace subscription', 'name reservations only', 'Day 7', 'Never invent followers', 'NASA does not endorse Mythical Void', "Kevin's one next step"]) {
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
    console.log(JSON.stringify({ valid: true, firstRoute: "Kevin's existing LinkedIn profile", reservedChannels: 3, publicActionsTaken: 0, externalActionAuthorized: false }, null, 2));
}

if (require.main === module) main();
module.exports = { validateSocialFirstWeek, loadFromRoot };
