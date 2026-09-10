#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const valueAfter = flag => {
    const index = process.argv.indexOf(flag);
    return index === -1 ? null : process.argv[index + 1];
};
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const normalize = value => String(value || '')
    .replace(/^>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

function validateEditorialDiscovery(shortlist, copy) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const routes = Array.isArray(shortlist.routes) ? shortlist.routes : [];
    const sequence = shortlist.sequence || {};
    const media = shortlist.mediaBoundary || {};
    const authority = shortlist.authority || {};
    const combinedPitchCopy = routes.map(route => `${route.subject}\n${route.body}`).join('\n');

    requireValue(shortlist.id === 'EDITORIAL-DISCOVERY-001', 'shortlist identity is invalid');
    requireValue(shortlist.asOf === '2026-09-10', 'shortlist review date is stale');
    requireValue(shortlist.state === 'three_tailored_pitches_ready_no_outreach_authorized', 'shortlist state is not truthful');
    requireValue(routes.length === 3, 'the shortlist must contain exactly three routes');
    requireValue(new Set(routes.map(route => route.id)).size === routes.length, 'route identities must be unique');
    requireValue(routes.map(route => route.rank).join('|') === '1|2|3', 'route ranks are missing or out of order');
    requireValue(routes.map(route => route.id).join('|') === 'alpha-beta-gamer|free-game-planet|indie-games-plus', 'route order drifted');

    requireValue(sequence.onePitchAtATime === true, 'one-pitch-at-a-time rule is missing');
    requireValue(sequence.daysBetweenNewRecipients === 7, 'the seven-day observation window is missing');
    requireValue(sequence.maximumFollowUpsPerRecipient === 1, 'follow-ups are not bounded');
    requireValue(sequence.bulkSendingPermitted === false, 'bulk sending must remain prohibited');
    requireValue(sequence.automaticSendingPermitted === false, 'automatic sending must remain prohibited');
    requireValue(sequence.automaticReplyingPermitted === false, 'automatic replies must remain prohibited');
    for (const gate of [
        'the public website and /play/ route both return 200',
        'the opening journey passes on the live release',
        'the r/WebGames seven-day read finishes or Kevin explicitly cancels it',
        'Kevin approves one exact recipient, subject and message at action time',
        'an adult-controlled sending address and adult reply owner are confirmed'
    ]) requireValue(sequence.mustWaitFor?.includes(gate), `launch gate is missing: ${gate}`);

    for (const route of routes) {
        requireValue(/^https:\/\//.test(route.officialSubmissionPage || ''), `${route.id} needs an official submission page`);
        requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(route.publicSubmissionAddress || ''), `${route.id} needs a public submission address`);
        requireValue(normalize(route.whyItFits).length >= 80, `${route.id} needs a specific fit reason`);
        requireValue(normalize(route.importantBoundary).length >= 70, `${route.id} needs a clear boundary`);
        requireValue(normalize(route.subject).length >= 30, `${route.id} subject is too vague`);
        requireValue(normalize(route.body).includes('https://mythicalvoid.com/play/'), `${route.id} does not link directly to play`);
        requireValue(/father-and-son|My son and I/i.test(route.body || ''), `${route.id} is missing the human origin`);
        requireValue(/AI|generative/i.test(route.body || ''), `${route.id} is missing the AI disclosure`);
        requireValue(/NASA does not endorse/i.test(route.body || ''), `${route.id} is missing the NASA boundary`);
        requireValue(/does not guarantee coverage|not guaranteed coverage|no expectation of coverage/i.test(route.body || ''), `${route.id} invents certainty about coverage`);
        requireValue(Array.isArray(route.attachments) && route.attachments.length === 0, `${route.id} attached unapproved media`);
        requireValue(route.sent === false, `${route.id} invents an outside message`);
        requireValue(route.coveragePromised === false, `${route.id} invents promised coverage`);
    }

    requireValue(!/\bcompanions?\b/i.test(combinedPitchCopy), 'retired companion wording is present');
    requireValue(!/\bsignal\b/i.test(combinedPitchCopy), 'vague signal wording is present');
    requireValue(!/every creature is unique|infinite unique|millions of players/i.test(combinedPitchCopy), 'unsupported public claim is present');
    requireValue(media.gameplayScreenshotsAttached === 0 && media.gameplayVideosAttached === 0 && media.generatedArtworkAttached === 0, 'unapproved media is attached');
    requireValue(/Generated art is never a substitute for gameplay proof/.test(media.reason || ''), 'generated-art boundary is missing');

    for (const field of ['outreachAuthorized', 'emailSendingAuthorized', 'accountCreationAuthorized', 'termsAcceptanceAuthorized', 'attachmentsAuthorized', 'followUpAuthorized', 'externalActionTaken']) {
        requireValue(authority[field] === false, `authority ${field} must remain false`);
    }

    requireValue(shortlist.sources?.length === 4, 'official source list is incomplete');
    for (const route of routes) requireValue(shortlist.sources.includes(route.officialSubmissionPage), `official source is missing: ${route.id}`);
    const normalizedCopy = normalize(copy);
    for (const route of routes) {
        requireValue(normalizedCopy.includes(normalize(route.subject)), `human handoff is missing the ${route.id} subject`);
        requireValue(normalizedCopy.includes(normalize(route.body)), `human handoff drifted from the ${route.id} message`);
    }
    for (const phrase of ['This is not a spreadsheet of scraped names', 'The pitch is not “we used AI.”', 'No bulk sending, automatic replies or copied follow-ups', 'A site visit is not a player']) {
        requireValue(normalizedCopy.includes(normalize(phrase)), `plain-language handoff is missing: ${phrase}`);
    }

    return failures;
}

function run() {
    const dataPath = path.resolve(valueAfter('--data') || path.join(root, 'docs/company/growth/EDITORIAL_DISCOVERY_SHORTLIST_2026-09-10.json'));
    const copyPath = path.resolve(valueAfter('--copy') || path.join(root, 'docs/company/growth/EDITORIAL_DISCOVERY_SHORTLIST_2026-09-10.md'));
    const shortlist = readJson(dataPath);
    const copy = fs.readFileSync(copyPath, 'utf8');
    const failures = validateEditorialDiscovery(shortlist, copy);

    console.log(JSON.stringify({
        valid: failures.length === 0,
        state: shortlist.state,
        routes: shortlist.routes?.map(route => route.name) || [],
        messagesSent: shortlist.routes?.filter(route => route.sent).length || 0,
        nextRequiredAction: shortlist.nextRequiredAction,
        failures
    }, null, 2));
    if (failures.length) process.exit(1);
}

if (require.main === module) run();

module.exports = { validateEditorialDiscovery };
