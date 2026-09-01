#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('public/manifest.webmanifest'));
const release = JSON.parse(read('docs/company/growth/INSTALLABLE_GAME_RETURN_LOOP.json'));
const client = read('public/pwa-install.js');
const playable = read('public/playable-now/index.html');
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const publicPages = [
    'index.html',
    'public/playable-now/index.html',
    'public/hatch-challenge/index.html',
    'public/story/index.html',
    'public/creature-genetics/index.html',
    'public/creature-field-guide/index.html',
    'public/nasa-space-science/index.html',
    'public/space-discovery/index.html',
    'public/parents/index.html',
    'public/educators/index.html',
    'public/studio/index.html',
    'public/updates/index.html'
];

requireValue(manifest.name === 'Mythical Void' && manifest.short_name === 'Mythical Void', 'manifest identity is incomplete');
requireValue(manifest.id === '/play/' && manifest.start_url === '/play/' && manifest.scope === '/', 'installed game must open the clean owned Play route');
requireValue(manifest.display === 'standalone', 'installed game does not request a standalone window');
requireValue(manifest.prefer_related_applications === false, 'manifest must not divert players to an outside app store');
for (const size of ['192x192', '512x512']) {
    const icon = manifest.icons?.find(candidate => candidate.sizes === size && candidate.type === 'image/png');
    requireValue(Boolean(icon), `manifest is missing its ${size} PNG icon`);
    if (icon) requireValue(fs.existsSync(path.join(root, 'public', icon.src.replace(/^\//, ''))), `${size} manifest icon does not exist`);
}
requireValue(!('screenshots' in manifest), 'unfinished gameplay screenshots must not enter the install prompt');
requireValue(client.includes("navigator.serviceWorker.register('/sw.js'"), 'service worker registration is missing');
requireValue(client.includes('mythicalvoid\\.com') && client.includes('if (!ownedInstallHost) return;'), 'installation is not limited to the owned Mythical Void site');
requireValue(client.includes("window.addEventListener('beforeinstallprompt'"), 'supported install event is not handled');
requireValue(client.includes("installButton.addEventListener('click'"), 'installation is not tied to an explicit button press');
requireValue(!/localStorage|sessionStorage|gtag|analytics|fetch\(/i.test(client), 'install helper stores, measures or sends unnecessary visitor information');
requireValue(playable.includes('data-install-card hidden') && playable.includes('data-install-game'), 'game finder lacks the hidden optional install invitation');
requireValue(/still needs an internet connection/i.test(playable), 'game finder implies unsupported full offline play');

for (const file of publicPages) {
    const page = read(file);
    requireValue(page.includes('<link rel="manifest" href="/manifest.webmanifest">'), `${file} does not advertise the installable game`);
    requireValue(page.includes('src="/pwa-install.js'), `${file} does not register the installability helper`);
}
requireValue(read('netlify.toml').includes('for = "/manifest.webmanifest"') && read('netlify.toml').includes('application/manifest+json'), 'Netlify manifest content type is missing');
requireValue(read('vercel.json').includes('"source": "/manifest.webmanifest"') && read('vercel.json').includes('application/manifest+json'), 'Vercel manifest content type is missing');
requireValue(read('vite.config.mjs').includes('manifest\\.webmanifest') && read('vite.config.mjs').includes('pwa-install\\.js'), 'portable portal builds must remove owned-site install hooks');

requireValue(release.status === 'live', 'installable-game release is not recorded as live');
for (const [key, expected] of Object.entries({
    automaticPrompt: false,
    browserSupportRequired: true,
    userButtonRequired: true,
    opensDirectlyIntoGame: true,
    normalBrowserPlayRemainsAvailable: true,
    fullOfflinePlayClaimed: false,
    installationGuaranteed: false
})) requireValue(release.experience?.[key] === expected, `experience.${key} must be ${expected}`);
for (const [key, expected] of Object.entries({
    accountRequired: false,
    emailCollected: false,
    contactCollected: false,
    playerProfileCreated: false,
    installChoiceStoredByMythical: false,
    analyticsEventAdded: false,
    trackingParametersAdded: false
})) requireValue(release.privacy?.[key] === expected, `privacy.${key} must be ${expected}`);
requireValue(release.productionEvidence?.commit === '75e414f72d87d4e3edab7a6ce9dbb9057014da71', 'production commit proof is missing');
requireValue(release.productionEvidence?.netlifyDeployId === '6a8fcb8626021000084b82e8', 'production deploy proof is missing');
requireValue(release.productionEvidence?.manifestHttpStatus === 200 && /^application\/manifest\+json/.test(release.productionEvidence?.manifestContentType || ''), 'live manifest response proof is missing');
requireValue(release.productionEvidence?.icon192HttpStatus === 200 && release.productionEvidence?.icon512HttpStatus === 200 && release.productionEvidence?.gameRouteHttpStatus === 200, 'live icon or game-route proof is missing');
requireValue(release.productionEvidence?.serviceWorkerBuildMarkerPresent === true && release.productionEvidence?.liveGameFinderContainsHiddenInstallCard === true && release.productionEvidence?.liveVisualReview === 'passed', 'live experience proof is incomplete');

console.log(JSON.stringify({
    valid: failures.length === 0,
    manifestRoute: '/manifest.webmanifest',
    startUrl: manifest.start_url,
    pagesAdvertisingInstall: publicPages.length,
    automaticPrompt: release.experience?.automaticPrompt,
    fullOfflinePlayClaimed: release.experience?.fullOfflinePlayClaimed,
    failures
}, null, 2));
if (failures.length) process.exit(1);
