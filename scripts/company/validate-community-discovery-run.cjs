#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const RUN_PATH = 'docs/company/growth/COMMUNITY_DISCOVERY_RUN_2026-09-08.json';
const PLAN_PATH = 'docs/company/growth/COMMUNITY_DISCOVERY_ACTIVATION_2026-09-08.json';

const nullableWholeNumber = value => value === null || (Number.isInteger(value) && value >= 0);
const validOptionalDate = value => value === null || Boolean(Date.parse(value));
const metricFields = ['platformViews', 'publicCommentCount', 'consentedSocialOrCreatorArrivals', 'anonymousAdultForumFeedbackCount'];
const observationFields = ['dueAt', 'checkedAt', ...metricFields, 'unavailable'];

function validateCommunityRun({ run, plan }) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const planPost = plan.firstExperiment?.preparedPost || {};
    const post = run.preparedPost || {};
    const approval = run.approval || {};
    const preflight = run.preflight || {};
    const publication = run.publication || {};

    requireValue(run.schemaVersion === 1 && run.id === 'WEBGAMES-FIRST-RUN-001', 'community run identity is missing');
    requireValue(run.planRef === PLAN_PATH && run.community === plan.firstExperiment?.community, 'community run is detached from its approved plan');
    requireValue(post.format === planPost.format && post.title === planPost.title && post.url === planPost.url && post.firstComment === planPost.firstComment, 'prepared post no longer matches the reviewed plan');
    requireValue(post.title?.startsWith('Mythical Void'), 'post title must start with the game name');
    requireValue(post.url === 'https://mythicalvoid.com/play/' && !/[?#]/.test(post.url || ''), 'post must use the clean direct game URL');
    requireValue(!/\bcompanions?\b|\bsignals?\b/i.test(`${post.title || ''} ${post.firstComment || ''}`), 'retired public wording appears in the post');
    requireValue(preflight.cleanDirectLink === true && preflight.trackingParametersPresent === false && preflight.gameplayMediaAttached === false && preflight.manualMediaAttached === false, 'clean direct-link post boundary changed');
    requireValue(preflight.automaticLinkPreviewExpected === 'https://mythicalvoid.com/marketing/mythical-void-brand-link-card-v1.png', 'truthful automatic link preview is missing');
    requireValue(preflight.automaticLinkPreviewCheckedAt === null || Boolean(Date.parse(preflight.automaticLinkPreviewCheckedAt)), 'automatic link preview check time is invalid');
    requireValue(preflight.automaticLinkPreviewHttpStatus === null || preflight.automaticLinkPreviewHttpStatus === 200, 'automatic link preview status must be null or 200');
    requireValue(preflight.automaticLinkPreviewMatchesExpected === null || preflight.automaticLinkPreviewMatchesExpected === true, 'automatic link preview cannot be recorded as mismatched');
    requireValue(validOptionalDate(approval.exactPostApprovedAt), 'exact post approval time is invalid');

    const actionReady = approval.existingAdultAccountConfirmed === true &&
        approval.exactPostApprovedAtActionTime === true &&
        approval.exactPostApprovedAt !== null &&
        approval.approvedBy === 'Kevin' &&
        approval.adultReplyOwner === 'Kevin' &&
        approval.replyCoverageConfirmed === true &&
        preflight.rulesRecheckedAt !== null &&
        preflight.duplicateRecheckedAt !== null &&
        preflight.duplicateObserved === false &&
        preflight.liveGameCheckedAt !== null &&
        preflight.liveGameHttpStatus === 200 &&
        preflight.openingJourneyPassedAt !== null &&
        preflight.automaticLinkPreviewCheckedAt !== null &&
        preflight.automaticLinkPreviewHttpStatus === 200 &&
        preflight.automaticLinkPreviewMatchesExpected === true;

    if (publication.posted === true) {
        requireValue(actionReady, 'publication is recorded without every action-time gate');
        requireValue(/^https:\/\/(?:www\.)?reddit\.com\/r\/WebGames\/comments\//.test(publication.postUrl || ''), 'publication needs the real r/WebGames post URL');
        requireValue(Boolean(Date.parse(publication.publishedAt || '')), 'publication needs a valid time');
        const publishedAt = Date.parse(publication.publishedAt || '');
        const freshnessRules = [
            ['exact post approval', approval.exactPostApprovedAt, 30 * 60 * 1000],
            ['rules check', preflight.rulesRecheckedAt, 2 * 60 * 60 * 1000],
            ['duplicate check', preflight.duplicateRecheckedAt, 2 * 60 * 60 * 1000],
            ['live game check', preflight.liveGameCheckedAt, 2 * 60 * 60 * 1000],
            ['opening journey check', preflight.openingJourneyPassedAt, 2 * 60 * 60 * 1000],
            ['automatic link preview check', preflight.automaticLinkPreviewCheckedAt, 2 * 60 * 60 * 1000]
        ];
        for (const [label, checkedAt, maximumAge] of freshnessRules) {
            const checkedAtTime = Date.parse(checkedAt || '');
            requireValue(Number.isFinite(checkedAtTime) && checkedAtTime <= publishedAt && publishedAt - checkedAtTime <= maximumAge, `${label} must be fresh and completed before publication`);
        }
    } else {
        requireValue(publication.postUrl === null && publication.publishedAt === null, 'an unpublished run cannot have a post URL or time');
    }

    for (const [label, observation] of Object.entries(run.observations || {})) {
        requireValue(['day2', 'day7'].includes(label), `unexpected observation ${label}`);
        requireValue(
            Object.keys(observation).length === observationFields.length &&
                observationFields.every(field => Object.prototype.hasOwnProperty.call(observation, field)),
            `${label} must contain aggregate observation fields only`
        );
        const unavailable = observation.unavailable || [];
        requireValue(Array.isArray(unavailable) && unavailable.every(field => metricFields.includes(field)) && new Set(unavailable).size === unavailable.length, `${label}.unavailable is invalid`);
        for (const field of metricFields) {
            requireValue(nullableWholeNumber(observation[field]), `${label}.${field} must be null or a non-negative whole number`);
        }
        requireValue(!Object.prototype.hasOwnProperty.call(observation, 'consentedRedditReferrals'), `${label} must not claim Reddit-specific referral attribution`);
        if (!publication.posted) requireValue(observation.dueAt === null && observation.checkedAt === null && metricFields.every(field => observation[field] === null) && unavailable.length === 0, `${label} evidence cannot exist before publication`);
        if (observation.checkedAt !== null) {
            const checkedTime = Date.parse(observation.checkedAt || '');
            const dueTime = Date.parse(observation.dueAt || '');
            requireValue(Number.isFinite(checkedTime) && Number.isFinite(dueTime), `${label} needs valid due and checked times`);
            requireValue(Number.isFinite(checkedTime) && Number.isFinite(dueTime) && checkedTime >= dueTime, `${label} cannot be checked before it is due`);
            for (const field of metricFields) {
                requireValue(observation[field] === null ? unavailable.includes(field) : !unavailable.includes(field), `${label}.${field} availability is inconsistent`);
            }
        } else {
            requireValue(metricFields.every(field => observation[field] === null) && unavailable.length === 0, `${label} contains totals before it was checked`);
        }
    }

    if (publication.posted && Date.parse(publication.publishedAt)) {
        for (const [label, days] of [['day2', 2], ['day7', 7]]) {
            const expected = new Date(Date.parse(publication.publishedAt) + days * 86400000).toISOString();
            requireValue(run.observations?.[label]?.dueAt === expected, `${label} due time must be derived from the real publication time`);
        }
    }

    const truth = (run.truthRules || []).join(' ');
    for (const phrase of ['view is not a player', 'visit is not a play', 'does not prove enjoyment', 'does not prove retention', 'does not prove growth', 'social_or_creator website arrival does not prove that reddit sent it']) {
        requireValue(truth.toLowerCase().includes(phrase), `truth rule is missing: ${phrase}`);
    }
    requireValue(!/user(name)?|handle|commentText|comment_text|privateMessage|private_message/i.test(Object.values(run.observations || {}).flatMap(observation => Object.keys(observation || {})).join(' ')), 'personal or message-level fields are not allowed');
    if (publication.posted && run.observations?.day7?.checkedAt) {
        requireValue(/Kevin may then stop/i.test(run.nextRequiredAction || '') && /Phaser Showcase/i.test(run.nextRequiredAction || ''), 'completed-read decision is unclear');
    } else if (publication.posted && run.observations?.day2?.checkedAt) {
        requireValue(/Kevin answers replies/i.test(run.nextRequiredAction || '') && /seven-day/i.test(run.nextRequiredAction || ''), 'seven-day follow-up action is unclear');
    } else if (publication.posted) {
        requireValue(/Kevin answers replies/i.test(run.nextRequiredAction || '') && /two-day and seven-day/i.test(run.nextRequiredAction || ''), 'post-publication human action is unclear');
    } else {
        requireValue(/existing adult Reddit account/i.test(run.nextRequiredAction || '') && /answer replies/i.test(run.nextRequiredAction || ''), 'next human action is unclear');
    }

    return failures;
}

function loadFromRoot(root) {
    const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
    return { run: readJson(RUN_PATH), plan: readJson(PLAN_PATH) };
}

function main() {
    const root = path.resolve(__dirname, '..', '..');
    const inputs = loadFromRoot(root);
    const failures = validateCommunityRun(inputs);
    if (failures.length) {
        console.error('Community discovery run is unsafe or inconsistent:\n');
        failures.forEach(failure => console.error(`- ${failure}`));
        process.exit(1);
    }
    console.log(JSON.stringify({
        valid: true,
        community: inputs.run.community,
        state: inputs.run.state,
        posted: inputs.run.publication.posted,
        postUrl: inputs.run.publication.postUrl,
        nextRequiredAction: inputs.run.nextRequiredAction
    }, null, 2));
}

if (require.main === module) main();
module.exports = { RUN_PATH, PLAN_PATH, validateCommunityRun, loadFromRoot };
