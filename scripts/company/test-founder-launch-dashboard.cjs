#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildDashboard } = require('./build-founder-launch-dashboard.cjs');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-founder-launch-dashboard.cjs');
const sources = {
    evidence: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/growth/live-launch-evidence-2026-08-14.json'), 'utf8')),
    outreach: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/FIRST_CREATOR_OUTREACH_WAVE.json'), 'utf8')),
    activation: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/channel-activation-pack.json'), 'utf8')),
    itch: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/distribution/itch-launch-pack-2026-08-14.json'), 'utf8')),
    launch: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/growth/launch-readiness.json'), 'utf8')),
    trailer: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/TRAILER_PAGE_RELEASE.json'), 'utf8')),
    analytics: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/automation/website-analytics-tag.json'), 'utf8')),
    calendar: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/FOUR_WEEK_LAUNCH_CALENDAR.json'), 'utf8')),
    discovery: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/search/organic-discovery-release-2026-08-14.json'), 'utf8')),
    hatchReview: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/HATCH_REVEAL_PROOF_REVIEW.json'), 'utf8')),
    restorationReview: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/RESTORATION_PROOF_REVIEW.json'), 'utf8')),
    choiceReview: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/PROJECT_BEACON_CHOICE_PROOF_REVIEW.json'), 'utf8')),
    adultStemOutreach: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/ADULT_STEM_OUTREACH_WAVE.json'), 'utf8')),
    liveSearch: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/search/LIVE_SEARCH_FINDABILITY_EVIDENCE_2026-08-14.json'), 'utf8')),
    founderStory: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/IRISH_FOUNDER_STORY_RELEASE.json'), 'utf8')),
    scienceWeek: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/SCIENCE_WEEK_WATER_CONCEPT_2026.json'), 'utf8')),
    registry: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/OFFICIAL_CHANNEL_REGISTRY.json'), 'utf8')),
    searchConsole: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/search/SEARCH_CONSOLE_CONNECTION.json'), 'utf8')),
    familyPlay: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/customer/family-play-observations.json'), 'utf8')),
    dashboard: fs.readFileSync(path.join(root, 'docs/company/FOUNDER_LAUNCH_DASHBOARD.md'), 'utf8')
};
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-founder-dashboard-'));

function run(name, changes = {}) {
    const values = { ...sources, ...changes };
    const paths = ['evidence', 'outreach', 'activation', 'itch', 'launch', 'trailer', 'analytics', 'calendar', 'discovery', 'hatchReview', 'restorationReview', 'choiceReview', 'adultStemOutreach', 'liveSearch', 'founderStory', 'scienceWeek', 'registry', 'searchConsole', 'familyPlay'].map(key => {
        const file = path.join(temp, `${name}-${key}.json`);
        fs.writeFileSync(file, `${JSON.stringify(values[key], null, 2)}\n`);
        return file;
    });
    const dashboardFile = path.join(temp, `${name}-dashboard.md`);
    fs.writeFileSync(dashboardFile, values.dashboard);
    return spawnSync(process.execPath, [validator, ...paths, dashboardFile], { cwd: root, encoding: 'utf8' });
}

try {
    if (run('valid').status !== 0) throw new Error('Valid founder dashboard was rejected.');

    const failedRoute = structuredClone(sources.evidence);
    failedRoute.routes.find(route => route.route === '/press/').verified = false;
    if (run('failed-route', { evidence: failedRoute }).status === 0) throw new Error('A failed live route was accepted.');

    const erasedStoryRoute = structuredClone(sources.evidence);
    erasedStoryRoute.routes = erasedStoryRoute.routes.filter(route => route.route !== '/story/');
    if (run('erased-story-route', { evidence: erasedStoryRoute }).status === 0) throw new Error('The verified live story route was erased.');

    const sentMessage = structuredClone(sources.outreach);
    sentMessage.messages[0].sentAt = '2026-08-14T00:00:00Z';
    if (run('sent-message', { outreach: sentMessage }).status === 0) throw new Error('An unrecorded sent message was accepted.');

    const inventedChannel = structuredClone(sources.activation);
    inventedChannel.channels.find(channel => channel.channelRef === 'CH-002').accountState = 'created';
    if (run('invented-channel', { activation: inventedChannel }).status === 0) throw new Error('An invented social channel was accepted.');

    const recordedYoutubeRegistry = structuredClone(sources.registry);
    const recordedYoutubeActivation = structuredClone(sources.activation);
    Object.assign(recordedYoutubeRegistry.channels.find(channel => channel.channelRef === 'CH-002'), {
        accountState: 'created_owner_confirmed_not_published',
        officialUrl: 'https://www.youtube.com/@MythicalVoid',
        confirmedBy: 'Kevin Murphy',
        confirmedAt: '2026-08-14T19:30:00Z'
    });
    recordedYoutubeRegistry.state = 'one_channel_owner_confirmed_not_published';
    Object.assign(recordedYoutubeActivation.channels.find(channel => channel.channelRef === 'CH-002'), {
        accountState: 'created_owner_confirmed_not_published',
        officialUrl: 'https://www.youtube.com/@MythicalVoid',
        ownerConfirmedAt: '2026-08-14T19:30:00Z',
        handleAvailabilityVerified: true
    });
    const recordedDashboard = buildDashboard({ ...sources, registry: recordedYoutubeRegistry, activation: recordedYoutubeActivation });
    if (run('recorded-youtube', { registry: recordedYoutubeRegistry, activation: recordedYoutubeActivation, dashboard: recordedDashboard }).status !== 0) throw new Error('Valid owner-confirmed YouTube state was rejected.');

    const verifiedSearchConsole = structuredClone(sources.searchConsole);
    Object.assign(verifiedSearchConsole.property, {
        googleSearchConsoleConnected: true,
        verifiedPropertyEvidenceAvailable: true,
        verifiedBy: 'Kevin Murphy',
        verifiedAt: '2026-08-14T19:30:00Z'
    });
    verifiedSearchConsole.state = 'domain_verified_waiting_for_sitemap_submission';
    const verifiedSearchDashboard = buildDashboard({ ...sources, searchConsole: verifiedSearchConsole });
    if (run('verified-search-console', { searchConsole: verifiedSearchConsole, dashboard: verifiedSearchDashboard }).status !== 0) throw new Error('Valid Search Console verification state was rejected.');

    const releasedChoicePost = structuredClone(sources.activation);
    releasedChoicePost.channels.find(channel => channel.channelRef === 'CH-004').firstPosts.find(post => post.id === 'LI-006').approvalState = 'published';
    if (run('released-choice-post', { activation: releasedChoicePost }).status === 0) throw new Error('An unapproved Project Beacon post was accepted as published.');

    const publicItch = structuredClone(sources.itch);
    publicItch.authority.publicationAuthorized = true;
    if (run('public-itch', { itch: publicItch }).status === 0) throw new Error('An unauthorized itch.io publication state was accepted.');

    const inventedTrailerRelease = structuredClone(sources.trailer);
    inventedTrailerRelease.productionPublished = true;
    if (run('invented-trailer-release', { trailer: inventedTrailerRelease }).status === 0) throw new Error('An invented trailer release was accepted.');

    const trustedAnalytics = structuredClone(sources.analytics);
    trustedAnalytics.trustedForCompanyReporting = true;
    if (run('trusted-analytics', { analytics: trustedAnalytics }).status === 0) throw new Error('Unverified analytics reporting was accepted.');

    const ungatedCalendar = structuredClone(sources.calendar);
    ungatedCalendar.weeks[0].releases[0].state = 'published';
    if (run('ungated-calendar', { calendar: ungatedCalendar }).status === 0) throw new Error('An unapproved calendar publication was accepted.');

    const falseHatchApproval = structuredClone(sources.hatchReview);
    falseHatchApproval.publicUseApproved = true;
    if (run('false-hatch-approval', { hatchReview: falseHatchApproval }).status === 0) throw new Error('A weak hatch frame was falsely accepted for promotion.');

    const falseRestorationApproval = structuredClone(sources.restorationReview);
    falseRestorationApproval.publicUseApproved = true;
    if (run('false-restoration-approval', { restorationReview: falseRestorationApproval }).status === 0) throw new Error('The restoration pair was falsely accepted as lead world-change proof.');

    const falseChoiceApproval = structuredClone(sources.choiceReview);
    falseChoiceApproval.publicUseApproved = true;
    if (run('false-choice-approval', { choiceReview: falseChoiceApproval }).status === 0) throw new Error('The Project Beacon choice proof was falsely accepted as publicly approved.');

    const sentStemMessage = structuredClone(sources.adultStemOutreach);
    sentStemMessage.messages[0].sentAt = '2026-08-14T00:00:00Z';
    if (run('sent-stem-message', { adultStemOutreach: sentStemMessage }).status === 0) throw new Error('An unapproved adult STEM message was accepted as sent.');

    const inventedSearchResult = structuredClone(sources.liveSearch);
    inventedSearchResult.publicSearchSample.ownedResultObserved = true;
    if (run('invented-search-result', { liveSearch: inventedSearchResult }).status === 0) throw new Error('An invented public search result was accepted.');

    const hiddenRelatedSearchResult = structuredClone(sources.liveSearch);
    hiddenRelatedSearchResult.followUpSearchSample.relatedResultObserved = false;
    if (run('hidden-related-search-result', { liveSearch: hiddenRelatedSearchResult }).status === 0) throw new Error('The observed related search result was erased.');

    const sentFounderStory = structuredClone(sources.founderStory);
    sentFounderStory.pitch.sentAt = '2026-08-14T00:00:00Z';
    if (run('sent-founder-story', { founderStory: sentFounderStory }).status === 0) throw new Error('An unapproved founder story pitch was accepted as sent.');

    const submittedScienceWeek = structuredClone(sources.scienceWeek);
    submittedScienceWeek.opportunity.mythicalEventSubmitted = true;
    if (run('submitted-science-week', { scienceWeek: submittedScienceWeek }).status === 0) throw new Error('An invented Science Week submission was accepted.');

    const publishedScienceWeek = structuredClone(sources.scienceWeek);
    publishedScienceWeek.artifact.publicUseApproved = true;
    if (run('published-science-week', { scienceWeek: publishedScienceWeek }).status === 0) throw new Error('An unreviewed Science Week pack was accepted as public.');

    const inventedScienceWeekReview = structuredClone(sources.scienceWeek);
    inventedScienceWeekReview.educatorReview.state = 'review_completed';
    if (run('invented-science-week-review', { scienceWeek: inventedScienceWeekReview }).status === 0) throw new Error('An invented completed Science Week review was accepted.');

    const openedFamilyIntake = structuredClone(sources.familyPlay);
    openedFamilyIntake.authority.publicIntakeAuthorized = true;
    if (run('opened-family-intake', { familyPlay: openedFamilyIntake }).status === 0) throw new Error('Unauthorized public family feedback intake was accepted.');

    const staleDashboard = `${sources.dashboard}\nOutdated line.\n`;
    if (run('stale-dashboard', { dashboard: staleDashboard }).status === 0) throw new Error('A stale dashboard was accepted.');

    console.log('Founder launch command centre tests passed: valid snapshot, channel and Search Console transitions, plus 21 drift and authority mutations checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
