#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const RECORD_PATH = 'docs/company/growth/PHASER_SHOWCASE_ACTIVATION_2026-09-08.json';
const COPY_PATH = 'docs/company/growth/PHASER_SHOWCASE_ACTIVATION_2026-09-08.md';

function validatePhaserShowcase({ record, copy, packageJson }) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const topic = record.preparedTopic || {};
    const preflight = record.preflight || {};
    const authority = record.authority || {};

    requireValue(record.schemaVersion === 1 && record.id === 'PHASER-SHOWCASE-001', 'Phaser Showcase identity is missing');
    requireValue(record.checkedOn === '2026-09-08', 'Phaser Showcase review date is stale');
    requireValue(record.state === 'exact_topic_ready_waiting_for_first_community_read_account_and_action_time_approval', 'record overstates Phaser activation');
    requireValue(record.community?.rulesUrl === 'https://phaser.discourse.group/t/welcome-to-the-phaser-showcase-forum/19', 'official Showcase rule source is missing');
    requireValue(record.community?.recentActivityObserved === true && /not that Mythical Void will receive views, replies or players/i.test(record.community?.recentActivityMeaning || ''), 'recent activity needs an honest limit');
    requireValue(record.sequence?.order === 2 && /r_webgames_seven_day_read/i.test(record.sequence?.earliestState || ''), 'Phaser must remain behind the first community read');

    requireValue(topic.title === '[WIP] Mythical Void — a father-and-son Phaser browser adventure', 'prepared title changed or lost the WIP label');
    requireValue(topic.directGameUrl === 'https://mythicalvoid.com/play/' && !/[?#]/.test(topic.directGameUrl || ''), 'topic must use the clean direct game link');
    requireValue(topic.body?.includes(topic.directGameUrl), 'topic body is missing the direct game link');
    requireValue(/father-and-son project/i.test(topic.body || '') && /nine-year-old son/i.test(topic.body || ''), 'true studio beginning is missing');
    requireValue(/generative AI tools/i.test(topic.body || '') && /real running Phaser game/i.test(topic.body || ''), 'AI and real-game disclosure is missing');
    requireValue(/first minute clear without explanation/i.test(topic.body || '') && /movement and controls feel understandable/i.test(topic.body || ''), 'useful feedback questions are missing');
    requireValue(/NASA does not endorse Mythical Void/i.test(topic.body || ''), 'NASA boundary is missing');
    requireValue(topic.mediaAttached === false && /not attaching weak media/i.test(topic.body || ''), 'withdrawn visual media must stay out');
    requireValue(topic.trackingParametersPresent === false, 'tracking parameters must stay off');
    requireValue(!/\bcompanions?\b|\bsignals?\b/i.test(`${topic.title || ''} ${topic.body || ''}`), 'retired public wording appears in the topic');

    for (const field of ['firstCommunityReadCompleteOrCancelled', 'existingAdultAccountConfirmed', 'platformTermsAcceptedByKevin', 'exactTopicApprovedAtActionTime', 'replyCoverageConfirmed']) {
        requireValue(preflight[field] === false, `preflight ${field} must remain false before Kevin acts`);
    }
    for (const field of ['rulesRecheckedAt', 'duplicateSearchCheckedAt', 'duplicateTopicObserved', 'approvedBy', 'liveGameCheckedAt', 'liveGameHttpStatus', 'openingJourneyPassedAt']) {
        requireValue(preflight[field] === null, `preflight ${field} must remain empty before the live check`);
    }
    requireValue(preflight.adultReplyOwner === 'Kevin', 'Kevin must remain the named reply owner');

    const aftercare = `${(record.aftercare?.recordOnly || []).join(' ')} ${(record.aftercare?.neverInfer || []).join(' ')}`;
    for (const phrase of ['public topic URL', 'players from topic views', 'plays from website visits', 'enjoyment from link clicks', 'retention from replies', 'growth from one forum topic']) {
        requireValue(aftercare.includes(phrase), `honest aftercare is missing: ${phrase}`);
    }
    requireValue(/Do not copy usernames/i.test(record.aftercare?.privacy || ''), 'privacy boundary is missing');
    requireValue(record.stopRules?.some(rule => /Do not create a Phaser forum account/i.test(rule)), 'account stop rule is missing');
    requireValue(record.stopRules?.some(rule => /withdrawn screenshot or video pack/i.test(rule)), 'visual stop rule is missing');
    requireValue(record.stopRules?.some(rule => /Do not contact children/i.test(rule)), 'child-contact stop rule is missing');

    for (const field of ['externalTopicCreated', 'externalPostingAuthorized', 'accountOpened', 'accountOpeningAuthorized', 'platformTermsAccepted', 'mediaPublicationAuthorized', 'automatedRepliesAuthorized', 'paidPromotionAuthorized', 'fakeEngagementAuthorized', 'childContactAuthorized']) {
        requireValue(authority[field] === false, `authority ${field} must remain false`);
    }

    const normalizedCopy = copy.replace(/\s+/g, ' ');
    for (const phrase of ['No Phaser forum account, topic or outside contact has been made.', 'The forum topic is not authorized yet.', 'A topic view is not a player.', 'https://phaser.discourse.group/t/welcome-to-the-phaser-showcase-forum/19']) {
        requireValue(normalizedCopy.includes(phrase), `plain-language Phaser plan is missing: ${phrase}`);
    }
    requireValue(packageJson.scripts?.['validate:phaser-showcase']?.includes('validate-phaser-showcase-activation.cjs'), 'Phaser validation command is missing');
    requireValue(packageJson.scripts?.['test:phaser-showcase']?.includes('test-phaser-showcase-activation.cjs'), 'Phaser test command is missing');
    requireValue(packageJson.scripts?.build?.includes('npm run validate:phaser-showcase') && packageJson.scripts?.build?.includes('npm run test:phaser-showcase'), 'Phaser safeguards are not in the production build');

    return failures;
}

function loadFromRoot(root) {
    const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
    return {
        record: JSON.parse(read(RECORD_PATH)),
        copy: read(COPY_PATH),
        packageJson: JSON.parse(read('package.json'))
    };
}

function main() {
    const root = path.resolve(__dirname, '..', '..');
    const inputs = loadFromRoot(root);
    const failures = validatePhaserShowcase(inputs);
    if (failures.length) {
        console.error('Phaser Showcase activation is unsafe or incomplete:\n');
        failures.forEach(failure => console.error(`- ${failure}`));
        process.exit(1);
    }
    console.log(JSON.stringify({
        valid: true,
        routeOrder: inputs.record.sequence.order,
        title: inputs.record.preparedTopic.title,
        externalTopicCreated: false,
        waitingFor: 'the first community read, an adult account, Kevin action-time approval and human replies'
    }, null, 2));
}

if (require.main === module) main();
module.exports = { validatePhaserShowcase, loadFromRoot };
