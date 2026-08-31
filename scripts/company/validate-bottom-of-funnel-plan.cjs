#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1
    ? path.resolve(__dirname, '..', '..')
    : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const plan = JSON.parse(read('docs/company/growth/BOTTOM_OF_FUNNEL_DISTRIBUTION_PLAN.json'));
const planText = read('docs/company/growth/BOTTOM_OF_FUNNEL_DISTRIBUTION_PLAN.md');
const itchCandidate = JSON.parse(read('docs/company/growth/ITCH_RELEASE_CANDIDATE.json'));
const itchCandidateText = read('docs/company/growth/ITCH_RELEASE_CANDIDATE.md');
const firstFive = JSON.parse(read('docs/company/research/first-five-playtest.json'));
const packageJson = JSON.parse(read('package.json'));
const mainSource = read('src/main.js');
const viteSource = read('vite.config.mjs');
const playable = read('public/playable-now/index.html');
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

requireValue(plan.id === 'BOTTOM-OF-FUNNEL-001', 'distribution plan id is missing');
requireValue(plan.checkedOn === '2026-08-31', 'player-decision review date is stale');
requireValue(plan.state === 'owned_entry_live_first_five_held_itch_candidate_waiting', 'distribution plan state is stale');
requireValue(plan.playerDecisionModel?.sequence?.join('|') === 'wanted feeling|believable fit|real gameplay proof|trust|low-friction start', 'player-decision sequence is missing or out of order');
requireValue(plan.playerDecisionModel?.supportingReasonsAfterGameIsClear?.includes('NASA-sourced STEM moments'), 'NASA/STEM must support rather than replace the playable promise');
requireValue(plan.endOfFunnelRoute?.path?.at(-1) === 'meaningful action in the first minute', 'the funnel must end in meaningful play');
requireValue(plan.endOfFunnelRoute?.mustNotInsert?.includes('account creation'), 'the low-friction account boundary is missing');
requireValue(plan.endOfFunnelRoute?.firstReleaseEvidence?.includes('meaningful action or hatch reached'), 'first-value measurement is missing');
requireValue(plan.readyFallbackShelf?.name === 'itch.io', 'itch.io must remain the ready fallback shelf');
requireValue(plan.readyFallbackShelf?.publicationAuthorized === false, 'external publication must wait for Kevin');
requireValue(plan.readyFallbackShelf?.rightsDecisionRequiredBeforePublication === true, 'the distribution-rights choice must happen before publication');
requireValue(plan.readyFallbackShelf?.requirements?.requiredScreenshotsForInitialHonestPage === 0, 'the plan invents a screenshot requirement for the first page');
requireValue(plan.readyFallbackShelf?.gates?.includes('reviewed brand cover approved by Kevin'), 'Kevin cover approval gate is missing');
requireValue(plan.readyFallbackShelf?.gates?.includes('embedded browser package tested'), 'the embedded build gate is missing');
requireValue(plan.readyFallbackShelf?.technicalEvidence?.nestedFrameTestPassed === true, 'the nested frame test evidence is missing');
requireValue(plan.readyFallbackShelf?.technicalEvidence?.fileCount === 86 && plan.readyFallbackShelf?.technicalEvidence?.extractedBytes === 33317542, 'the latest portal measurement is stale');
requireValue(plan.readyFallbackShelf?.technicalEvidence?.withdrawnMediaIncluded === false, 'withdrawn media must remain outside the portal package');
requireValue(plan.readyFallbackShelf?.visualEvidence?.gameplayScreenshotsAttached === 0 && plan.readyFallbackShelf?.visualEvidence?.brandCoverExplicitlyMarkedNotGameplay === true, 'itch visual evidence is not truthful');
requireValue(plan.routeOrder?.find(route => route.name === 'itch.io')?.state === 'package_copy_and_reviewed_cover_ready_not_published', 'itch.io route state is stale');
requireValue(plan.routeOrder?.[0]?.url === 'https://mythicalvoid.com/playable-now/', 'the owned search doorway must stay first and live');
requireValue(plan.routeOrder?.find(route => route.name === 'YouTube')?.state === 'held_for_visual_quality', 'YouTube must remain behind the visual gate');
requireValue(plan.routeOrder?.find(route => route.name === 'Poki')?.state === 'high_upside_option_preserved_not_submitted', 'Poki option state is stale');
requireValue(plan.distributionRightsFork?.decisionId === 'D-018', 'distribution rights decision is missing');
requireValue(plan.distributionRightsFork?.pokiPreferredDealWebExclusive === true, 'Poki web exclusivity fact is missing');
requireValue(plan.distributionRightsFork?.pokiIndicativeExclusiveTermYears === 5, 'Poki indicative term is missing');
requireValue(plan.distributionRightsFork?.companyRecommendation === 'itch.io_first_for_learning_after_first_five', 'the company distribution recommendation is missing');
requireValue(plan.distributionRightsFork?.decisionMade === false, 'distribution decision must remain open');
requireValue(plan.firstFive?.state === firstFive.state && plan.firstFive?.peopleContacted === 0, 'First Five readiness state is stale');
requireValue(plan.firstFive?.blockingReview === firstFive.entryGates?.blockingReviewRef && plan.firstFive?.invitationsMayBegin === false, 'First Five visual hold is missing from distribution');
requireValue(firstFive.entryGates?.kevinApprovedPurposeAndInvitations === false && firstFive.authority?.participantContactAuthorized === false, 'First Five must remain waiting for Kevin approval');
for (const field of ['externalPublishingAuthorized', 'paidPromotionAuthorized', 'bulkOutreachAuthorized', 'directChildContactAuthorized', 'imaginedArtMayBeCalledGameplay', 'portalAcceptanceMayBePromised', 'pokiAccessRequestAuthorized', 'webExclusivityMayBeAccepted']) {
    requireValue(plan.boundaries?.[field] === false, `boundary ${field} must remain false`);
}
for (const phrase of ['A free browser adventure', 'What makes somebody start a game', 'The end of the funnel', 'The first distribution move', 'One important choice before itch.io', 'Why itch.io is first if Kevin chooses speed', 'None on the first page', 'What Kevin now needs to approve', 'NASA endorsement']) {
    requireValue(planText.includes(phrase), `plain-language plan is missing: ${phrase}`);
}
for (const source of plan.sources || []) requireValue(planText.includes(source), `plain-language plan is missing source: ${source}`);
for (const phrase of ['LOOKING FOR A NEW GAME? PLAY FREE ONLINE', 'Hatch a strange alien creature. Save six living realms.', 'Free · No game ads · No chat with other players · No download · No account · No payment details · Early access', 'Hatch a creature shaped by genetics']) {
    requireValue(playable.includes(phrase), `playable search doorway is missing: ${phrase}`);
}
requireValue(playable.indexOf('id="find-your-way"') < playable.indexOf('class="truth-strip"'), 'the owned search doorway is not the first main decision');
requireValue(itchCandidate.state === 'technical_package_ready_no_screenshot_page_ready_cover_account_rights_and_terms_approval_pending', 'itch release candidate state is invalid');
requireValue(itchCandidate.directPlay === true && itchCandidate.entryPoint === 'index.html', 'itch candidate must open the game directly');
requireValue(itchCandidate.visualGate?.approvedMoments === 0 && itchCandidate.visualGate?.recommendedMoments === 4 && itchCandidate.visualGate?.requiredMomentsForInitialPublication === 0, 'itch candidate visual counts are stale');
requireValue(itchCandidate.visualGate?.cover?.adultVisualReviewPassed === true && itchCandidate.visualGate?.cover?.kevinApproved === false, 'itch cover approval state is stale');
for (const field of ['externalPublicationAuthorized', 'platformTermsAccepted', 'paidPromotionAuthorized', 'directMessagesAuthorized', 'bulkOutreachAuthorized', 'hostedAiMediaPromisedInPortal', 'liveNasaDataGuaranteed']) {
    requireValue(itchCandidate.boundaries?.[field] === false, `itch boundary ${field} must remain false`);
}
for (const phrase of ['opens the game immediately', 'does not run the Mythical Void website’s Google tag', '0 of 4 recommended images approved', 'honest first page will use none', 'Optional hosted AI portraits']) {
    requireValue(itchCandidateText.includes(phrase), `itch release explanation is missing: ${phrase}`);
}
requireValue(packageJson.scripts?.['build:itch']?.includes('validate-itch-package.cjs'), 'itch package validation is not part of its build');
requireValue(packageJson.scripts?.build?.includes('npm run build:itch'), 'production checks must exercise the itch build');
requireValue(mainSource.includes("import.meta.env.MODE === 'itch'"), 'the direct-play build switch is missing');
requireValue(viteSource.includes("base: isItchBuild ? './' : '/'"), 'the itch build does not use project-relative paths');

if (failures.length) {
    console.error('Bottom-of-funnel distribution plan is not ready:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    ownedSearchDoorway: 'live',
    recommendedFirstAction: 'approve creature art direction and pass the first-contact visual gate',
    recommendedFirstPublicShelf: 'itch.io after First Five and Kevin distribution approval',
    readyFallbackShelf: 'itch.io',
    itchTechnicalPackageReady: true,
    itchNoScreenshotPageReady: true,
    itchPublicationAuthorized: false,
    futureGameplayVisualGateOpen: false,
    externalSpendAuthorized: false
}, null, 2));
