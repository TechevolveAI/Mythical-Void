#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1
    ? path.resolve(__dirname, '..', '..')
    : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const page = read('public/playable-now/index.html');
const discovery = read('public/discovery.js');
const discoveryCss = read('public/discovery.css');
const plan = JSON.parse(read('docs/company/growth/PLAY_INTENT_DOORWAY.json'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

const expected = [
    ['wonder', 'Show me something strange', 'intent_wonder'],
    ['create', 'Let me make something', 'intent_create'],
    ['challenge', 'Give me a mission', 'intent_challenge'],
    ['story', 'Make my choices matter', 'intent_story']
];

requireValue(plan.releaseId === 'PLAY-INTENT-DOORWAY-2026-08-26', 'release identity is missing');
requireValue(plan.state === 'owned_site_release_live_verified', 'release authority state is invalid');
requireValue(plan.publicRoute === 'https://mythicalvoid.com/playable-now/', 'public route is invalid');
requireValue(page.includes('<h1>Hatch a strange alien creature. Save six living realms.</h1>'), 'clear first-screen game promise is missing');
requireValue(page.includes('<strong>What are you in the mood for?</strong>'), 'plain-language optional choice is missing');
requireValue(page.includes('id="find-your-way"'), 'play-intent doorway needs a stable homepage destination');
requireValue(page.includes('Free · No download · No account · No payment details · Early access'), 'public access promise is missing');
requireValue(page.includes('class="play-intent-direct"') && page.includes('Start in one click. The four paths below are optional.'), 'first-screen direct Play choice is missing');
requireValue(page.includes('data-play-link data-source-area="hero"'), 'first-screen direct Play source is missing');
requireValue(page.includes('data-play-intent') && page.includes('data-intent-answer hidden'), 'progressive intent doorway is missing');
requireValue(page.includes('YOUR STARTER MISSION') && page.includes('data-intent-mission-title') && page.includes('data-intent-mission-steps') && page.includes('data-intent-finish'), 'starter mission bridge is missing');
requireValue(page.includes('data-intent-share data-source-area') && page.includes('Share this way in') && page.includes('data-intent-share-status'), 'intent-specific sharing controls are missing');
requireValue(page.includes('<noscript>') && page.includes('Play Mythical Void free in your browser'), 'no-script Play route is missing');
requireValue((page.match(/data-intent-choice=/g) || []).length === 4, 'intent doorway must contain exactly four choices');
requireValue((page.match(/href="\/play\/"/g) || []).length >= 4, 'page lost its clean Play routes');
requireValue(!/[?&](?:utm_|ref=|source=|gclid|fbclid)/i.test(page), 'intent doorway contains a tracking address');
requireValue(!/<form\b/i.test(page), 'intent doorway must not collect form data');
requireValue(!/\bcompanions?\b/i.test(page), 'retired companion wording is present');

for (const [id, button, sourceArea] of expected) {
    const promise = plan.promises?.find(item => item.id === id);
    requireValue(Boolean(promise), `plan is missing ${id}`);
    requireValue(promise?.button === button, `plan button drifted for ${id}`);
    requireValue(promise?.sourceArea === sourceArea, `plan source area drifted for ${id}`);
    requireValue(typeof promise?.starterMission?.title === 'string' && promise.starterMission.title.length >= 12, `plan starter mission title is missing for ${id}`);
    requireValue(Array.isArray(promise?.starterMission?.steps) && promise.starterMission.steps.length === 3, `plan needs three starter mission steps for ${id}`);
    requireValue(typeof promise?.starterMission?.finish === 'string' && promise.starterMission.finish.length >= 30, `plan starter mission finish line is missing for ${id}`);
    requireValue(page.includes(`data-intent-choice="${id}"`) && page.includes(button), `page is missing ${id}`);
    requireValue(discovery.includes(`${id}: {`) && discovery.includes(`sourceArea: '${sourceArea}'`), `script is missing ${id}`);
    requireValue(discovery.includes(`'${sourceArea}'`), `analytics allowlist is missing ${sourceArea}`);
}

requireValue(discovery.includes("declaredArea.dataset.sourceArea"), 'Play source does not use the selected doorway');
requireValue((discovery.match(/missionTitle:/g) || []).length === 4 && (discovery.match(/missionSteps:/g) || []).length === 4 && (discovery.match(/finish:/g) || []).length === 4, 'each reason to play needs one concrete starter mission');
requireValue(discovery.includes('intentMissionSteps.replaceChildren()') && discovery.includes('message.missionSteps.forEach') && discovery.includes('intentFinish.textContent = message.finish'), 'starter mission steps do not render safely from the selected reason');
requireValue(discovery.includes("button.insertAdjacentElement('afterend', intentAnswer)") && discovery.includes("intentAnswer.scrollIntoView({ behavior: 'smooth', block: 'nearest' })"), 'phone visitors are not shown the answer beside their selected choice');
requireValue(discovery.includes("window.addEventListener('resize'") && discovery.includes("intentGrid.insertAdjacentElement('afterend', intentAnswer)"), 'the phone answer does not return to the normal layout after resizing');
requireValue(discovery.includes("window.location.hash.indexOf('#find-your-way') === 0") && discovery.includes('isFirstMainSection') && discovery.includes('window.scrollTo({ top: 0, left: 0 })') && discovery.includes("intentRoot.scrollIntoView({ block: 'start' })"), 'the shared doorway does not preserve the first-screen header or settle reliably after page load');
requireValue(discovery.includes("/^#find-your-way\\/(wonder|create|challenge|story)$/") && discovery.includes('intentIdFromHash()'), 'shared intent routes are not restricted to the four public choices');
requireValue(discovery.includes("shareUrl = 'https://mythicalvoid.com/playable-now/#find-your-way/' + intentId") && discovery.includes("window.history.replaceState(null, '', cleanAddress.pathname + cleanAddress.search + cleanAddress.hash)"), 'selected answers do not produce clean shareable routes');
requireValue(discovery.includes('selectIntent(intentRoot.querySelector') && discovery.includes('sharedIntentId'), 'a shared route does not reopen its selected answer');
requireValue(discoveryCss.includes('.play-intent-section') && discoveryCss.includes('scroll-margin-top: 82px'), 'the doorway does not preserve the 82px site header on shared arrival');
requireValue(discoveryCss.includes('.play-intent-mission { padding-top: 1.25rem; padding-left: 0; border-top: 1px solid rgba(118, 227, 207, 0.32); border-left: 0; }'), 'starter mission does not stack cleanly at phone width');
requireValue(discovery.includes("readChoice() !== 'granted'"), 'measurement is not stopped before consent');
requireValue(discovery.includes("track('play_selected'"), 'existing Play event is not connected');
requireValue(!discovery.includes("track('intent_"), 'choice clicks must not create analytics events');
requireValue(!discovery.includes("localStorage.setItem('play-intent"), 'the selected reason must not be stored');
requireValue(plan.measurement?.eventName === 'play_selected' && plan.measurement?.property === 'source_area', 'measurement contract drifted');
requireValue(plan.lastFunnelImprovement?.choiceRequiredBeforePlay === false && plan.lastFunnelImprovement?.firstScreenDirectPlay === true, 'visitors must be able to Play without completing the mood chooser');
requireValue(/three-step starter mission/i.test(plan.lastFunnelImprovement?.change || ''), 'latest funnel improvement does not record the starter mission bridge');
requireValue(plan.lastFunnelImprovement?.directPlaySourceArea === 'hero' && plan.measurement?.directPlaySourceArea === 'hero', 'direct Play source must use the existing privacy-safe hero value');
requireValue(plan.latestFirstScreenImprovement?.headline === 'Hatch a strange alien creature. Save six living realms.', 'latest first-screen game promise is missing');
requireValue(plan.latestFirstScreenImprovement?.choiceRequiredBeforePlay === false && plan.latestFirstScreenImprovement?.gameplayMediaPublished === false, 'latest first-screen improvement overstates the release or adds friction');
requireValue(plan.measurement?.choiceClickMeasured === false && plan.measurement?.choiceRememberedInBrowser === false, 'choice collection boundary is invalid');
requireValue(plan.measurement?.selectedPlaySourceSentAfterConsent === true && plan.measurement?.aggregatePlayEventStoredByAnalytics === true, 'consented Play-source storage is not stated honestly');
requireValue(plan.measurement?.individualJourneyBuilt === false && plan.measurement?.gameMeasured === false, 'individual or game measurement must remain off');
requireValue(plan.sharing?.intentSpecificRoutes === true && plan.sharing?.routeLocation === 'URL fragment only', 'intent-specific sharing boundary is missing');
requireValue(JSON.stringify(plan.sharing?.allowedRouteWords) === JSON.stringify(expected.map(item => item[0])), 'shared route allowlist drifted');
for (const field of ['trackingCodeAdded', 'choiceSentToServer', 'choiceStoredAsProfile', 'recipientContactCollected']) {
    requireValue(plan.sharing?.[field] === false, `${field} must remain false`);
}
requireValue(plan.decisionRules?.minimumConsentedPageViews >= 50 && plan.decisionRules?.minimumIntentPlaySelections >= 10, 'minimum decision boundary is too weak');
requireValue(plan.visualBoundary?.approvedGameplayMoments === 0 && plan.visualBoundary?.requiredGameplayMoments === 4, 'visual gate drifted');
requireValue(plan.verification?.productionCommit === '148ca62d0c466bd031a5529ae83389067bb4e342' && plan.verification?.productionDeployId === '6a8fb0d5da9b150008b16ec2', 'production verification is missing or drifted');
requireValue(plan.verification?.directButtonVisible === true && plan.verification?.directDestination === 'https://mythicalvoid.com/play/', 'live direct-Play proof is missing');
for (const field of ['externalSocialPublicationAuthorized', 'portalSubmissionAuthorized', 'paidPromotionAuthorized', 'outreachAuthorized', 'externalAccountChangeAuthorized']) {
    requireValue(plan.authority?.[field] === false, `${field} must remain false`);
}

if (failures.length) {
    console.error('Play-intent doorway is not ready:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    publicRoute: plan.publicRoute,
    motives: expected.map(item => item[0]),
    starterMissions: 4,
    analyticsDefault: 'denied',
    eventName: 'play_selected',
    firstScreenDirectPlay: true,
    choiceRequiredBeforePlay: false,
    choiceRememberedInBrowser: false,
    shareRoutes: expected.map(item => `#find-your-way/${item[0]}`),
    choiceSentToServer: false,
    gameMeasured: false,
    visualGate: '0/4',
    externalPublicationAuthorized: false
}, null, 2));
