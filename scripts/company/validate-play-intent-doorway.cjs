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
requireValue(plan.state === 'owned_site_release_authorized_pending_production_verification', 'release authority state is invalid');
requireValue(plan.publicRoute === 'https://mythicalvoid.com/playable-now/', 'public route is invalid');
requireValue(page.includes('What are you in the mood for?'), 'plain-language question is missing');
requireValue(page.includes('Nothing is saved and no account is needed.'), 'public privacy promise is missing');
requireValue(page.includes('data-play-intent') && page.includes('data-intent-answer hidden'), 'progressive intent doorway is missing');
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
    requireValue(page.includes(`data-intent-choice="${id}"`) && page.includes(button), `page is missing ${id}`);
    requireValue(discovery.includes(`${id}: {`) && discovery.includes(`sourceArea: '${sourceArea}'`), `script is missing ${id}`);
    requireValue(discovery.includes(`'${sourceArea}'`), `analytics allowlist is missing ${sourceArea}`);
}

requireValue(discovery.includes("declaredArea.dataset.sourceArea"), 'Play source does not use the selected doorway');
requireValue(discovery.includes("readChoice() !== 'granted'"), 'measurement is not stopped before consent');
requireValue(discovery.includes("track('play_selected'"), 'existing Play event is not connected');
requireValue(!discovery.includes("track('intent_"), 'choice clicks must not create analytics events');
requireValue(!discovery.includes("localStorage.setItem('play-intent"), 'the selected reason must not be stored');
requireValue(plan.measurement?.eventName === 'play_selected' && plan.measurement?.property === 'source_area', 'measurement contract drifted');
requireValue(plan.measurement?.choiceClickMeasured === false && plan.measurement?.choiceStored === false, 'choice collection boundary is invalid');
requireValue(plan.measurement?.individualJourneyBuilt === false && plan.measurement?.gameMeasured === false, 'individual or game measurement must remain off');
requireValue(plan.decisionRules?.minimumConsentedPageViews >= 50 && plan.decisionRules?.minimumIntentPlaySelections >= 10, 'minimum decision boundary is too weak');
requireValue(plan.visualBoundary?.approvedGameplayMoments === 0 && plan.visualBoundary?.requiredGameplayMoments === 4, 'visual gate drifted');
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
    analyticsDefault: 'denied',
    eventName: 'play_selected',
    choiceStored: false,
    gameMeasured: false,
    visualGate: '0/4',
    externalPublicationAuthorized: false
}, null, 2));

