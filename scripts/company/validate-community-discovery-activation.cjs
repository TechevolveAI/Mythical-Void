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
    requireValue(experiment.observedAudience?.weeklyContributionsShown === 836, 'the dated contribution observation is missing');
    requireValue(experiment.observedAudience?.approximate === true && /not guaranteed reach/i.test(experiment.observedAudience?.meaning || '') && /player counts/i.test(experiment.observedAudience?.meaning || ''), 'the changing audience estimate needs its limits');

    const rules = experiment.verifiedRules || {};
    for (const field of ['browserPlayableRequired', 'directGameLinkRequired', 'downloadRequiredForbidden', 'signupRequiredForbidden', 'referralLinksForbidden', 'titleMustStartWithGameName']) {
        requireValue(rules[field] === true, `verified community rule ${field} is missing`);
    }
    requireValue(rules.minimumMonthsBeforeRepost === 3, 'the three-month repost rule is missing');
    requireValue(experiment.duplicateCheck?.existingResultObserved === false, 'the duplicate search no longer supports a first post');
    requireValue(experiment.duplicateCheck?.checkedOn === plan.checkedOn, 'the duplicate search date is stale');
    const latestCheck = experiment.latestReadOnlyVerification || {};
    requireValue(latestCheck.checkedAt === '2026-09-08T16:52:53Z' && latestCheck.method === 'normal_browser_visible_review', 'the latest visible community verification is missing');
    requireValue(latestCheck.rulesVisibleAndMatchedPreparedPlan === true && latestCheck.duplicateSearchVisible === true && latestCheck.existingMythicalVoidResultObserved === false, 'the visible rule or duplicate check is incomplete');
    requireValue(latestCheck.weeklyVisitorsShown === 19000 && latestCheck.weeklyContributionsShown === 836, 'the visible community estimates are incomplete');
    requireValue(latestCheck.machineReadableRedditCheckHttpStatus === 403 && /visible adult browser review/i.test(latestCheck.limitation || ''), 'the blocked machine check is not recorded honestly');
    requireValue(experiment.communityClimate?.status === 'active_discussion_not_a_rule', 'the AI-game community climate is missing or overstated');
    requireValue(/low-effort AI-made games/i.test(experiment.communityClimate?.finding || '') && /opinion is divided/i.test(experiment.communityClimate?.finding || ''), 'the divided community response to AI-made games is not recorded honestly');
    requireValue(/tested and reworked/i.test(experiment.communityClimate?.launchResponse || '') && /Do not argue with criticism/i.test(experiment.communityClimate?.launchResponse || ''), 'the respectful response to the community climate is missing');

    requireValue(prepared.format === 'direct_link', 'the prepared Reddit post must remain a direct link');
    requireValue(prepared.title?.startsWith('Mythical Void'), 'the post title must start with the game name');
    requireValue(prepared.url === 'https://mythicalvoid.com/play/', 'the post must use the clean direct game URL');
    requireValue(!/[?#]/.test(prepared.url || ''), 'the game URL must not contain tracking parameters or fragments');
    requireValue(/My son and I started Mythical Void/i.test(prepared.firstComment || '') && /generative AI tools/i.test(prepared.firstComment || ''), 'the true origin and AI assistance disclosure are missing');
    requireValue(/free early-access browser adventure/i.test(prepared.firstComment || '') && /hatch your own alien creature/i.test(prepared.firstComment || ''), 'the game state and creature promise are missing');
    requireValue(/six strange worlds/i.test(prepared.firstComment || '') && /free Guardians trapped by the Void/i.test(prepared.firstComment || '') && /Project Beacon becomes/i.test(prepared.firstComment || ''), 'the plain game experience is incomplete');
    requireValue(/no download or account/i.test(prepared.firstComment || ''), 'the low-friction promise is missing');
    requireValue(/brand emblem, not gameplay/i.test(prepared.firstComment || ''), 'the automatic link preview disclosure is missing');
    requireValue(/what felt clear or confusing in the first minute/i.test(prepared.firstComment || ''), 'the one useful feedback question is missing');
    requireValue(/not a substitute for care/i.test(prepared.firstComment || '') && /tested and reworked/i.test(prepared.firstComment || '') && /people decide what is released/i.test(prepared.firstComment || ''), 'the post does not answer the low-effort AI concern plainly');
    requireValue((prepared.title || '').length <= 90, 'the post title is too long');
    requireValue((prepared.firstComment || '').trim().split(/\s+/).length <= 110, 'the first comment is too long');
    requireValue(!/\[HTML5\]|built in Phaser|three-pulse route/i.test(`${prepared.title || ''} ${prepared.firstComment || ''}`), 'the first community message has drifted back into technical release-note language');

    requireValue(experiment.preflight?.freshOpeningJourneyRequired === true, 'a fresh live journey is required before posting');
    requireValue(experiment.preflight?.checkDuplicateImmediatelyBeforePosting === true, 'the last duplicate check is missing');
    requireValue(experiment.preflight?.adultReplyOwnerRequired === true, 'adult reply ownership is missing');
    requireValue(experiment.preflight?.manualMediaAttachmentAllowed === false, 'manual media must remain off');
    requireValue(experiment.preflight?.automaticLinkPreviewRequired === 'https://mythicalvoid.com/marketing/mythical-void-brand-link-card-v1.png' && /not gameplay/i.test(experiment.preflight?.automaticLinkPreviewClassification || ''), 'the labelled brand-card preview boundary is missing');
    requireValue(experiment.preflight?.trackingParametersAllowed === false, 'tracking parameters must remain off');
    requireValue(experiment.measurement?.neverInfer?.length === 5, 'honest measurement boundaries are incomplete');
    requireValue(experiment.measurement?.record?.some(item => /broad social_or_creator group/i.test(item) && /does not identify Reddit/i.test(item)), 'privacy-safe social-or-creator measurement boundary is missing');
    requireValue(!/name Reddit as the referrer|show Reddit as the referrer/i.test(JSON.stringify(experiment.measurement || {})), 'measurement must not claim unavailable Reddit-specific attribution');
    requireValue(experiment.stopRules?.some(rule => /fake engagement/i.test(rule)), 'the fake-engagement stop rule is missing');
    requireValue(experiment.stopRules?.some(rule => /three months/i.test(rule)), 'the repost stop rule is missing');
    requireValue(experiment.stopRules?.some(rule => /no bot replies/i.test(rule)), 'the human reply rule is missing');

    requireValue(plan.nextRoutes?.map(route => route.name).join('|') === 'Phaser Showcase|itch.io|HTML5 Game Devs Showcase', 'the sequenced follow-on routes changed');
    requireValue(plan.nextRoutes?.find(route => route.name === 'itch.io')?.state.includes('publication_waiting'), 'itch.io publication must remain waiting');
    requireValue(plan.fallbackReadOnlyVerification?.route === 'Phaser Showcase' && plan.fallbackReadOnlyVerification?.rulesVisible === true && plan.fallbackReadOnlyVerification?.exactMythicalVoidResultObserved === false, 'the current Phaser fallback verification is missing');
    requireValue(/remains second/i.test(plan.fallbackReadOnlyVerification?.sequenceBoundary || ''), 'the one-route-at-a-time boundary is missing from the fallback check');
    requireValue(plan.excludedForNow?.some(route => route.name === 'Newgrounds' && /AI-generated thumbnails/i.test(route.reason || '')), 'the current Newgrounds risk is missing');
    requireValue(plan.excludedForNow?.some(route => route.name === 'r/playmygame' && /restrictive AI policy/i.test(route.reason || '') && /genuinely test/i.test(route.reason || '')), 'the current r/playmygame AI-policy and participation hold is missing');
    requireValue(plan.excludedForNow?.some(route => route.name === 'r/IndieGaming' && /No AI rule/i.test(route.reason || '')), 'the current r/IndieGaming no-AI conflict is missing');
    requireValue(plan.founderDecision?.postAuthorized === false && plan.founderDecision?.humanReplyCoverageConfirmed === false, 'Kevin decision boundary is missing');

    for (const field of ['externalPostMade', 'externalPostingAuthorized', 'accountOpened', 'accountOpeningAuthorized', 'platformTermsAccepted', 'automatedRepliesAuthorized', 'bulkCrossPostingAuthorized', 'paidPromotionAuthorized', 'fakeEngagementAuthorized', 'childContactAuthorized']) {
        requireValue(authority[field] === false, `authority ${field} must remain false`);
    }

    requireValue(feedbackHtml.includes('value="website_creator"><span>A game website, forum, newsletter or creator</span>'), 'adult feedback cannot identify the community route');
    for (const phrase of ['No post, account or outside contact has been made.', 'not guaranteed reach, posts, replies or player counts', 'Reddit returned 403', 'active community discussion about AI-made web games', 'This discussion is not a rule.', 'A post view is not a player.', 'cannot identify Reddit on its own', 'The one approval needed']) {
        requireValue(copy.includes(phrase), `plain-language plan is missing: ${phrase}`);
    }
    requireValue(copy.replace(/^>\s?/gm, '').replace(/\s+/g, ' ').includes('I have an existing adult Reddit account, I approve the exact title, link and first comment below now, and I can personally answer replies for seven days.'), 'plain-language plan is missing the exact short-lived approval message');
    requireValue(/It is not proof\s+that Reddit sent a particular visit\./.test(copy), 'plain-language plan is missing the Reddit attribution limit');
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
