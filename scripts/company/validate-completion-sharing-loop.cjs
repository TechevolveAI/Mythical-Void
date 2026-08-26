#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1
    ? path.resolve(__dirname, '..', '..')
    : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const scene = read('src/scenes/VictoryScene.js');
const release = JSON.parse(read('docs/company/growth/COMPLETION_SHARING_LOOP.json'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

const method = scene.match(/async shareCompletedAdventure\(label\) \{([\s\S]*?)\n    \}\n\n    \/\*\*\n     \* Return to hub/)?.[1] || '';

requireValue(release.releaseId === 'COMPLETION-SHARING-LOOP-2026-08-27', 'release identity is missing');
requireValue(['owned_game_release_authorized_pending_production_verification', 'live_production_verified'].includes(release.state), 'release authority state is invalid');
requireValue(release.trigger?.moment === 'final_epilogue_page_after_priority_choice', 'completion moment drifted');
requireValue(release.trigger?.automaticShare === false && release.trigger?.automaticPrompt === false && release.trigger?.playerActionRequired === true, 'sharing must remain voluntary');

requireValue(scene.includes("'SHARE THE GAME'"), 'finale share action is missing');
requireValue(scene.includes("({ label }) => this.shareCompletedAdventure(label)"), 'finale share action is not connected');
requireValue(scene.indexOf("if (isLastPage)") < scene.indexOf("'SHARE THE GAME'"), 'share action is not limited to the final epilogue page');
requireValue(method.length > 0, 'completion share method is missing');
requireValue(method.includes("url: 'https://mythicalvoid.com/playable-now/#find-your-way/story'"), 'clean owned share route drifted');
requireValue(method.includes('window.navigator?.share') && method.includes('window.navigator?.clipboard?.writeText'), 'native share or clipboard fallback is missing');
requireValue(method.includes("error?.name === 'AbortError'") && method.includes("return 'cancelled'"), 'cancelled device sharing is not handled quietly');
requireValue(method.includes("label?.setText?.('MYTHICALVOID.COM')") && method.includes("return 'shown'"), 'plain-address fallback is missing');
for (const forbidden of ['GameState', 'creatureName', 'priority', 'localStorage', 'sessionStorage', 'fetch(', 'sendBeacon(', 'gtag(', 'dataLayer', 'XMLHttpRequest']) {
    requireValue(!method.includes(forbidden), `share method contains forbidden data or operation ${forbidden}`);
}

requireValue(scene.includes("'Kevin’s son'"), 'non-identifying child credit is missing');
requireValue(scene.includes("'Co-Creator & Game Designer'"), 'child role credit is missing');
requireValue((scene.match(/Murphy/g) || []).length === 2, 'a second family surname remains in public credits');
requireValue(!/\(Age \d+\)/.test(scene), 'an exact child age remains in public credits');
requireValue(scene.includes("'Phaser 3 • Vite • Generative AI tools'"), 'tool credit is not durable or plain enough');

for (const [key, expected] of Object.entries({
    saveDataReadForShare: false,
    saveDataTransmitted: false,
    creatureNameIncluded: false,
    endingChoiceIncluded: false,
    completionClaimIncluded: false,
    playerIdentityIncluded: false,
    recipientCollected: false,
    contactDetailsCollected: false,
    newAnalyticsEventAdded: false
})) requireValue(release.privacy?.[key] === expected, `privacy.${key} must be ${expected}`);
requireValue(release.share?.url === 'https://mythicalvoid.com/playable-now/#find-your-way/story', 'release share URL drifted');
requireValue(release.share?.trackingParametersAdded === false, 'tracking parameters must remain off');
requireValue(release.childSafetyRemediation?.fullChildNameRemovedFromCredits === true && release.childSafetyRemediation?.exactChildAgeRemovedFromCredits === true, 'child credit remediation is incomplete');
requireValue(release.visualBoundary?.approvedGameplayMoments === 0 && release.visualBoundary?.requiredGameplayMoments === 4 && release.visualBoundary?.visualLaunchGateChanged === false, 'visual gate drifted');
for (const [key, expected] of Object.entries({
    ownedGamePublicationAuthorized: true,
    externalSocialPublicationAuthorized: false,
    emailOrOutreachSendingAuthorized: false,
    paidPromotionAuthorized: false,
    externalAccountChangeAuthorized: false,
    externalActionTaken: false
})) requireValue(release.authority?.[key] === expected, `authority.${key} must be ${expected}`);
if (release.state === 'live_production_verified') {
    requireValue(/^[0-9a-f]{40}$/.test(release.verification?.productionCommit || ''), 'verified release is missing its production commit');
    requireValue(/^[0-9a-f]{24}$/.test(release.verification?.productionDeployId || ''), 'verified release is missing its production deploy ID');
    requireValue(!Number.isNaN(Date.parse(release.verification?.productionPublishedAt || '')), 'verified release is missing its production time');
    for (const [key, expected] of Object.entries({
        updatesPageHttpStatus: 200,
        signalEntryPresent: true,
        shareActionPresentInGameBundle: true,
        cleanShareUrlPresentInGameBundle: true,
        nonIdentifyingChildCreditPresent: true,
        exactChildAgeAbsent: true
    })) requireValue(release.verification?.publicChecks?.[key] === expected, `verification.publicChecks.${key} must be ${expected}`);
}

if (failures.length) {
    console.error('Completion sharing loop is not ready:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    trigger: release.trigger.moment,
    cleanShareUrl: release.share.url,
    saveDataShared: false,
    playerIdentityShared: false,
    childIdentityInCredits: false,
    visualGate: '0/4',
    externalPublicationAuthorized: false
}, null, 2));
