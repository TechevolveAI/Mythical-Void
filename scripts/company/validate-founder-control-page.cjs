#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1 ? path.resolve(__dirname, '..', '..') : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const load = relative => JSON.parse(read(relative));
const control = load('docs/company/operations/founder-control-page.json');
const page = read(control.plainLanguagePage || '');
const firstFive = load('docs/company/research/first-five-playtest.json');
const visualReview = load('docs/company/reviews/FIRST_CONTACT_VISUAL_REVIEW_2026-08-31.json');
const visualScreening = load('docs/company/content/visual-screening-2026-08-27.json');
const search = load('docs/company/search/search-visibility-audit-2026-08-27.json');
const release = load('docs/company/growth/GITHUB_PLAYABLE_RELEASE.json');
const analytics = load('docs/company/automation/website-analytics-tag.json');
const community = load('docs/company/growth/COMMUNITY_DISCOVERY_ACTIVATION_2026-09-08.json');
const attention = load('docs/company/growth/OWNED_CHANNEL_ATTENTION_2026-09-08.json');
const discoveryDoorways = load('docs/company/growth/DISCOVERY_DOORWAY_REGISTRY_2026-09-08.json');
const indieDbCandidate = load('docs/company/growth/INDIEDB_PAGE_CANDIDATE_2026-09-08.json');
const scoreboard = read('docs/company/growth/WHAT_WE_KNOW_ABOUT_GROWTH_2026-08-27.md');
const firstFivePage = read('docs/company/research/FIRST_FIVE_PLAYTEST.md');
const homepage = read('index.html');
const storefront = read('src/site/storefront.js');
const currentState = load('docs/company/operations/current-state.json');
const packageJson = load('package.json');
const normalizedPage = page.replace(/^>\s?/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
const normalizedScoreboard = scoreboard.replace(/\*\*/g, '').replace(/\s+/g, ' ');
const normalizedFirstFivePage = firstFivePage.replace(/\*\*/g, '').replace(/\s+/g, ' ');
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const latestMaterialWebsiteRelease = {
    checkedOn: '2026-09-09',
    sourceCommit: '2f3843a9b24199565596064007568b9f2516288f',
    protectedMainMergeCommit: 'b331689285f58b8686fa83a5d9f19291bc7531bd',
    deployId: '6aa0c27a200b4400095861ae',
    publishedAt: '2026-09-09T02:25:11.480Z',
    sourceAndProductionTreesMatch: true
};
const protectedMainEvidenceCutoff = {
    observedThroughPullRequest: 248,
    mergeCommit: 'c7c397d8576a9ec54ad5f73bec99c9c7f6dab029',
    mergedAt: '2026-09-09T02:49:52Z',
    title: 'Isolate community checks from creature media',
    changesPlayerExperience: false,
    productionBuildSkippedForCredits: true,
    livePlayerReleaseStillCurrent: true,
    laterOperatingRecordMergesExcludedByDesign: true
};

requireValue(control.schemaVersion === 1 && control.id === 'FOUNDER-CONTROL-001', 'founder control identity is invalid');
requireValue(control.asOf === '2026-09-10' && control.state === 'live_one_community_test_ready', 'founder control state or date is invalid');
requireValue(control.plainLanguagePage === 'docs/company/FOUNDER_CONTROL_PAGE.md', 'plain-language page path is invalid');

const doorway = control.currentPublicDoorway || {};
requireValue(doorway.state === 'healthy_at_latest_check' && /^2026-09-10T/.test(doorway.checkedAt || ''), 'current public doorway evidence is stale');
requireValue(doorway.websiteUrl === 'https://mythicalvoid.com/' && doorway.playUrl === 'https://mythicalvoid.com/play/', 'current public doorway links are invalid');
requireValue(doorway.sitemapUrls === 16 && doorway.coreExtraRoutes === 6 && doorway.uniqueOwnedLinksChecked === 57, 'current public doorway coverage is incomplete');
requireValue(doorway.rssItems === 25 && doorway.jsonItems === 25, 'current public news feeds are inconsistent');
requireValue(doorway.analyticsDefaultDenied === true && doorway.gameRouteLoadsWebsiteTag === false, 'current analytics boundary is invalid');
requireValue(doorway.livePresenceEndpointHealthy === true, 'current live-activity endpoint is not healthy');
requireValue(doorway.provesPlayers === false && doorway.provesEnjoyment === false && doorway.provesGrowth === false, 'availability is being overstated as an outcome');
requireValue(/^[0-9a-f]{24}$/.test(doorway.observedProductionAtCheck?.deployId || '') && /^[0-9a-f]{40}$/.test(doorway.observedProductionAtCheck?.sourceCommit || '') && doorway.observedProductionAtCheck?.notClaimedAsPermanentCurrentIdentity === true, 'observed production identity is invalid or overclaimed');
requireValue(doorway.freshStatusCommand === 'npm run founder:status' && doorway.holdAllDiscoveryWhenUnhealthy === true, 'fresh founder status gate is missing');

const live = control.live || {};
requireValue(live.websiteAndGame?.state === 'live', 'website and game must be recorded as live');
requireValue(live.websiteAndGame?.websiteUrl === 'https://mythicalvoid.com/' && live.websiteAndGame?.playUrl === 'https://mythicalvoid.com/play/', 'clean owned website links are missing');
requireValue(live.websiteAndGame?.technicalFirstContactProductionSourceCommit === 'e9293f09d2ed5332d5538c05f051560d29e4d5e3' && live.websiteAndGame?.technicalFirstContactProductionDeployId === '6a951fc9e33f9100083fb699', 'technical first-contact production evidence is missing');
requireValue(live.websiteAndGame?.technicalFirstContactRepairLive === true, 'live first-contact repair is hidden');
requireValue(live.websiteAndGame?.creatureArtworkHumanApproved === false, 'deployment must not be treated as visual approval');
requireValue(firstFive.currentHold?.candidateDeployed === true && firstFive.currentHold?.productionSourceCommit === live.websiteAndGame?.technicalFirstContactProductionSourceCommit && firstFive.currentHold?.productionDeployId === live.websiteAndGame?.technicalFirstContactProductionDeployId, 'First Five and founder first-contact production evidence disagree');
const lastObservedProduction = live.websiteAndGame?.lastObservedProduction || {};
requireValue(/^2026-09-09T/.test(lastObservedProduction.checkedAt || '') && /^[0-9a-f]{40}$/.test(lastObservedProduction.sourceCommit || '') && /^[0-9a-f]{24}$/.test(lastObservedProduction.deployId || ''), 'latest observed production identity is invalid');
requireValue(lastObservedProduction.state === 'ready' && lastObservedProduction.published === true, 'latest observed production is not proven ready and published');
requireValue(lastObservedProduction.sourceCommit === latestMaterialWebsiteRelease.sourceCommit && lastObservedProduction.protectedMainMergeCommit === latestMaterialWebsiteRelease.protectedMainMergeCommit && lastObservedProduction.deployId === latestMaterialWebsiteRelease.deployId, 'latest observed production does not match the live website release');
const latestGameRelease = live.websiteAndGame?.latestGameRelease || {};
requireValue(latestGameRelease.pullRequest === 246 && latestGameRelease.mergeCommit === latestMaterialWebsiteRelease.protectedMainMergeCommit && latestGameRelease.mergedAt === '2026-09-09T02:23:51Z' && latestGameRelease.title === 'Enable private creature media for all ages' && latestGameRelease.containedInLastObservedProduction === true, 'latest game release is missing from the production record');
for (const [field, expected] of Object.entries(protectedMainEvidenceCutoff)) {
    requireValue(live.websiteAndGame?.protectedMainEvidenceCutoff?.[field] === expected, `founder protected-main evidence cutoff ${field} is stale`);
}
for (const [field, expected] of Object.entries(latestMaterialWebsiteRelease)) {
    requireValue(live.websiteAndGame?.latestMaterialWebsiteRelease?.[field] === expected, `founder latest material website release ${field} is stale`);
    requireValue(firstFive.currentHold?.latestMaterialWebsiteRelease?.[field] === expected, `First Five latest material website release ${field} is stale`);
    requireValue(visualReview.laterProductionOverride?.latestMaterialWebsiteRelease?.[field] === expected, `visual review latest material website release ${field} is stale`);
}
requireValue(live.websiteAndGame?.latestMaterialWebsiteRelease?.officialProjectReciprocalLinkLive === true, 'founder control hides the live reciprocal project link');
requireValue(live.websiteAndGame?.latestMaterialWebsiteRelease?.homepageHatchInvitationLive === true && live.websiteAndGame?.latestMaterialWebsiteRelease?.persistentGameInvitationStillLive === true, 'the live Hatch Challenge invitations are missing');
requireValue(live.websiteAndGame?.latestMaterialWebsiteRelease?.firstGuardianInvitationLive === true && live.websiteAndGame?.latestMaterialWebsiteRelease?.hatchChallengeStartIsPrimary === true, 'the latest live word-of-mouth journey is missing');
requireValue(live.websiteAndGame?.latestMaterialWebsiteRelease?.privateCreatureMediaAvailableToAllAgeBands === true && live.websiteAndGame?.latestMaterialWebsiteRelease?.ageSentToCreatureMediaProvider === false && live.websiteAndGame?.latestMaterialWebsiteRelease?.publicCreatureProfileCreated === false, 'the current private creature-media boundary is missing');
requireValue(firstFive.currentHold?.latestMaterialWebsiteRelease?.technicalRepairStillLive === true && firstFive.currentHold?.latestMaterialWebsiteRelease?.creatureArtworkHumanApproved === false, 'First Five confuses the live technical repair with artwork approval');
requireValue(visualReview.laterProductionOverride?.latestMaterialWebsiteRelease?.firstContactRepairStillPresent === true && visualReview.laterProductionOverride?.latestMaterialWebsiteRelease?.visualApprovalGranted === false, 'visual review confuses current production with artwork approval');
requireValue(homepage.includes('href="https://github.com/TechevolveAI/Mythical-Void"') && storefront.includes('href="https://github.com/TechevolveAI/Mythical-Void"'), 'the live website source does not reciprocally link the verified public project');

requireValue(release.state === 'published_and_verified' && release.publicationCompleted === true, 'GitHub release is falsely described');
requireValue(live.githubEarlyAccessRelease?.state === release.state && live.githubEarlyAccessRelease?.url === release.publicEvidence?.url, 'GitHub release evidence does not match');
requireValue(live.githubEarlyAccessRelease?.gameplayMediaAttached === false && live.githubEarlyAccessRelease?.downloadableBuildAttached === false, 'weak release media or download is falsely recorded');

requireValue(analytics.productionEvidence?.homepageTagScriptObserved === true && analytics.productionEvidence?.gameRuntimeTagScriptObserved === false, 'analytics deployment boundary does not match evidence');
requireValue(analytics.productionEvidence?.googlePropertyEventsVerified === true && analytics.productionEvidence?.measurementTrustedForDecisions === false, 'property receipt must be recorded without trusting analytics outcomes');
requireValue(analytics.propertySideEvidence?.streamName === 'Mythical Void' && analytics.propertySideEvidence?.measurementId === 'G-FTM4W73ECQ' && analytics.propertySideEvidence?.dataCollectionActiveInPast48Hours === true, 'signed-in Mythical Void property evidence is missing');
requireValue(analytics.propertySideEvidence?.enhancedMeasurementEnabled === true && analytics.propertySideEvidence?.propertySettingsChangeMade === false, 'observed analytics privacy gap or no-change boundary is missing');
requireValue(live.websiteAnalytics?.gameExcluded === true && live.websiteAnalytics?.googlePropertyVerified === true && live.websiteAnalytics?.measurementIdMatched === true && live.websiteAnalytics?.dataFlowing === true && live.websiteAnalytics?.enhancedMeasurementEnabled === true && live.websiteAnalytics?.freshConsentJourneyVerified === true && live.websiteAnalytics?.measurementTrustedForDecisions === false, 'founder analytics boundary is invalid');
requireValue(control.helpfulNotBlocking?.analyticsPrivacyReview?.enhancedMeasurementReviewRequired === true && control.helpfulNotBlocking?.analyticsPrivacyReview?.eventDataRetention === '2 months' && control.helpfulNotBlocking?.analyticsPrivacyReview?.userDataRetention === '14 months', 'analytics privacy review is incomplete');
requireValue(control.helpfulNotBlocking?.analyticsPrivacyReview?.settingsChangeAuthorized === false && control.helpfulNotBlocking?.analyticsPrivacyReview?.settingsChangeMade === false, 'analytics settings must not change without approval');

requireValue(firstFive.state === 'held_for_creature_first_impression', 'First Five source is no longer held');
requireValue(firstFive.currentOutcome?.sessionsCompleted === 0 && firstFive.currentHold?.invitationsMayBegin === false && firstFive.currentHold?.promotionMayBegin === false, 'First Five activity is falsely claimed or authorized');
requireValue(control.held?.firstFive?.state === firstFive.state && control.held?.firstFive?.sessionsCompleted === 0 && control.held?.firstFive?.acceptedCustomerEvidence === 0 && control.held?.firstFive?.invitationsMayBegin === false, 'founder First Five hold is invalid');
requireValue(visualReview.state === 'rejected_before_human_approval' && visualReview.decision?.adultHumanApprovalPassed === false, 'latest first-contact visual decision is misrepresented');
requireValue(visualReview.laterProductionOverride?.productionSourceCommit === live.websiteAndGame?.technicalFirstContactProductionSourceCommit && visualReview.laterProductionOverride?.productionDeployId === live.websiteAndGame?.technicalFirstContactProductionDeployId, 'later first-contact production override is missing or inconsistent');
requireValue(visualReview.laterProductionOverride?.visualApprovalGranted === false && visualReview.laterProductionOverride?.firstFiveReleased === false && visualReview.laterProductionOverride?.gameplayPromotionReleased === false, 'technical deployment is being confused with visual or growth approval');
requireValue(visualScreening.decision === 'reject_all_before_kevin_review' && visualScreening.approvedMomentCount === 0 && visualScreening.requiredMomentCount === 4, 'launch visual hold is misrepresented');
requireValue(control.held?.gameplayPromotion?.state === 'held_for_human_visual_approval', 'gameplay promotion must remain held');
for (const field of ['screenshotsMayPublish', 'videosMayPublish', 'founderPostMayPublish']) requireValue(control.held?.gameplayPromotion?.[field] === false, `gameplay promotion ${field} must remain false`);
requireValue(control.held?.outsidePlatforms?.state === 'not_submitted' && control.held?.outsidePlatforms?.platformTermsAccepted === false && control.held?.outsidePlatforms?.platformSdkActivated === false, 'outside platform hold is invalid');

const observedResults = search.latestPublicSample?.queries?.filter(query => query.mythicalResultObserved).length;
requireValue(observedResults === 0 && control.known?.officialResultsObservedInLatestPublicSearchSample === 0, 'search results are falsely claimed');
requireValue(search.searchConsoleAccessCheck?.mythicalVoidPropertyAccessible === false && control.known?.searchConsoleConnected === false, 'Search Console access is falsely claimed');
requireValue(control.known?.firstFiveSessionsCompleted === 0 && control.known?.acceptedCustomerEvidence === 0, 'customer evidence is falsely claimed');
for (const field of ['websiteVisitMayBeCalledPlayer', 'githubViewMayBeCalledPlay', 'enjoymentClaimPermitted', 'retentionClaimPermitted', 'conversionClaimPermitted', 'growthClaimPermitted']) requireValue(control.known?.[field] === false, `unsupported outcome claim is enabled: ${field}`);
requireValue(attention.observations?.repositoryViews?.count === 2 && attention.observations?.repositoryViews?.uniques === 1, 'owned attention source is inconsistent');
requireValue(control.known?.githubRepositoryViewsInRecordedFourteenDayWindow === attention.observations?.repositoryViews?.count && control.known?.githubUniqueRepositoryViewsInRecordedFourteenDayWindow === attention.observations?.repositoryViews?.uniques, 'founder GitHub attention evidence is stale');
requireValue(control.known?.githubClonesMayBeUsedAsAudienceEvidence === false && attention.observations?.repositoryClones?.useForAudienceDecisions === false, 'GitHub clones are being treated as audience evidence');

requireValue(Array.isArray(control.currentDecisions) && control.currentDecisions.length === 1, 'there must be exactly one current founder decision');
requireValue(control.currentDecisions?.[0]?.id === 'FD-002' && control.currentDecisions?.[0]?.owner === 'Kevin', 'current founder decision identity is invalid');
requireValue(control.currentDecisions?.[0]?.question === 'Approve one direct-link r/WebGames post from an existing adult account and personally cover replies for seven days?', 'current founder decision has drifted');
requireValue(control.currentDecisions?.[0]?.preparedDecisionArtifact === 'docs/company/growth/COMMUNITY_DISCOVERY_ACTIVATION_2026-09-08.md' && control.currentDecisions?.[0]?.requires?.length === 3 && control.currentDecisions?.[0]?.postAuthorized === false, 'current community decision is incomplete or pre-authorized');
requireValue(control.currentDecisions?.[0]?.exactApprovalMessage === 'I have an existing adult Reddit account, I approve the exact title, link and first comment below now, and I can personally answer replies for seven days.' && control.currentDecisions?.[0]?.approvalWindowMinutes === 30, 'the exact short-lived community approval is missing');
requireValue(control.heldDecisions?.some(decision => decision.id === 'FD-001' && decision.preparedDecisionArtifact === 'docs/company/product/CREATURE_CONCEPT_ARTIST_BRIEF.md'), 'important creature decision was lost');
requireValue(control.unlockSequence?.length === 5 && control.unlockSequence?.[2] === 'run_action_time_preflight' && control.unlockSequence?.[4] === 'record_day_two_and_day_seven_observations', 'community unlock sequence is invalid');
requireValue(control.firstFiveUnlockSequence?.length === 5 && control.firstFiveUnlockSequence?.[2] === 'adult_human_visual_review' && control.firstFiveUnlockSequence?.[3] === 'five_adult_first_five_test', 'First Five unlock sequence is invalid');
requireValue(community.state === 'one_direct_link_post_ready_waiting_for_kevin' && community.authority?.externalPostMade === false && community.authority?.externalPostingAuthorized === false, 'community source is not ready and held');
const exactCommunityComment = String(community.firstExperiment?.preparedPost?.firstComment || '').replace(/\s+/g, ' ').trim();
const exactCommunityTitle = String(community.firstExperiment?.preparedPost?.title || '').trim();
const exactCommunityUrl = String(community.firstExperiment?.preparedPost?.url || '').trim();
requireValue(
    exactCommunityTitle.length > 0 && normalizedPage.includes(exactCommunityTitle) &&
    exactCommunityUrl.length > 0 && normalizedPage.includes(exactCommunityUrl) &&
    exactCommunityComment.length > 0 && normalizedPage.includes(exactCommunityComment),
    'founder exact community post does not match the authoritative prepared post'
);
requireValue(control.communityExperiment?.id === 'WEBGAMES-FIRST-RUN-001' && control.communityExperiment?.state === 'waiting_for_existing_account_and_action_time_approval' && control.communityExperiment?.postMade === false, 'founder community experiment state is invalid');
requireValue(control.communityExperiment?.oneRouteAtATime === true && control.communityExperiment?.nextRouteBeforeSevenDayReadAllowed === false && control.communityExperiment?.humanRepliesOnly === true && control.communityExperiment?.fakeEngagementAllowed === false, 'community experiment safety boundary is invalid');
const preparedRoutes = control.preparedDiscoveryRoutes || {};
const indieDbRoute = (discoveryDoorways.routes || []).find(route => route.id === 'indiedb');
requireValue(discoveryDoorways.routes?.length === 13 && preparedRoutes.checkedRoutes === 13, 'founder control discovery route count is stale');
requireValue(preparedRoutes.source === 'docs/company/growth/DISCOVERY_DOORWAY_REGISTRY_2026-09-08.json' && preparedRoutes.oneRouteAtATime === true && preparedRoutes.firstRoute === 'r/WebGames' && preparedRoutes.secondRoute === 'Phaser Showcase', 'founder discovery order is invalid');
requireValue(preparedRoutes.indieDb?.candidate === 'docs/company/growth/INDIEDB_PAGE_CANDIDATE_2026-09-08.json' && preparedRoutes.indieDb?.state === indieDbRoute?.state && indieDbRoute?.preparedArtifact === preparedRoutes.indieDb?.candidate, 'founder IndieDB packet is detached from the discovery registry');
requireValue(preparedRoutes.indieDb?.candidateState === indieDbCandidate.state && indieDbCandidate.releaseGate?.readyForPublication === false, 'founder IndieDB packet state is inaccurate');
for (const field of ['accountOpened', 'termsAccepted', 'pageCreated', 'pagePublished']) requireValue(preparedRoutes.indieDb?.[field] === false, `founder IndieDB ${field} must remain false`);
requireValue(indieDbCandidate.authority?.accountOpened === false && indieDbCandidate.termsReview?.accepted === false && indieDbCandidate.releaseGate?.pageSaved === false && indieDbCandidate.releaseGate?.pagePublished === false, 'IndieDB source records an unauthorized external action');
requireValue(preparedRoutes.itch?.candidate === 'docs/company/growth/ITCH_RELEASE_CANDIDATE.json' && preparedRoutes.itch?.uploaded === false && preparedRoutes.itch?.testedInsideActualPlatform === false, 'founder itch route is inaccurate');
requireValue(preparedRoutes.editorial?.candidate === 'docs/company/growth/EDITORIAL_DISCOVERY_SHORTLIST_2026-09-10.json' && preparedRoutes.editorial?.messagesSent === 0, 'founder editorial route is inaccurate');
requireValue(preparedRoutes.social?.candidate === 'docs/company/content/channel-launch/SOCIAL_FIRST_WEEK_OPERATING_PACK_2026-09-09.json' && preparedRoutes.social?.postsMade === 0, 'founder social route is inaccurate');

requireValue(control.languageAndSafety?.publicCreatureTerm === 'creatures' && control.languageAndSafety?.companionTermAllowed === false, 'public creature language boundary is invalid');
requireValue(control.languageAndSafety?.childExactAgeAllowed === false && control.languageAndSafety?.childNamePhotoOrContactAllowed === false, 'child privacy boundary is invalid');
requireValue(control.languageAndSafety?.generatedArtworkMayBeCalledGameplay === false && control.languageAndSafety?.generatedSupportLabel === 'AI-created interpretation — not gameplay', 'generated artwork boundary is invalid');
requireValue(control.languageAndSafety?.nasaEndorsementClaimed === false, 'NASA endorsement must not be claimed');
for (const field of ['publicPostAuthorized', 'directContactAuthorized', 'spendAuthorized', 'newAccountAuthorized', 'platformTermsAuthorized', 'platformSubmissionAuthorized', 'childContactAuthorized', 'inventedActivityAuthorized']) requireValue(control.authority?.[field] === false, `founder authority ${field} must remain false`);

for (const phrase of [
    '# Mythical Void: founder control page',
    'refreshed on 10 September 2026',
    'The website returned after an earlier hosting interruption.',
    'all 16 sitemap pages, six additional important routes and 57 unique owned links',
    'This proves availability, not players, enjoyment or growth.',
    '6aa28a3fc73e5a0008dfa810',
    '13ad7ff85fd3e77277c378f3b0d2f033cfa761a5',
    'npm run founder:status',
    'If the game is unavailable, every discovery route automatically returns to hold.',
    'The first-contact layout repair is live',
    'not approval of the creature artwork',
    'Private creature pictures and short films are available in the game',
    'the chosen age stays in the browser and no public creature profile is created',
    'The First Five test',
    'no adults have been invited',
    '0 sessions',
    '0 accepted customer evidence',
    'The one decision that matters now',
    'Approve one direct-link r/WebGames test from an adult Reddit account.',
    'I have an existing adult Reddit account, I approve the exact title, link and first comment below now, and I can personally answer replies for seven days.',
    'Mythical Void - my son and I made a free alien creature adventure',
    'https://mythicalvoid.com/play/',
    'Nothing has been posted.',
    '2 repository views from 1 person',
    'Thirteen discovery routes have now been checked',
    'What is ready behind the first community test',
    'the full game-page copy and rights checklist are prepared',
    'A current 92-file package passed local 390px browser checks',
    'tailored messages for Alpha Beta Gamer, Free Game Planet and Indie Games Plus are ready',
    'the father-and-son story is prepared in Kevin',
    'That check must not save or publish a page.',
    'The important product decision that remains held',
    'A person—not an automated check—must approve it',
    'NASA does not make or endorse Mythical Void.',
    'No setting has been changed.',
    'Kevin controls public posts'
]) requireValue(normalizedPage.includes(phrase), `plain-language founder page is missing: ${phrase}`);
requireValue(!/\bcompanions?\b/i.test(page), 'outdated companion wording appears on the founder page');
requireValue(!/Project Beacon/i.test(page), 'unexplained Project Beacon wording appears on the founder page');
requireValue(!/\b(?:nine|9)[ -]year[ -]old\b/i.test(page), 'the founder page exposes a child\'s exact age');
requireValue(!/NASA[- ](?:powered|endorsed)|official NASA game/i.test(page), 'the founder page implies NASA endorsement');
requireValue(normalizedScoreboard.includes('Checked: 8 September 2026'), 'growth scoreboard check date is stale');
requireValue(normalizedScoreboard.includes('website now links back to that official project'), 'growth scoreboard hides the live reciprocal project link');
requireValue(normalizedScoreboard.includes('The technical first-contact repair is live'), 'growth scoreboard hides the live technical repair');
requireValue(normalizedScoreboard.includes('Deployment did not approve the creature artwork or release the First Five test.'), 'growth scoreboard confuses deployment with visual approval');
requireValue(normalizedFirstFivePage.includes('Kevin later approved deployment of the technical presentation repair'), 'First Five page still says the technical repair was never deployed');
requireValue(normalizedFirstFivePage.includes('did not approve the creature artwork, release this test or authorize invitations'), 'First Five page loses the post-deploy hold');
const discoveryScore = (currentState.scorecard || []).find(item => item.measure === 'Public discovery checks');
const searchExperiment = (currentState.experiments || []).find(item => item.id === 'E-001');
requireValue(discoveryScore?.current?.includes('official website now links back to that verified public project'), 'current-state scorecard still describes the reciprocal project link as merely prepared');
requireValue(searchExperiment?.signal?.includes('official website now links back to that verified public project'), 'current-state search experiment still describes the reciprocal project link as merely prepared');

requireValue(Array.isArray(control.sources) && control.sources.length === 15, 'founder control sources are incomplete');
for (const source of control.sources || []) requireValue(fs.existsSync(path.join(root, source)), `founder control source does not exist: ${source}`);
requireValue(packageJson.scripts?.['validate:founder-control'] === 'node scripts/company/validate-founder-control-page.cjs', 'founder control validator command is missing');
requireValue(packageJson.scripts?.['test:founder-control'] === 'node scripts/company/test-founder-control-page.cjs', 'founder control safeguard command is missing');
requireValue(packageJson.scripts?.['founder:status'] === 'node scripts/company/founder-live-status.cjs', 'fresh founder status command is missing');
requireValue(packageJson.scripts?.['test:founder-status'] === 'node scripts/company/test-founder-live-status.cjs', 'fresh founder status safeguards are missing');

if (failures.length) {
    console.error('Founder control page is incomplete or unsafe:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    state: control.state,
    liveWebsite: true,
    freshStatusCommand: doorway.freshStatusCommand,
    observedProductionDeployId: doorway.observedProductionAtCheck.deployId,
    observedProductionSourceCommit: doorway.observedProductionAtCheck.sourceCommit,
    historicalFirstContactReleasePullRequest: latestGameRelease.pullRequest,
    technicalRepairLive: true,
    creatureArtworkHumanApproved: false,
    firstFiveSessionsCompleted: 0,
    acceptedCustomerEvidence: 0,
    currentDecisionCount: 1,
    currentDecisionId: control.currentDecisions[0].id,
    heldDecisionCount: control.heldDecisions.length,
    communityPostMade: false,
    externalAuthorityGranted: false
}, null, 2));
