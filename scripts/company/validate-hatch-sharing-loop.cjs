#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1
    ? path.resolve(__dirname, '..', '..')
    : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const handoff = read('src/ui/LivingFormHandoff.js');
const menu = read('src/ui/HamburgerMenu.js');
const shareHelper = read('src/utils/HatchChallengeShare.js');
const storefront = read('src/site/storefront.js');
const hatchPage = read('public/hatch-challenge/index.html');
const release = JSON.parse(read('docs/company/content/generated/hatch-challenge-invitation-release.json'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const preview = release.visualBoundary?.socialPreview || {};
const previewAbsolute = path.join(root, preview.path || '');
const previewSourceAbsolute = path.join(root, preview.sourcePath || '');
const previewBuffer = fs.existsSync(previewAbsolute) ? fs.readFileSync(previewAbsolute) : null;
const previewSource = fs.existsSync(previewSourceAbsolute) ? fs.readFileSync(previewSourceAbsolute, 'utf8') : '';
const previewSha256 = previewBuffer ? crypto.createHash('sha256').update(previewBuffer).digest('hex') : '';
const jpegDimensions = buffer => {
    if (!buffer || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
    let offset = 2;
    while (offset + 8 < buffer.length) {
        if (buffer[offset] !== 0xff) { offset += 1; continue; }
        const marker = buffer[offset + 1];
        if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
        const length = buffer.readUInt16BE(offset + 2);
        if (length < 2 || offset + length + 2 > buffer.length) return null;
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
            return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        offset += length + 2;
    }
    return null;
};
const actualPreviewDimensions = jpegDimensions(previewBuffer);
const method = handoff.match(/async shareGame\(event\) \{([\s\S]*?)\n    \}\n\n    destroy/)?.[1] || '';
const helperMethod = shareHelper.match(/export async function shareHatchChallenge\([\s\S]*?\n\}/)?.[0] || '';

requireValue(release.releaseId === 'HATCH-CHALLENGE-INVITATION-2026-08-27', 'release identity is missing');
requireValue(['prepared_for_owned_game_release', 'live_production_verified'].includes(release.state), 'public release state is invalid');
requireValue(release.publicExperience?.trigger === 'first_named_creature_living_form_reveal', 'hatch moment drifted');
requireValue(release.publicExperience?.automaticShare === false, 'sharing must remain voluntary');
requireValue(release.publicExperience?.continueRemainsPrimary === true, 'continuation must remain primary');

requireValue(handoff.includes("'INVITE SOMEONE'"), 'hatch challenge action is missing');
requireValue(handoff.includes("'living-form-share'"), 'hatch share action is not connected');
requireValue(handoff.includes("'living-form-continue'"), 'primary continuation is missing');
requireValue(method.length > 0, 'hatch share method is missing');
requireValue(method.includes('shareHatchChallenge(window.navigator)'), 'first reveal is not using the shared clean invitation');
requireValue(helperMethod.includes('navigatorValue?.share') && helperMethod.includes('navigatorValue?.clipboard?.writeText'), 'native share or clipboard fallback is missing');
requireValue(helperMethod.includes("error?.name === 'AbortError'") && helperMethod.includes("return 'cancelled'"), 'cancelled device sharing is not handled quietly');
for (const forbidden of ['GameState', 'creatureName', 'safeName', 'species', 'genetics', 'portrait', 'localStorage', 'sessionStorage', 'fetch(', 'sendBeacon(', 'gtag(', 'dataLayer', 'XMLHttpRequest', 'files:']) {
    requireValue(!helperMethod.includes(forbidden), `share method contains forbidden data or operation ${forbidden}`);
}

requireValue(release.publicExperience?.buttonLabel === 'INVITE SOMEONE', 'hatch challenge label drifted');
requireValue(release.publicExperience?.url === 'https://mythicalvoid.com/hatch-challenge/', 'clean owned Hatch Challenge route drifted');
requireValue(release.publicExperience?.gameEntry === '/play/#hatch-challenge', 'challenge game entry drifted');
requireValue(release.publicExperience?.invitedPlayerGuidance === true, 'invited-player guidance is missing');
requireValue(release.publicExperience?.comparisonAreas?.join('|') === 'form|colour|markings|nature|affinity|rare changes', 'comparison guidance drifted');
requireValue(shareHelper.includes(`url: '${release.publicExperience.url}'`), 'implemented share route drifted');
requireValue(release.publicExperience?.persistentEntry?.screen === 'Sanctuary menu', 'persistent invitation screen is missing');
requireValue(release.publicExperience?.persistentEntry?.buttonLabel === 'Invite someone', 'persistent invitation label drifted');
requireValue(release.publicExperience?.persistentEntry?.automaticShare === false, 'persistent invitation must remain voluntary');
requireValue(menu.includes("key: 'invite', label: 'Invite someone'"), 'Sanctuary menu invitation is missing');
requireValue(menu.includes('shareHatchChallenge(window.navigator)'), 'Sanctuary menu is not using the shared clean invitation');
requireValue(release.publicExperience?.homepageEntry?.state === 'live_production_verified', 'homepage invitation is not recorded as live');
requireValue(release.publicExperience?.homepageEntry?.buttonLabel === 'Invite someone to hatch', 'homepage invitation label drifted');
requireValue(release.publicExperience?.homepageEntry?.automaticShare === false && release.publicExperience?.homepageEntry?.continueRemainsPrimary === true, 'homepage invitation must remain voluntary and secondary to Play');
requireValue(storefront.includes('data-share-hatch-challenge') && storefront.includes('Invite someone to hatch'), 'homepage Hatch Challenge invitation is missing');
requireValue(storefront.includes("url: 'https://mythicalvoid.com/hatch-challenge/'"), 'homepage invitation lost the clean Hatch Challenge URL');
requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(storefront.match(/const hatchShareData = \{[\s\S]*?\n\s*\};/)?.[0] || ''), 'homepage invitation contains tracking code');
requireValue((hatchPage.match(/href="\/play\/#hatch-challenge"/g) || []).length >= 4, 'Hatch Challenge Play links must preserve the clean challenge entry');
const heroStart = hatchPage.indexOf('class="button button-primary hatch-challenge-start"');
const heroShare = hatchPage.indexOf('data-hatch-challenge-share');
const heroBoundary = hatchPage.indexOf('class="hatch-challenge-boundary"');
requireValue(heroStart !== -1 && heroStart < heroShare && heroShare < heroBoundary, 'Hatch Challenge first screen must lead with Start, keep invitation secondary and show the privacy boundary afterwards');
requireValue(hatchPage.includes('<span data-play-label>Start the challenge</span>'), 'Hatch Challenge first screen needs a plain Start action');
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
requireValue(['source_ready_for_owned_release', 'live_on_production_alias_from_promoted_deploy_preview'].includes(preview.state), 'Hatch Challenge preview state is invalid');
requireValue(preview.path === 'public/marketing/mythical-void-hatch-challenge-card-v1.jpg', 'Hatch Challenge preview path drifted');
requireValue(preview.publicUrl === 'https://mythicalvoid.com/marketing/mythical-void-hatch-challenge-card-v1.jpg', 'Hatch Challenge preview URL drifted');
requireValue(preview.sourcePath === 'scripts/company/hatch-challenge-link-card.html', 'Hatch Challenge preview source path drifted');
requireValue(preview.width === 1200 && preview.height === 630, 'Hatch Challenge preview recorded dimensions drifted');
requireValue(actualPreviewDimensions?.width === 1200 && actualPreviewDimensions?.height === 630, 'Hatch Challenge preview must be an actual 1200 x 630 JPEG');
requireValue(previewSha256 === preview.sha256, 'Hatch Challenge preview fingerprint drifted');
requireValue(preview.classification === 'ai_assisted_code_authored_brand_art_not_gameplay', 'Hatch Challenge preview classification drifted');
requireValue(preview.aiAssistanceUsed === true && preview.imageModelUsed === false, 'Hatch Challenge preview creation record is incomplete');
requireValue(preview.gameplayUsed === false && preview.playerOrCreatureDataUsed === false, 'Hatch Challenge preview must not contain gameplay or player/creature data');
requireValue(preview.agentVisualPreflightPassed === true && preview.humanGameplayApprovalClaimed === false, 'Hatch Challenge preview review boundary drifted');
for (const phrase of ['Same starting point.', 'Two creatures.', 'What will hatch?', 'PLAY FREE · NO ACCOUNT', 'BRAND ART · NOT GAMEPLAY']) {
    requireValue(previewSource.includes(phrase), `Hatch Challenge preview source is missing: ${phrase}`);
}
requireValue(hatchPage.includes(`<meta property="og:image" content="${preview.publicUrl}">`), 'Hatch Challenge Open Graph preview is missing');
requireValue(hatchPage.includes('<meta property="og:image:type" content="image/jpeg">') && hatchPage.includes('<meta property="og:image:width" content="1200">') && hatchPage.includes('<meta property="og:image:height" content="630">'), 'Hatch Challenge Open Graph preview metadata drifted');
requireValue(hatchPage.includes(`<meta name="twitter:image" content="${preview.publicUrl}">`), 'Hatch Challenge Twitter preview is missing');
requireValue(hatchPage.includes('Hatch Challenge brand artwork showing two different imagined cosmic eggs'), 'Hatch Challenge preview description is missing');
requireValue(hatchPage.includes('AI-assisted brand artwork created for the Hatch Challenge. It is not gameplay.'), 'Hatch Challenge page disclosure is missing');
if (preview.state === 'source_ready_for_owned_release') {
    requireValue(preview.productionCommit === null && preview.productionDeployId === null && preview.productionVerifiedAt === null, 'unreleased Hatch Challenge preview must not claim production proof');
} else {
    requireValue(/^[0-9a-f]{40}$/.test(preview.sourceCommit || '') && /^[0-9a-f]{40}$/.test(preview.mainMergeCommit || ''), 'live Hatch Challenge preview is missing its source or merge commit');
    requireValue(/^[0-9a-f]{24}$/.test(preview.deployId || '') && preview.deployContext === 'deploy-preview' && preview.promotionMethod === 'restoreSiteDeploy', 'promoted Hatch Challenge preview context is missing');
    requireValue(preview.productionAlias === 'https://mythicalvoid.com' && !Number.isNaN(Date.parse(preview.promotedAt || '')) && !Number.isNaN(Date.parse(preview.liveAliasVerifiedAt || '')), 'Hatch Challenge production-alias proof is incomplete');
    requireValue(preview.livePageMetadataObserved === true && preview.liveImageFingerprintMatched === true && preview.liveBrowserErrorCount === 0, 'Hatch Challenge live-alias browser proof is incomplete');
}
if (release.state === 'live_production_verified') {
    requireValue(/^[0-9a-f]{40}$/.test(release.verification?.productionCommit || ''), 'verified release is missing its production commit');
    requireValue(/^[0-9a-f]{24}$/.test(release.verification?.productionDeployId || ''), 'verified release is missing its production deploy ID');
    requireValue(!Number.isNaN(Date.parse(release.verification?.productionPublishedAt || '')), 'verified release is missing its production time');
    requireValue(release.verification?.shareActionPresentInGameBundle === true, 'live bundle is missing the invitation action');
    requireValue(release.verification?.cleanShareUrlPresentInGameBundle === true, 'live bundle is missing the clean Hatch Challenge route');
    requireValue(release.verification?.challengeEntryPresentOnLandingPage === true, 'live landing page is missing the challenge entry');
    requireValue(release.verification?.comparisonGuidancePresentInGameBundle === true, 'live bundle is missing comparison guidance');
    requireValue(release.verification?.persistentMenuCandidate?.sourceReady === true, 'persistent invitation candidate source is missing');
    requireValue(/^[0-9a-f]{40}$/.test(release.verification?.persistentMenuCandidate?.sourceCommit || ''), 'persistent invitation is missing its source commit');
    requireValue(/^[0-9a-f]{40}$/.test(release.verification?.persistentMenuCandidate?.productionCommit || ''), 'persistent invitation is missing its production commit');
    requireValue(/^[0-9a-f]{24}$/.test(release.verification?.persistentMenuCandidate?.productionDeployId || ''), 'persistent invitation is missing its production deploy');
    requireValue(!Number.isNaN(Date.parse(release.verification?.persistentMenuCandidate?.productionPublishedAt || '')), 'persistent invitation is missing its production time');
    requireValue(release.verification?.persistentMenuCandidate?.sourceAndProductionTreesMatch === true, 'persistent invitation source and production trees were not matched');
    requireValue(/^[0-9a-f]{40}$/.test(release.verification?.homepageCandidate?.sourceCommit || ''), 'homepage invitation is missing its source commit');
    requireValue(/^[0-9a-f]{40}$/.test(release.verification?.homepageCandidate?.productionCommit || ''), 'homepage invitation is missing its production commit');
    requireValue(/^[0-9a-f]{24}$/.test(release.verification?.homepageCandidate?.productionDeployId || ''), 'homepage invitation is missing its production deploy');
    requireValue(!Number.isNaN(Date.parse(release.verification?.homepageCandidate?.productionPublishedAt || '')), 'homepage invitation is missing its production time');
    requireValue(release.verification?.homepageCandidate?.sourceAndProductionTreesMatch === true && release.verification?.homepageCandidate?.phoneAndDesktopReviewed === true && release.verification?.homepageCandidate?.liveHomepageObserved === true, 'homepage invitation production proof is incomplete');
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
    ownedBrandPreviewPrepared: true,
    visualGate: '0/4',
    externalPublicationAuthorized: false
}, null, 2));
