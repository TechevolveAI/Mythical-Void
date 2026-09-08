#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const RECORD_PATH = 'docs/company/content/channel-launch/SOCIAL_IDENTITY_RESERVATION_2026-09-08.json';
const GUIDE_PATH = 'docs/company/content/channel-launch/SOCIAL_IDENTITY_RESERVATION_2026-09-08.md';

function validateSocialIdentity({ record, guide, channelIdentity, channels, packageJson }) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const identity = record.canonicalIdentity || {};
    const authority = record.authority || {};
    const findings = record.publicAudit?.exactNameFindings || [];
    const candidates = record.publicAudit?.candidateHandleObservations || [];

    requireValue(record.schemaVersion === 1 && record.id === 'SOCIAL-IDENTITY-RESERVATION-001', 'reservation identity is missing');
    requireValue(record.checkedOn === '2026-09-08', 'reservation review date is stale');
    requireValue(record.state === 'identity_plan_ready_no_account_change', 'reservation plan overstates external progress');
    requireValue(identity.displayName === 'Mythical Void', 'display name drifted');
    requireValue(identity.website === 'https://mythicalvoid.com/', 'official website drifted');
    requireValue(identity.primaryHandle === 'PlayMythicalVoid', 'primary handle drifted');
    requireValue(identity.fallbackHandle === 'MythicalVoidGame', 'fallback handle drifted');
    requireValue(identity.availabilityConfirmed === false, 'handle availability must not be claimed');
    requireValue(record.publicAudit?.officialAccountsConfirmed === 0, 'an official social account was claimed without ownership proof');

    for (const platform of ['YouTube', 'Instagram', 'TikTok']) {
        requireValue(findings.some(item => item.platform === platform && item.ours === false && /unrelated|reserved/i.test(item.observation || '')), `${platform} exact-name collision is missing`);
    }
    requireValue(findings.some(item => item.platform === 'LinkedIn' && item.ours === false && /does not prove/i.test(item.observation || '')), 'LinkedIn uncertainty is missing');
    requireValue(findings.some(item => item.platform === 'Discord' && item.ours === false), 'Discord name collision is missing');
    for (const handle of ['PlayMythicalVoid', 'MythicalVoidGame']) {
        requireValue(candidates.some(item => item.handle === handle && item.availabilityConfirmed === false), `candidate ${handle} must remain unconfirmed`);
    }

    const routes = record.openingOrder || [];
    requireValue(routes[0]?.route === "Kevin's existing LinkedIn profile" && routes[0]?.accountCreationRequired === false, 'existing LinkedIn profile must remain first');
    requireValue(routes.some(item => item.route === 'YouTube identity reservation' && item.proposedHandle === '@PlayMythicalVoid' && item.publishingReady === false), 'safe YouTube reservation is missing');
    requireValue(routes.some(item => item.route === 'Discord' && item.state === 'deferred'), 'Discord must remain deferred');

    for (const field of ['accountCreationAuthorized', 'platformTermsAcceptanceAuthorized', 'publishingAuthorized', 'replyingAuthorized', 'automatedRepliesAuthorized', 'paidProductsAuthorized', 'paidPromotionAuthorized', 'childContactAuthorized', 'externalActionTaken']) {
        requireValue(authority[field] === false, `authority ${field} must remain false`);
    }

    const rules = (record.publicationRules || []).join(' ');
    requireValue(/Do not add a social link.*until Kevin has confirmed ownership/i.test(rules), 'ownership-before-linking rule is missing');
    requireValue(/never be presented as gameplay/i.test(rules), 'generated-art boundary is missing');
    requireValue(/NASA does not endorse Mythical Void/i.test(rules), 'NASA boundary is missing');
    requireValue(/Never invent followers, reactions, players or popularity/i.test(rules), 'honest audience rule is missing');
    requireValue(/do not automate conversations with children/i.test(rules), 'child-safety reply rule is missing');
    requireValue(!/\bcompanions?\b|\bsignals?\b/i.test(`${record.purpose} ${record.nextRequiredAction}`), 'retired public wording appears in the core plan');

    const normalizedGuide = guide.replace(/\s+/g, ' ');
    for (const phrase of ['No account has been opened', 'PlayMythicalVoid', 'MythicalVoidGame', 'does not prove a handle is available', 'forbids invented followers', 'NASA does not endorse Mythical Void']) {
        requireValue(normalizedGuide.includes(phrase), `plain-language guide is missing: ${phrase}`);
    }
    requireValue(channelIdentity?.publicObservation?.confirmedOfficialSocialAccountCount === 0, 'channel inventory falsely claims an official account');
    for (const id of ['CH-002', 'CH-003', 'CH-004']) {
        requireValue(channels.channels?.find(channel => channel.id === id)?.accountOrProperty === null, `${id} registry wrongly claims an account`);
    }
    requireValue(packageJson.scripts?.['validate:social-identity']?.includes('validate-social-identity-reservation.cjs'), 'social identity validation command is missing');
    requireValue(packageJson.scripts?.['test:social-identity']?.includes('test-social-identity-reservation.cjs'), 'social identity test command is missing');
    requireValue(packageJson.scripts?.build?.includes('npm run validate:social-identity') && packageJson.scripts?.build?.includes('npm run test:social-identity'), 'social identity safeguards are not in the production build');
    return failures;
}

function loadFromRoot(root) {
    const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
    return {
        record: JSON.parse(read(RECORD_PATH)),
        guide: read(GUIDE_PATH),
        channelIdentity: JSON.parse(read('docs/company/content/channel-identity.json')),
        channels: JSON.parse(read('docs/company/content/channels.json')),
        packageJson: JSON.parse(read('package.json'))
    };
}

function main() {
    const root = path.resolve(__dirname, '..', '..');
    const failures = validateSocialIdentity(loadFromRoot(root));
    if (failures.length) {
        console.error('Social identity reservation is unsafe or incomplete:\n');
        failures.forEach(failure => console.error(`- ${failure}`));
        process.exit(1);
    }
    console.log(JSON.stringify({ valid: true, displayName: 'Mythical Void', primaryHandle: 'PlayMythicalVoid', fallbackHandle: 'MythicalVoidGame', officialAccountsConfirmed: 0, externalActionTaken: false }, null, 2));
}

if (require.main === module) main();
module.exports = { validateSocialIdentity, loadFromRoot };
