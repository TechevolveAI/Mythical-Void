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
const packageJson = load('package.json');
const normalizedPage = page.replace(/\*\*/g, '').replace(/\s+/g, ' ');
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

requireValue(control.schemaVersion === 1 && control.id === 'FOUNDER-CONTROL-001', 'founder control identity is invalid');
requireValue(control.asOf === '2026-08-31' && control.state === 'live_with_creature_visual_growth_hold', 'founder control state or date is invalid');
requireValue(control.plainLanguagePage === 'docs/company/FOUNDER_CONTROL_PAGE.md', 'plain-language page path is invalid');

const live = control.live || {};
requireValue(live.websiteAndGame?.state === 'live', 'website and game must be recorded as live');
requireValue(live.websiteAndGame?.websiteUrl === 'https://mythicalvoid.com/' && live.websiteAndGame?.playUrl === 'https://mythicalvoid.com/play/', 'clean owned website links are missing');
requireValue(live.websiteAndGame?.productionSourceCommit === 'e9293f09d2ed5332d5538c05f051560d29e4d5e3' && live.websiteAndGame?.productionDeployId === '6a951fc9e33f9100083fb699', 'current production evidence is missing');
requireValue(live.websiteAndGame?.technicalFirstContactRepairLive === true, 'live first-contact repair is hidden');
requireValue(live.websiteAndGame?.creatureArtworkHumanApproved === false, 'deployment must not be treated as visual approval');
requireValue(firstFive.currentHold?.candidateDeployed === true && firstFive.currentHold?.productionSourceCommit === live.websiteAndGame?.productionSourceCommit && firstFive.currentHold?.productionDeployId === live.websiteAndGame?.productionDeployId, 'First Five and founder production evidence disagree');

requireValue(release.state === 'published_and_verified' && release.publicationCompleted === true, 'GitHub release is falsely described');
requireValue(live.githubEarlyAccessRelease?.state === release.state && live.githubEarlyAccessRelease?.url === release.publicEvidence?.url, 'GitHub release evidence does not match');
requireValue(live.githubEarlyAccessRelease?.gameplayMediaAttached === false && live.githubEarlyAccessRelease?.downloadableBuildAttached === false, 'weak release media or download is falsely recorded');

requireValue(analytics.productionEvidence?.homepageTagScriptObserved === true && analytics.productionEvidence?.gameRuntimeTagScriptObserved === false, 'analytics deployment boundary does not match evidence');
requireValue(analytics.productionEvidence?.googlePropertyEventsVerified === true && analytics.productionEvidence?.measurementTrustedForDecisions === false, 'property receipt must be recorded without trusting analytics outcomes');
requireValue(analytics.propertySideEvidence?.streamName === 'Mythical Void' && analytics.propertySideEvidence?.measurementId === 'G-FTM4W73ECQ' && analytics.propertySideEvidence?.dataCollectionActiveInPast48Hours === true, 'signed-in Mythical Void property evidence is missing');
requireValue(analytics.propertySideEvidence?.enhancedMeasurementEnabled === true && analytics.propertySideEvidence?.propertySettingsChangeMade === false, 'observed analytics privacy gap or no-change boundary is missing');
requireValue(live.websiteAnalytics?.gameExcluded === true && live.websiteAnalytics?.googlePropertyVerified === true && live.websiteAnalytics?.measurementIdMatched === true && live.websiteAnalytics?.dataFlowing === true && live.websiteAnalytics?.enhancedMeasurementEnabled === true && live.websiteAnalytics?.freshConsentJourneyVerified === false && live.websiteAnalytics?.measurementTrustedForDecisions === false, 'founder analytics boundary is invalid');
requireValue(control.helpfulNotBlocking?.analyticsPrivacyReview?.enhancedMeasurementReviewRequired === true && control.helpfulNotBlocking?.analyticsPrivacyReview?.eventDataRetention === '2 months' && control.helpfulNotBlocking?.analyticsPrivacyReview?.userDataRetention === '14 months', 'analytics privacy review is incomplete');
requireValue(control.helpfulNotBlocking?.analyticsPrivacyReview?.settingsChangeAuthorized === false && control.helpfulNotBlocking?.analyticsPrivacyReview?.settingsChangeMade === false, 'analytics settings must not change without approval');

requireValue(firstFive.state === 'held_for_creature_first_impression', 'First Five source is no longer held');
requireValue(firstFive.currentOutcome?.sessionsCompleted === 0 && firstFive.currentHold?.invitationsMayBegin === false && firstFive.currentHold?.promotionMayBegin === false, 'First Five activity is falsely claimed or authorized');
requireValue(control.held?.firstFive?.state === firstFive.state && control.held?.firstFive?.sessionsCompleted === 0 && control.held?.firstFive?.acceptedCustomerEvidence === 0 && control.held?.firstFive?.invitationsMayBegin === false, 'founder First Five hold is invalid');
requireValue(visualReview.state === 'rejected_before_human_approval' && visualReview.decision?.adultHumanApprovalPassed === false, 'latest first-contact visual decision is misrepresented');
requireValue(visualReview.laterProductionOverride?.productionSourceCommit === live.websiteAndGame?.productionSourceCommit && visualReview.laterProductionOverride?.productionDeployId === live.websiteAndGame?.productionDeployId, 'later production override is missing or inconsistent');
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

requireValue(Array.isArray(control.currentDecisions) && control.currentDecisions.length === 1, 'there must be exactly one current founder decision');
requireValue(control.currentDecisions?.[0]?.id === 'FD-001' && control.currentDecisions?.[0]?.owner === 'Kevin', 'current founder decision identity is invalid');
requireValue(control.currentDecisions?.[0]?.question === 'Choose the visual anchor for a creature people can love and recognise.', 'current founder decision has drifted');
requireValue(control.currentDecisions?.[0]?.waysToUnlock?.length === 2, 'founder decision must offer two clear ways forward');
requireValue(control.unlockSequence?.length === 5 && control.unlockSequence?.[2] === 'adult_human_visual_review' && control.unlockSequence?.[3] === 'five_adult_first_five_test', 'safe unlock sequence is invalid');

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
    'Choose the visual anchor for a creature people can love and recognise.',
    'A person—not an automated check—must approve it.',
    'NASA does not make or endorse Mythical Void.',
    'No setting has been changed.',
    'Kevin controls public posts'
]) requireValue(normalizedPage.includes(phrase), `plain-language founder page is missing: ${phrase}`);
requireValue(!/\bcompanions?\b/i.test(page), 'outdated companion wording appears on the founder page');
requireValue(!/\b(?:nine|9)[ -]year[ -]old\b/i.test(page), 'the founder page exposes a child\'s exact age');
requireValue(!/NASA[- ](?:powered|endorsed)|official NASA game/i.test(page), 'the founder page implies NASA endorsement');

requireValue(Array.isArray(control.sources) && control.sources.length === 8, 'founder control sources are incomplete');
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
    technicalRepairLive: true,
    creatureArtworkHumanApproved: false,
    firstFiveSessionsCompleted: 0,
    acceptedCustomerEvidence: 0,
    currentDecisionCount: 1,
    externalAuthorityGranted: false
}, null, 2));
