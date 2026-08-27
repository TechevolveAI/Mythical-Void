#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1
    ? path.resolve(__dirname, '..', '..')
    : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const handoff = read('src/ui/LivingFormHandoff.js');
const release = JSON.parse(read('docs/company/growth/HATCH_SHARING_LOOP.json'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const method = handoff.match(/async shareGame\(event\) \{([\s\S]*?)\n    \}\n\n    destroy/)?.[1] || '';

requireValue(release.releaseId === 'HATCH-SHARING-LOOP-2026-08-27', 'release identity is missing');
requireValue(['owned_game_release_authorized_pending_production_verification', 'live_production_verified'].includes(release.state), 'release authority state is invalid');
requireValue(release.trigger?.moment === 'first_named_creature_living_form_reveal', 'hatch moment drifted');
requireValue(release.trigger?.automaticShare === false && release.trigger?.automaticPrompt === false && release.trigger?.playerActionRequired === true, 'sharing must remain voluntary');
requireValue(release.trigger?.continueRemainsPrimary === true, 'continuation must remain primary');

requireValue(handoff.includes("'SHARE THE GAME'"), 'hatch share action is missing');
requireValue(handoff.includes("'living-form-share'"), 'hatch share action is not connected');
requireValue(handoff.includes("'living-form-continue'"), 'primary continuation is missing');
requireValue(method.length > 0, 'hatch share method is missing');
requireValue(method.includes('window.navigator?.share') && method.includes('window.navigator?.clipboard?.writeText'), 'native share or clipboard fallback is missing');
requireValue(method.includes("error?.name === 'AbortError'") && method.includes("result = 'cancelled'"), 'cancelled device sharing is not handled quietly');
for (const forbidden of ['GameState', 'creatureName', 'safeName', 'species', 'genetics', 'portrait', 'localStorage', 'sessionStorage', 'fetch(', 'sendBeacon(', 'gtag(', 'dataLayer', 'XMLHttpRequest', 'files:']) {
    requireValue(!method.includes(forbidden), `share method contains forbidden data or operation ${forbidden}`);
}

requireValue(release.share?.url === 'https://mythicalvoid.com/playable-now/#find-your-way/create', 'clean owned share route drifted');
requireValue(handoff.includes(`url: '${release.share.url}'`), 'implemented share route drifted');
requireValue(release.share?.trackingParametersAdded === false && release.share?.imageIncluded === false, 'tracking or an image must not be added');
for (const [key, expected] of Object.entries({
    saveDataReadForShare: false,
    saveDataTransmitted: false,
    creatureNameIncluded: false,
    creatureGeneticsIncluded: false,
    creaturePortraitIncluded: false,
    playerIdentityIncluded: false,
    recipientCollected: false,
    contactDetailsCollected: false,
    newAnalyticsEventAdded: false
})) requireValue(release.privacy?.[key] === expected, `privacy.${key} must be ${expected}`);
requireValue(release.visualBoundary?.approvedGameplayMoments === 0 && release.visualBoundary?.requiredGameplayMoments === 4 && release.visualBoundary?.unapprovedScreenshotUsed === false && release.visualBoundary?.visualLaunchGateChanged === false, 'visual gate drifted');
for (const [key, expected] of Object.entries({
    ownedGamePublicationAuthorized: true,
    externalSocialPublicationAuthorized: false,
    emailOrOutreachSendingAuthorized: false,
    paidPromotionAuthorized: false,
    externalAccountChangeAuthorized: false,
    externalActionTaken: false
})) requireValue(release.authority?.[key] === expected, `authority.${key} must be ${expected}`);

if (failures.length) {
    console.error('Hatch sharing loop is not ready:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    trigger: release.trigger.moment,
    cleanShareUrl: release.share.url,
    creatureDataShared: false,
    playerIdentityShared: false,
    approvedVisualsUsed: false,
    visualGate: '0/4',
    externalPublicationAuthorized: false
}, null, 2));
