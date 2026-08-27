#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1
    ? path.resolve(__dirname, '..', '..')
    : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const handoff = read('src/ui/LivingFormHandoff.js');
const hatchPage = read('public/hatch-challenge/index.html');
const release = JSON.parse(read('docs/company/content/generated/hatch-challenge-invitation-release.json'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const method = handoff.match(/async shareGame\(event\) \{([\s\S]*?)\n    \}\n\n    destroy/)?.[1] || '';

requireValue(release.releaseId === 'HATCH-CHALLENGE-INVITATION-2026-08-27', 'release identity is missing');
requireValue(['prepared_for_owned_game_release', 'live_production_verified'].includes(release.state), 'public release state is invalid');
requireValue(release.publicExperience?.trigger === 'first_named_creature_living_form_reveal', 'hatch moment drifted');
requireValue(release.publicExperience?.automaticShare === false, 'sharing must remain voluntary');
requireValue(release.publicExperience?.continueRemainsPrimary === true, 'continuation must remain primary');

requireValue(handoff.includes("'INVITE SOMEONE'"), 'hatch challenge action is missing');
requireValue(handoff.includes("'living-form-share'"), 'hatch share action is not connected');
requireValue(handoff.includes("'living-form-continue'"), 'primary continuation is missing');
requireValue(method.length > 0, 'hatch share method is missing');
requireValue(method.includes('window.navigator?.share') && method.includes('window.navigator?.clipboard?.writeText'), 'native share or clipboard fallback is missing');
requireValue(method.includes("error?.name === 'AbortError'") && method.includes("result = 'cancelled'"), 'cancelled device sharing is not handled quietly');
for (const forbidden of ['GameState', 'creatureName', 'safeName', 'species', 'genetics', 'portrait', 'localStorage', 'sessionStorage', 'fetch(', 'sendBeacon(', 'gtag(', 'dataLayer', 'XMLHttpRequest', 'files:']) {
    requireValue(!method.includes(forbidden), `share method contains forbidden data or operation ${forbidden}`);
}

requireValue(release.publicExperience?.buttonLabel === 'INVITE SOMEONE', 'hatch challenge label drifted');
requireValue(release.publicExperience?.url === 'https://mythicalvoid.com/hatch-challenge/', 'clean owned Hatch Challenge route drifted');
requireValue(release.publicExperience?.gameEntry === '/play/#hatch-challenge', 'challenge game entry drifted');
requireValue(release.publicExperience?.invitedPlayerGuidance === true, 'invited-player guidance is missing');
requireValue(release.publicExperience?.comparisonAreas?.join('|') === 'form|colour|markings|nature|affinity|rare changes', 'comparison guidance drifted');
requireValue(handoff.includes(`url: '${release.publicExperience.url}'`), 'implemented share route drifted');
requireValue((hatchPage.match(/href="\/play\/#hatch-challenge"/g) || []).length >= 4, 'Hatch Challenge Play links must preserve the clean challenge entry');
requireValue(handoff.includes("window.location?.hash === '#hatch-challenge'"), 'game does not recognize the clean challenge entry');
requireValue(handoff.includes("'living-form-challenge'"), 'invited-player comparison panel is missing');
for (const area of release.publicExperience.comparisonAreas) requireValue(handoff.toLowerCase().includes(area), `comparison area ${area} is missing from the game guidance`);
requireValue(release.privacy?.trackingParametersAdded === false && release.visualBoundary?.imageIncludedInShare === false, 'tracking or an image must not be added');
requireValue(release.privacy?.entryMarkerContainsUniqueIdentifier === false, 'challenge marker must not identify a player or invitation');
for (const [key, expected] of Object.entries({
    creatureNameIncluded: false,
    creatureGeneticsIncluded: false,
    creaturePortraitIncluded: false,
    playerIdentityIncluded: false,
    recipientCollected: false
})) requireValue(release.privacy?.[key] === expected, `privacy.${key} must be ${expected}`);
requireValue(release.visualBoundary?.unapprovedScreenshotUsed === false, 'unapproved visual entered the invitation');
if (release.state === 'live_production_verified') {
    requireValue(/^[0-9a-f]{40}$/.test(release.verification?.productionCommit || ''), 'verified release is missing its production commit');
    requireValue(/^[0-9a-f]{24}$/.test(release.verification?.productionDeployId || ''), 'verified release is missing its production deploy ID');
    requireValue(!Number.isNaN(Date.parse(release.verification?.productionPublishedAt || '')), 'verified release is missing its production time');
    requireValue(release.verification?.shareActionPresentInGameBundle === true, 'live bundle is missing the invitation action');
    requireValue(release.verification?.cleanShareUrlPresentInGameBundle === true, 'live bundle is missing the clean Hatch Challenge route');
    requireValue(release.verification?.challengeEntryPresentOnLandingPage === true, 'live landing page is missing the challenge entry');
    requireValue(release.verification?.comparisonGuidancePresentInGameBundle === true, 'live bundle is missing comparison guidance');
}
if (release.state === 'prepared_for_owned_game_release') {
    requireValue(release.verification?.productionCommit === null, 'pending release must not claim a production commit');
    requireValue(release.verification?.productionDeployId === null, 'pending release must not claim a production deploy');
    requireValue(release.verification?.productionPublishedAt === null, 'pending release must not claim a production time');
    for (const key of ['shareActionPresentInGameBundle', 'cleanShareUrlPresentInGameBundle', 'challengeEntryPresentOnLandingPage', 'comparisonGuidancePresentInGameBundle']) {
        requireValue(release.verification?.[key] === false, `pending release must not claim ${key}`);
    }
}

if (failures.length) {
    console.error('Hatch sharing loop is not ready:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    trigger: release.publicExperience.trigger,
    cleanShareUrl: release.publicExperience.url,
    creatureDataShared: false,
    playerIdentityShared: false,
    approvedVisualsUsed: false,
    visualGate: '0/4',
    externalPublicationAuthorized: false
}, null, 2));
