#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PLAN_PATH = 'docs/company/growth/COMMUNITY_DISCOVERY_ACTIVATION_2026-09-08.json';
const COPY_PATH = 'docs/company/growth/COMMUNITY_DISCOVERY_ACTIVATION_2026-09-08.md';

function validateCommunityDiscovery({ plan, copy, feedbackHtml, packageJson }) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const experiment = plan.firstExperiment || {};
    const prepared = experiment.preparedPost || {};
    const authority = plan.authority || {};

    requireValue(plan.id === 'COMMUNITY-DISCOVERY-001', 'community discovery id is missing');
    requireValue(plan.checkedOn === '2026-09-08', 'community research date is stale');
    requireValue(plan.state === 'one_direct_link_post_ready_waiting_for_kevin', 'plan overstates activation');
    requireValue(experiment.community === 'r/WebGames', 'the first bounded experiment must remain r/WebGames');
    requireValue(experiment.rulesUrl === 'https://www.reddit.com/r/WebGames/about/rules', 'the live community rules source is missing');
    requireValue(experiment.observedAudience?.weeklyVisitorsShown === 19000, 'the dated audience observation is missing');
    requireValue(experiment.observedAudience?.approximate === true && /not guaranteed reach/i.test(experiment.observedAudience?.meaning || '') && /not a player count/i.test(experiment.observedAudience?.meaning || ''), 'the changing audience estimate needs its limits');

    const rules = experiment.verifiedRules || {};
    for (const field of ['browserPlayableRequired', 'directGameLinkRequired', 'downloadRequiredForbidden', 'signupRequiredForbidden', 'referralLinksForbidden', 'titleMustStartWithGameName']) {
        requireValue(rules[field] === true, `verified community rule ${field} is missing`);
    }
    requireValue(rules.minimumMonthsBeforeRepost === 3, 'the three-month repost rule is missing');
    requireValue(experiment.duplicateCheck?.existingResultObserved === false, 'the duplicate search no longer supports a first post');
    requireValue(experiment.duplicateCheck?.checkedOn === plan.checkedOn, 'the duplicate search date is stale');

    requireValue(prepared.format === 'direct_link', 'the prepared Reddit post must remain a direct link');
    requireValue(prepared.title?.startsWith('Mythical Void'), 'the post title must start with the game name');
    requireValue(prepared.url === 'https://mythicalvoid.com/play/', 'the post must use the clean direct game URL');
    requireValue(!/[?#]/.test(prepared.url || ''), 'the game URL must not contain tracking parameters or fragments');
    requireValue(/father-and-son experiment/i.test(prepared.firstComment || '') && /generative AI tools/i.test(prepared.firstComment || ''), 'the true origin and AI assistance disclosure are missing');
    requireValue(/early-access browser adventure/i.test(prepared.firstComment || '') && /built in Phaser/i.test(prepared.firstComment || ''), 'the game state and Phaser context are missing');
    requireValue(/No download or account is needed/i.test(prepared.firstComment || ''), 'the low-friction promise is missing');
    requireValue(/Crystal Caves.+three-pulse route.+corrupted Guardian awakens/i.test(prepared.firstComment || ''), 'the current Crystal Caves reason to try the game is missing');
    requireValue(/brand emblem.+not gameplay/i.test(prepared.firstComment || ''), 'the automatic link preview disclosure is missing');
    requireValue(/first minute felt clear or confusing/i.test(prepared.firstComment || ''), 'the one useful feedback question is missing');

    requireValue(experiment.preflight?.freshOpeningJourneyRequired === true, 'a fresh live journey is required before posting');
    requireValue(experiment.preflight?.checkDuplicateImmediatelyBeforePosting === true, 'the last duplicate check is missing');
    requireValue(experiment.preflight?.adultReplyOwnerRequired === true, 'adult reply ownership is missing');
    requireValue(experiment.preflight?.manualMediaAttachmentAllowed === false, 'manual media must remain off');
    requireValue(experiment.preflight?.automaticLinkPreviewRequired === 'https://mythicalvoid.com/marketing/mythical-void-brand-link-card-v1.png' && /not gameplay/i.test(experiment.preflight?.automaticLinkPreviewClassification || ''), 'the labelled brand-card preview boundary is missing');
    requireValue(experiment.preflight?.trackingParametersAllowed === false, 'tracking parameters must remain off');
    requireValue(experiment.measurement?.neverInfer?.length === 5, 'honest measurement boundaries are incomplete');
    requireValue(experiment.stopRules?.some(rule => /fake engagement/i.test(rule)), 'the fake-engagement stop rule is missing');
    requireValue(experiment.stopRules?.some(rule => /three months/i.test(rule)), 'the repost stop rule is missing');
    requireValue(experiment.stopRules?.some(rule => /no bot replies/i.test(rule)), 'the human reply rule is missing');

    requireValue(plan.nextRoutes?.map(route => route.name).join('|') === 'Phaser Showcase|itch.io|HTML5 Game Devs Showcase', 'the sequenced follow-on routes changed');
    requireValue(plan.nextRoutes?.find(route => route.name === 'itch.io')?.state.includes('publication_waiting'), 'itch.io publication must remain waiting');
    requireValue(plan.excludedForNow?.some(route => route.name === 'Newgrounds' && /AI-generated thumbnails/i.test(route.reason || '')), 'the current Newgrounds risk is missing');
    requireValue(plan.founderDecision?.postAuthorized === false && plan.founderDecision?.humanReplyCoverageConfirmed === false, 'Kevin decision boundary is missing');

    for (const field of ['externalPostMade', 'externalPostingAuthorized', 'accountOpened', 'accountOpeningAuthorized', 'platformTermsAccepted', 'automatedRepliesAuthorized', 'bulkCrossPostingAuthorized', 'paidPromotionAuthorized', 'fakeEngagementAuthorized', 'childContactAuthorized']) {
        requireValue(authority[field] === false, `authority ${field} must remain false`);
    }

    requireValue(feedbackHtml.includes('value="website_creator"><span>A game website, forum, newsletter or creator</span>'), 'adult feedback cannot identify the community route');
    for (const phrase of ['No post, account or outside contact has been made.', 'not guaranteed reach and not a player count', 'A post view is not a player.', 'The one approval needed']) {
        requireValue(copy.includes(phrase), `plain-language plan is missing: ${phrase}`);
    }
    for (const source of plan.sources || []) requireValue(copy.includes(source), `plain-language plan is missing source: ${source}`);
    requireValue(packageJson.scripts?.['validate:community-discovery']?.includes('validate-community-discovery-activation.cjs'), 'community validation command is missing');
    requireValue(packageJson.scripts?.['test:community-discovery']?.includes('test-community-discovery-activation.cjs'), 'community safeguard command is missing');
    requireValue(packageJson.scripts?.build?.includes('npm run validate:community-discovery') && packageJson.scripts?.build?.includes('npm run test:community-discovery'), 'community safeguards are not part of the production build');

    return failures;
}

function loadFromRoot(root) {
    const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
    return {
        plan: JSON.parse(read(PLAN_PATH)),
        copy: read(COPY_PATH),
        feedbackHtml: read('public/feedback/index.html'),
        packageJson: JSON.parse(read('package.json'))
    };
}

function main() {
    const rootFlag = process.argv.indexOf('--root');
    const root = rootFlag === -1
        ? path.resolve(__dirname, '..', '..')
        : path.resolve(process.argv[rootFlag + 1] || '');
    const inputs = loadFromRoot(root);
    const failures = validateCommunityDiscovery(inputs);
    if (failures.length) {
        console.error('Community discovery activation is not safe or complete:\n');
        failures.forEach(failure => console.error(`- ${failure}`));
        process.exit(1);
    }
    console.log(JSON.stringify({
        valid: true,
        firstExperiment: inputs.plan.firstExperiment.community,
        directGameUrl: inputs.plan.firstExperiment.preparedPost.url,
        duplicateObserved: inputs.plan.firstExperiment.duplicateCheck.existingResultObserved,
        externalPostMade: false,
        waitingFor: 'Kevin approval, an adult account and human reply ownership'
    }, null, 2));
}

if (require.main === module) main();

module.exports = { validateCommunityDiscovery, loadFromRoot };
