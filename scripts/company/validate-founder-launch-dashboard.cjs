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
    dashboard: process.argv[12] ? path.resolve(process.argv[12]) : dashboardDefault
};
const sourceKeys = ['evidence', 'outreach', 'activation', 'itch', 'launch', 'trailer', 'analytics', 'calendar', 'discovery', 'hatchReview'];
const values = Object.fromEntries(sourceKeys.map(key => [key, readJson(paths[key])]));
const dashboard = fs.readFileSync(paths.dashboard, 'utf8');
const expectedDashboard = buildDashboard(values);
const errors = [];
const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};

const requiredRoutes = ['/', '/creature-genetics/', '/nasa-space-science/', '/parents/', '/studio/', '/press/', '/play/'];
const routeMap = new Map((values.evidence.routes || []).map(route => [route.route, route]));
requireValue(values.evidence.result === 'owned_discovery_live_game_entry_working', 'Live evidence must record the working owned-discovery result.');
requireValue(requiredRoutes.every(route => routeMap.get(route)?.verified === true && routeMap.get(route)?.notFoundShown === false), 'Every required public route must have a successful live check.');
requireValue(routeMap.get('/play/')?.canvasCountAfterFiveSeconds === 1, 'The live game entry must create one canvas during the check.');

requireValue(values.outreach.messages?.length === 3, 'Exactly three first-wave outreach messages must remain prepared.');
requireValue(values.outreach.messages?.every(message => message.approved === false && message.sentAt === null), 'Every first-wave message must remain unapproved and unsent.');
requireValue(values.outreach.authority?.sendingAuthorized === false && values.outreach.authority?.externalActionAuthorized === false, 'Outreach sending and external action must remain unauthorized.');

const youtube = values.activation.channels?.find(channel => channel.channelRef === 'CH-002');
const linkedin = values.activation.channels?.find(channel => channel.channelRef === 'CH-004');
requireValue(youtube?.accountState === 'not_created_owner_confirmed', 'YouTube must remain recorded as not created.');
requireValue(linkedin?.accountState === 'not_created_owner_confirmed', 'LinkedIn must remain recorded as not created.');
requireValue(youtube?.firstUploads?.length === 6, 'The YouTube activation pack must retain six prepared upload items.');
requireValue(linkedin?.firstPosts?.length === 5, 'The LinkedIn activation pack must retain five prepared posts.');

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
requireValue(values.discovery.state === 'approved_for_owned_website_release' && Boolean(storyPage), 'The owned discovery release must include the prepared story page.');
requireValue(!routeMap.has('/story/'), 'The prepared story page must not be described as part of the older production evidence.');

requireValue(values.hatchReview.captureId === 'GP-013', 'Founder view must use the reviewed authentic hatch reveal.');
requireValue(values.hatchReview.reviewState === 'authentic_internal_proof_rejected_for_public_promotion' && values.hatchReview.publicUseApproved === false, 'The weak hatch reveal must remain withheld from public promotion.');
requireValue(values.hatchReview.qualityIssues?.length === 4, 'The founder view must retain all four hatch-reveal quality issues.');

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
