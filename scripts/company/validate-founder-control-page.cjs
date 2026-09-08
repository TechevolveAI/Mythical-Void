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
    checkedOn: '2026-09-08',
    sourceCommit: '2f27a384f6cfa4438e392b8ddbf6e744b5108e47',
    protectedMainMergeCommit: '02e76598a7ea0c7769b85627a67115dc5f19a034',
    deployId: '6aa03b1c6b8c9a0008c5d4ad',
    publishedAt: '2026-09-08T16:46:54.447Z',
    sourceAndProductionTreesMatch: true
};

requireValue(control.schemaVersion === 1 && control.id === 'FOUNDER-CONTROL-001', 'founder control identity is invalid');
requireValue(control.asOf === '2026-09-08' && control.state === 'live_one_community_test_ready', 'founder control state or date is invalid');
requireValue(control.plainLanguagePage === 'docs/company/FOUNDER_CONTROL_PAGE.md', 'plain-language page path is invalid');

const live = control.live || {};
requireValue(live.websiteAndGame?.state === 'live', 'website and game must be recorded as live');
requireValue(live.websiteAndGame?.websiteUrl === 'https://mythicalvoid.com/' && live.websiteAndGame?.playUrl === 'https://mythicalvoid.com/play/', 'clean owned website links are missing');
requireValue(live.websiteAndGame?.technicalFirstContactProductionSourceCommit === 'e9293f09d2ed5332d5538c05f051560d29e4d5e3' && live.websiteAndGame?.technicalFirstContactProductionDeployId === '6a951fc9e33f9100083fb699', 'technical first-contact production evidence is missing');
requireValue(live.websiteAndGame?.technicalFirstContactRepairLive === true, 'live first-contact repair is hidden');
requireValue(live.websiteAndGame?.creatureArtworkHumanApproved === false, 'deployment must not be treated as visual approval');
requireValue(firstFive.currentHold?.candidateDeployed === true && firstFive.currentHold?.productionSourceCommit === live.websiteAndGame?.technicalFirstContactProductionSourceCommit && firstFive.currentHold?.productionDeployId === live.websiteAndGame?.technicalFirstContactProductionDeployId, 'First Five and founder first-contact production evidence disagree');
const lastObservedProduction = live.websiteAndGame?.lastObservedProduction || {};
requireValue(/^2026-09-08T/.test(lastObservedProduction.checkedAt || '') && /^[0-9a-f]{40}$/.test(lastObservedProduction.sourceCommit || '') && /^[0-9a-f]{24}$/.test(lastObservedProduction.deployId || ''), 'latest observed production identity is invalid');
requireValue(lastObservedProduction.state === 'ready' && lastObservedProduction.published === true, 'latest observed production is not proven ready and published');
requireValue(lastObservedProduction.sourceCommit === latestMaterialWebsiteRelease.protectedMainMergeCommit && lastObservedProduction.deployId === latestMaterialWebsiteRelease.deployId, 'latest observed production does not match the live website release');
const latestGameRelease = live.websiteAndGame?.latestGameRelease || {};
requireValue(latestGameRelease.pullRequest === 197 && latestGameRelease.mergeCommit === '867db60674440297e92c323dd80cc85d57389752' && latestGameRelease.containedInLastObservedProduction === true, 'latest game release is missing from the production record');
for (const [field, expected] of Object.entries(latestMaterialWebsiteRelease)) {
    requireValue(live.websiteAndGame?.latestMaterialWebsiteRelease?.[field] === expected, `founder latest material website release ${field} is stale`);
    requireValue(firstFive.currentHold?.latestMaterialWebsiteRelease?.[field] === expected, `First Five latest material website release ${field} is stale`);
    requireValue(visualReview.laterProductionOverride?.latestMaterialWebsiteRelease?.[field] === expected, `visual review latest material website release ${field} is stale`);
}
requireValue(live.websiteAndGame?.latestMaterialWebsiteRelease?.officialProjectReciprocalLinkLive === true, 'founder control hides the live reciprocal project link');
requireValue(live.websiteAndGame?.latestMaterialWebsiteRelease?.homepageHatchInvitationLive === true && live.websiteAndGame?.latestMaterialWebsiteRelease?.persistentGameInvitationStillLive === true, 'the live Hatch Challenge invitations are missing');
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
requireValue(control.communityExperiment?.id === 'WEBGAMES-FIRST-RUN-001' && control.communityExperiment?.state === 'waiting_for_existing_account_and_action_time_approval' && control.communityExperiment?.postMade === false, 'founder community experiment state is invalid');
requireValue(control.communityExperiment?.oneRouteAtATime === true && control.communityExperiment?.nextRouteBeforeSevenDayReadAllowed === false && control.communityExperiment?.humanRepliesOnly === true && control.communityExperiment?.fakeEngagementAllowed === false, 'community experiment safety boundary is invalid');

requireValue(control.languageAndSafety?.publicCreatureTerm === 'creatures' && control.languageAndSafety?.companionTermAllowed === false, 'public creature language boundary is invalid');
requireValue(control.languageAndSafety?.childExactAgeAllowed === false && control.languageAndSafety?.childNamePhotoOrContactAllowed === false, 'child privacy boundary is invalid');
requireValue(control.languageAndSafety?.generatedArtworkMayBeCalledGameplay === false && control.languageAndSafety?.generatedSupportLabel === 'AI-created interpretation — not gameplay', 'generated artwork boundary is invalid');
requireValue(control.languageAndSafety?.nasaEndorsementClaimed === false, 'NASA endorsement must not be claimed');
for (const field of ['publicPostAuthorized', 'directContactAuthorized', 'spendAuthorized', 'newAccountAuthorized', 'platformTermsAuthorized', 'platformSubmissionAuthorized', 'childContactAuthorized']) requireValue(control.authority?.[field] === false, `founder authority ${field} must remain false`);

for (const phrase of [
    '# Mythical Void: founder control page',
    'The first-contact layout repair is live',
    'not approval of the creature artwork',
    'The First Five test',
    'no adults have been invited',
    '0 sessions',
    '0 accepted customer evidence',
    'The one decision that matters now',
    'Approve one direct-link r/WebGames test from an adult Reddit account.',
    'I have an existing adult Reddit account, I approve the exact title, link and first comment below now, and I can personally answer replies for seven days.',
    'Mythical Void — hatch an alien creature and explore six strange worlds',
    'https://mythicalvoid.com/play/',
    'Nothing has been posted.',
    '2 repository views from 1 person',
    'The important product decision that remains held',
    'A person—not an automated check—must approve it',
    'NASA does not make or endorse Mythical Void.',
    'No setting has been changed.',
    'Kevin controls public posts'
]) requireValue(normalizedPage.includes(phrase), `plain-language founder page is missing: ${phrase}`);
requireValue(!/\bcompanions?\b/i.test(page), 'outdated companion wording appears on the founder page');
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

requireValue(Array.isArray(control.sources) && control.sources.length === 10, 'founder control sources are incomplete');
for (const source of control.sources || []) requireValue(fs.existsSync(path.join(root, source)), `founder control source does not exist: ${source}`);
requireValue(packageJson.scripts?.['validate:founder-control'] === 'node scripts/company/validate-founder-control-page.cjs', 'founder control validator command is missing');
requireValue(packageJson.scripts?.['test:founder-control'] === 'node scripts/company/test-founder-control-page.cjs', 'founder control safeguard command is missing');

if (failures.length) {
    console.error('Founder control page is incomplete or unsafe:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    state: control.state,
    liveWebsite: true,
    latestGameReleasePullRequest: latestGameRelease.pullRequest,
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
