#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1
    ? path.resolve(__dirname, '..', '..')
    : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const helper = read('public/returning-player.js');
const home = read('index.html');
const storefront = read('src/site/storefront.js');
const storefrontCss = read('src/site/storefront.css');
const playable = read('public/playable-now/index.html');
const discovery = read('public/discovery.js');
const discoveryCss = read('public/discovery.css');
const release = JSON.parse(read('docs/company/growth/RETURNING_PLAYER_DOORWAY.json'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

requireValue(release.releaseId === 'RETURNING-PLAYER-DOORWAY-2026-08-26', 'release identity is missing');
requireValue(release.state === 'owned_site_release_authorized_pending_production_verification', 'release authority state is invalid');
requireValue(release.destination === 'https://mythicalvoid.com/play/', 'return destination drifted');
requireValue(JSON.stringify(release.publicRoutes) === JSON.stringify(['https://mythicalvoid.com/', 'https://mythicalvoid.com/playable-now/']), 'public route list drifted');

requireValue(helper.includes("var saveKey = 'mythical-creature-save'"), 'real game save key is missing');
requireValue(helper.includes('local.key(index) === saveKey'), 'helper must inspect only local storage key names');
requireValue(helper.includes('catch (error)') && helper.includes('return false'), 'blocked-storage fallback is missing');
for (const forbidden of ['getItem(', 'setItem(', 'removeItem(', 'clear(', 'fetch(', 'sendBeacon(', 'XMLHttpRequest', 'gtag(', 'dataLayer']) {
    requireValue(!helper.includes(forbidden), `helper contains forbidden operation ${forbidden}`);
}
requireValue(helper.includes("label.textContent = link.closest('header') ? 'Continue' : 'Continue your adventure'"), 'returning labels are missing');
requireValue(helper.includes("note.hidden = false"), 'welcome-back note is not revealed');
requireValue(helper.includes('global.MythicalReturningPlayer'), 'safe public helper is not exposed');

requireValue(home.includes('/returning-player.js?v=20260826-return-doorway'), 'homepage does not load the return helper');
requireValue(storefront.includes('data-play-link') && storefront.includes('data-play-label'), 'homepage Play controls are not return-aware');
requireValue(storefront.includes('data-returning-player-note hidden'), 'homepage welcome-back note is missing');
requireValue(storefront.includes('MythicalReturningPlayer?.apply(app)'), 'rendered homepage is not checked after it is built');
requireValue(storefrontCss.includes('.returning-player-note') && storefrontCss.includes('[hidden]'), 'homepage return styling is missing');

requireValue(playable.includes('/returning-player.js?v=20260826-return-doorway'), 'new-game doorway does not load the return helper');
requireValue(playable.indexOf('/returning-player.js?v=20260826-return-doorway') < playable.indexOf('/discovery.js?v=20260826-return-doorway'), 'return helper must load before the game-finder script');
requireValue((playable.match(/data-play-link/g) || []).length >= 4, 'new-game doorway needs four return-aware Play controls');
requireValue(playable.includes('data-returning-player-note hidden'), 'new-game doorway welcome-back note is missing');
requireValue(discovery.includes("isReturningPlayer() ? 'Continue your adventure' : message.cta"), 'choosing a mood overwrites the returning-player label');
requireValue(discoveryCss.includes('.play-intent-section .returning-player-note'), 'new-game doorway return styling is missing');

for (const [key, expected] of Object.entries({
    keyNameExistenceChecked: true,
    saveValueRead: false,
    saveValueParsed: false,
    saveValueChanged: false,
    newStorageWritten: false,
    sentToServer: false
})) requireValue(release.localSignal?.[key] === expected, `localSignal.${key} must be ${expected}`);
for (const [key, expected] of Object.entries({
    newAnalyticsEventAdded: false,
    returningPlayerStatusMeasured: false,
    saveStatusAddedToExistingEvents: false,
    gameActivityMeasured: false
})) requireValue(release.measurement?.[key] === expected, `measurement.${key} must be ${expected}`);
requireValue(release.visualBoundary?.approvedGameplayMoments === 0 && release.visualBoundary?.requiredGameplayMoments === 4 && release.visualBoundary?.visualLaunchGateChanged === false, 'visual gate drifted');
for (const [key, expected] of Object.entries({
    ownedWebsitePublicationAuthorized: true,
    externalSocialPublicationAuthorized: false,
    emailOrOutreachSendingAuthorized: false,
    paidPromotionAuthorized: false,
    externalAccountChangeAuthorized: false,
    externalActionTaken: false
})) requireValue(release.authority?.[key] === expected, `authority.${key} must be ${expected}`);

const publicCopy = `${storefront}\n${playable}`;
requireValue(!/\bcompanions?\b/i.test(publicCopy), 'return doorway uses retired companion wording');
requireValue(!/<form\b/i.test(publicCopy), 'return doorway must not collect contact data');

if (failures.length) {
    console.error('Returning-player doorway is not ready:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    routes: release.publicRoutes,
    destination: release.destination,
    saveValueRead: false,
    dataSent: false,
    newAnalyticsEvent: false,
    visualGate: '0/4',
    externalPublicationAuthorized: false
}, null, 2));
