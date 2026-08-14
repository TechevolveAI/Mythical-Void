#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildDashboard, defaultPaths, readJson } = require('./build-founder-launch-dashboard.cjs');

const dashboardDefault = path.resolve(__dirname, '../../docs/company/FOUNDER_LAUNCH_DASHBOARD.md');
const paths = {
    evidence: process.argv[2] ? path.resolve(process.argv[2]) : defaultPaths.evidence,
    outreach: process.argv[3] ? path.resolve(process.argv[3]) : defaultPaths.outreach,
    activation: process.argv[4] ? path.resolve(process.argv[4]) : defaultPaths.activation,
    itch: process.argv[5] ? path.resolve(process.argv[5]) : defaultPaths.itch,
    launch: process.argv[6] ? path.resolve(process.argv[6]) : defaultPaths.launch,
    trailer: process.argv[7] ? path.resolve(process.argv[7]) : defaultPaths.trailer,
    analytics: process.argv[8] ? path.resolve(process.argv[8]) : defaultPaths.analytics,
    calendar: process.argv[9] ? path.resolve(process.argv[9]) : defaultPaths.calendar,
    discovery: process.argv[10] ? path.resolve(process.argv[10]) : defaultPaths.discovery,
    hatchReview: process.argv[11] ? path.resolve(process.argv[11]) : defaultPaths.hatchReview,
    restorationReview: process.argv[12] ? path.resolve(process.argv[12]) : defaultPaths.restorationReview,
    choiceReview: process.argv[13] ? path.resolve(process.argv[13]) : defaultPaths.choiceReview,
    adultStemOutreach: process.argv[14] ? path.resolve(process.argv[14]) : defaultPaths.adultStemOutreach,
    liveSearch: process.argv[15] ? path.resolve(process.argv[15]) : defaultPaths.liveSearch,
    founderStory: process.argv[16] ? path.resolve(process.argv[16]) : defaultPaths.founderStory,
    scienceWeek: process.argv[17] ? path.resolve(process.argv[17]) : defaultPaths.scienceWeek,
    dashboard: process.argv[18] ? path.resolve(process.argv[18]) : dashboardDefault
};
const sourceKeys = ['evidence', 'outreach', 'activation', 'itch', 'launch', 'trailer', 'analytics', 'calendar', 'discovery', 'hatchReview', 'restorationReview', 'choiceReview', 'adultStemOutreach', 'liveSearch', 'founderStory', 'scienceWeek'];
const values = Object.fromEntries(sourceKeys.map(key => [key, readJson(paths[key])]));
const dashboard = fs.readFileSync(paths.dashboard, 'utf8');
const expectedDashboard = buildDashboard(values);
const errors = [];
const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};

const requiredRoutes = ['/', '/creature-genetics/', '/nasa-space-science/', '/parents/', '/studio/', '/press/', '/story/', '/play/'];
const routeMap = new Map((values.evidence.routes || []).map(route => [route.route, route]));
requireValue(values.evidence.result === 'owned_discovery_live_game_entry_working', 'Live evidence must record the working owned-discovery result.');
requireValue(requiredRoutes.every(route => routeMap.get(route)?.verified === true && routeMap.get(route)?.notFoundShown === false), 'Every required public route must have a successful live check.');
requireValue(routeMap.get('/story/')?.realGameplayRealmImages === 6 && routeMap.get('/story/')?.trailerLinked === false && routeMap.get('/story/')?.sitemapListed === true, 'The live story page must retain its six real-game realm images, sitemap entry and trailer boundary.');
requireValue(routeMap.get('/play/')?.canvasCountAfterFiveSeconds === 1, 'The live game entry must create one canvas during the check.');

requireValue(values.outreach.messages?.length === 3, 'Exactly three first-wave outreach messages must remain prepared.');
requireValue(values.outreach.messages?.every(message => message.approved === false && message.sentAt === null), 'Every first-wave message must remain unapproved and unsent.');
requireValue(values.outreach.authority?.sendingAuthorized === false && values.outreach.authority?.externalActionAuthorized === false, 'Outreach sending and external action must remain unauthorized.');

const youtube = values.activation.channels?.find(channel => channel.channelRef === 'CH-002');
const linkedin = values.activation.channels?.find(channel => channel.channelRef === 'CH-004');
requireValue(youtube?.accountState === 'not_created_owner_confirmed', 'YouTube must remain recorded as not created.');
requireValue(linkedin?.accountState === 'not_created_owner_confirmed', 'LinkedIn must remain recorded as not created.');
requireValue(youtube?.firstUploads?.length === 6, 'The YouTube activation pack must retain six prepared upload items.');
requireValue(linkedin?.firstPosts?.length === 6, 'The LinkedIn activation pack must retain six prepared posts.');
requireValue(youtube?.channelKit?.profileAsset === 'public/marketing/channel-kit/youtube/youtube-profile-v1.png', 'Founder view must retain the prepared YouTube profile image.');
requireValue(youtube?.channelKit?.bannerAsset === 'public/marketing/channel-kit/youtube/youtube-channel-banner-v1.jpg', 'Founder view must retain the prepared YouTube banner.');
requireValue(youtube?.channelKit?.kevinVisualApprovalRequired === true && youtube?.channelKit?.uploadAuthorized === false, 'YouTube artwork upload must remain gated by Kevin visual review.');
const choicePost = linkedin?.firstPosts?.find(post => post.id === 'LI-006');
requireValue(choicePost?.asset === 'public/press/gameplay/project-beacon-priority-choice.png', 'The Project Beacon post must use the reviewed authentic wide frame.');
requireValue(choicePost?.proofReview === 'docs/company/content/PROJECT_BEACON_CHOICE_PROOF_REVIEW.json', 'The Project Beacon post must cite its proof review.');
requireValue(choicePost?.approvalState === 'awaiting_kevin_and_page' && /Kevin must approve/i.test(choicePost?.releaseBoundary || ''), 'The Project Beacon post must remain waiting for Kevin and the official page.');
requireValue(/real Mythical Void browser game/i.test(choicePost?.disclosure || '') && /not their consequences/i.test(choicePost?.disclosure || ''), 'The Project Beacon post disclosure must identify real gameplay and its consequence limit.');

requireValue(values.itch.state === 'internal_draft_not_submitted', 'The itch.io launch pack must remain an internal unsubmitted draft.');
requireValue(values.itch.authority?.accountCreationAuthorized === false && values.itch.authority?.publicationAuthorized === false, 'Itch.io account creation and publication must remain unauthorized.');
requireValue(values.itch.portableBuild?.status === 'built_and_nested_path_launch_tested_locally', 'The portable build must retain its tested-local status.');

const ownedDiscoveryStage = values.launch.stages?.find(stage => stage.id === 'LS-003');
requireValue(values.launch.asOf === values.evidence.checkedAt.slice(0, 10), 'Launch board date must match the live evidence date.');
requireValue(ownedDiscoveryStage?.state === 'completed' && ownedDiscoveryStage?.ready === true, 'Owned discovery must be recorded as completed.');
requireValue(ownedDiscoveryStage?.completedEvidenceRef === values.evidence.id, 'Owned discovery completion must cite the live evidence.');

requireValue(values.trailer.releaseState === 'waiting_for_kevin_trailer_review', 'Trailer release must remain waiting for Kevin review.');
requireValue(values.trailer.watchPagePrepared === true && values.trailer.productionPublished === false, 'The trailer page must be prepared but not recorded as published.');
requireValue(values.trailer.searchIndexingEnabled === false && values.trailer.publicUploadDate === null, 'Unapproved trailer search indexing and upload dates must remain off.');

requireValue(values.analytics.productionDeployed === true, 'The current consent-gated website tag must remain recorded as deployed.');
requireValue(values.analytics.upgradeReleaseState === 'prepared_on_feature_branch_not_yet_deployed', 'The safer analytics upgrade must remain recorded as prepared but not deployed.');
requireValue(values.analytics.trustedForCompanyReporting === false, 'Website analytics must remain untrusted for company reporting.');
requireValue(values.analytics.tag?.includedRoutes?.length === 10, 'The analytics upgrade must retain its ten public routes.');
requireValue(values.analytics.publicActions?.eventNames?.length === 5, 'The analytics upgrade must retain exactly five allowed public actions.');

const calendarReleases = values.calendar.weeks?.flatMap(week => week.releases || []) || [];
requireValue(values.calendar.state === 'prepared_waiting_for_official_channels', 'The four-week calendar must remain prepared and waiting for official channels.');
requireValue(calendarReleases.filter(release => release.channel !== 'Internal review').length === 7, 'The calendar must retain seven outward release items.');
requireValue(calendarReleases.filter(release => release.channel === 'Internal review').length === 1, 'The calendar must retain one internal review.');
requireValue(calendarReleases.filter(release => release.channel !== 'Internal review').every(release => release.state === 'waiting_for_channel_and_kevin_approval'), 'Every outward calendar item must remain gated by channel creation and Kevin approval.');

const storyPage = values.discovery.pages?.find(page => page.route === '/story/');
requireValue(values.discovery.state === 'released_to_owned_website' && Boolean(storyPage), 'The owned discovery release must record the released story page.');
requireValue(routeMap.get('/story/')?.verified === true, 'The released story page must be part of the production evidence.');

requireValue(values.hatchReview.captureId === 'GP-013', 'Founder view must use the reviewed authentic hatch reveal.');
requireValue(values.hatchReview.reviewState === 'authentic_internal_proof_rejected_for_public_promotion' && values.hatchReview.publicUseApproved === false, 'The weak hatch reveal must remain withheld from public promotion.');
requireValue(values.hatchReview.qualityIssues?.length === 4, 'The founder view must retain all four hatch-reveal quality issues.');

requireValue(values.restorationReview.captureIds?.join(',') === 'GP-014,GP-015', 'Founder view must use both reviewed restoration frames.');
requireValue(values.restorationReview.reviewState === 'authentic_supporting_proof_not_approved_as_lead_world_change' && values.restorationReview.publicUseApproved === false, 'The restoration pair must remain withheld as lead world-change proof.');
requireValue(values.restorationReview.qualityIssues?.length === 4, 'The founder view must retain all four restoration quality issues.');

requireValue(values.choiceReview.captureIds?.join(',') === 'GP-016,GP-017', 'Founder view must use both reviewed Project Beacon choice frames.');
requireValue(values.choiceReview.reviewState === 'authentic_spoiler_safe_supporting_proof_ready_for_kevin_review' && values.choiceReview.publicUseApproved === false, 'The Project Beacon choice proof must remain spoiler-safe and waiting for Kevin review.');
requireValue(values.choiceReview.qualityIssues?.length === 2, 'The founder view must retain both Project Beacon choice limitations.');

requireValue(values.adultStemOutreach.state === 'two_drafts_ready_waiting_for_sender_and_kevin_approval', 'Adult STEM outreach must remain a prepared draft.');
requireValue(values.adultStemOutreach.messages?.length === 2, 'Founder view must retain the two adult STEM introductions.');
requireValue(values.adultStemOutreach.messages?.every(message => message.approved === false && message.sentAt === null), 'Every adult STEM introduction must remain unapproved and unsent.');
requireValue(values.adultStemOutreach.authority?.sendingAuthorized === false && values.adultStemOutreach.authority?.childWorkCollectionAuthorized === false, 'Adult STEM sending and child-work collection must remain unauthorized.');

requireValue(values.liveSearch.state === 'crawl_foundation_live_related_result_observed_owned_discovery_not_observed', 'Founder view must retain the honest live search and related-result state.');
requireValue(values.liveSearch.ownedCrawlFoundation?.homepageStatus === 200 && values.liveSearch.ownedCrawlFoundation?.sitemapRouteCount === 9, 'Founder view must retain the reachable homepage and nine-route sitemap evidence.');
requireValue(values.liveSearch.ownedCrawlFoundation?.sitemapRoutes?.includes('/story/'), 'Founder view must retain the story route in the live sitemap evidence.');
requireValue(values.liveSearch.publicSearchSample?.ownedResultObserved === false, 'Founder view must not invent a public search result.');
requireValue(values.liveSearch.followUpSearchSample?.ownedResultObserved === false && values.liveSearch.followUpSearchSample?.relatedResultObserved === true, 'Founder view must retain the missing owned result and observed related result.');
requireValue(values.liveSearch.followUpSearchSample?.currentRelatedPageClaim === 'Every creature is unique.', 'Founder view must retain the related-site correction reason.');
requireValue(values.liveSearch.webmasterEvidence?.googleSearchConsoleConnected === false && values.liveSearch.webmasterEvidence?.indexCoverageKnown === false, 'Founder view must retain unverified Search Console and index coverage.');
requireValue(values.liveSearch.authority?.searchEngineSubmissionAuthorized === false, 'Search submission must remain unauthorized.');

requireValue(values.founderStory.state === 'article_and_pitch_prepared_waiting_for_kevin_and_first_wave_learning', 'Founder story must remain prepared and waiting for Kevin.');
requireValue(values.founderStory.target?.candidateRef === 'RC-007', 'Founder story must retain its reviewed Irish Tech News target.');
requireValue(values.founderStory.pitch?.approved === false && values.founderStory.pitch?.sentAt === null, 'Founder story pitch must remain unapproved and unsent.');
requireValue(values.founderStory.authority?.paidPlacementAuthorized === false && values.founderStory.authority?.childParticipationAuthorized === false, 'Paid placement and child participation must remain unauthorized.');

requireValue(values.scienceWeek.state === 'printable_pack_built_internal_review_pending', 'Science Week water work must remain an internal printable pack waiting for review.');
requireValue(values.scienceWeek.realScience?.length === 3 && values.scienceWeek.session?.length === 5, 'Founder view must retain the three sourced facts and five-part activity concept.');
requireValue(values.scienceWeek.readiness?.worksheetExtensionBuilt === true && values.scienceWeek.readiness?.facilitatorGuideBuilt === true, 'Founder view must retain the completed worksheet and facilitator note.');
requireValue(values.scienceWeek.artifact?.pages === 3 && values.scienceWeek.artifact?.publicUseApproved === false, 'Founder view must retain the reviewed three-page pack as unapproved for public use.');
requireValue(values.scienceWeek.educatorReview?.state === 'internal_review_packet_ready_no_review_completed', 'Founder view must retain the unused adult educator review packet.');
requireValue(values.scienceWeek.educatorReview?.invitationState === 'one_adult_only_draft_ready_waiting_for_kevin', 'Founder view must retain the one unsent adult-only review invitation.');
requireValue(values.scienceWeek.opportunity?.mythicalEventSubmitted === false && values.scienceWeek.opportunity?.mythicalPartnershipExists === false, 'Founder view must not invent a Science Week event or partnership.');
requireValue(values.scienceWeek.authority?.eventSubmissionAuthorized === false && values.scienceWeek.authority?.publicationAuthorized === false, 'Science Week submission and publication must remain unauthorized.');

const engagementTrack = values.launch.tracks?.find(track => track.id === 'LT-007');
requireValue(engagementTrack?.status === 'blocked' && /safeguarding/i.test((engagementTrack.blockers || []).join(' ')), 'Public engagement must remain blocked until safeguarding and response ownership exist.');

requireValue(dashboard === expectedDashboard, 'Founder dashboard is stale; rebuild it with build-founder-launch-dashboard.cjs.');
requireValue(!/\bcompanions?\b/i.test(dashboard), 'Founder dashboard must use creature language.');
requireValue(!/\bno two creatures (?:are )?alike\b|\bevery creature is unique\b/i.test(dashboard), 'Founder dashboard must not promise absolute uniqueness.');

if (errors.length) {
    console.error(`Founder launch dashboard validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Founder launch command centre valid: ${requiredRoutes.length} verified live routes, trailer review gated, ${calendarReleases.length} calendar items, ${values.outreach.messages.length} unsent outreach drafts, no external action.`);
