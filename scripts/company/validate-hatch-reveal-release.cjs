#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const paths = {
    release: process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'docs/company/content/generated/hatch-reveal-proof-release.json'),
    playable: process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'public/playable-now/index.html'),
    storefront: process.argv[4] ? path.resolve(process.argv[4]) : path.join(root, 'src/site/storefront.js'),
    signal: process.argv[5] ? path.resolve(process.argv[5]) : path.join(root, 'public/updates/releases.json'),
    pressAssets: process.argv[6] ? path.resolve(process.argv[6]) : path.join(root, 'public/press/mythical-void-press-assets.json'),
    llms: process.argv[7] ? path.resolve(process.argv[7]) : path.join(root, 'public/llms.txt'),
    manifest: process.argv[8] ? path.resolve(process.argv[8]) : path.join(root, 'public/press/gameplay/manifest.json')
};

const release = JSON.parse(fs.readFileSync(paths.release, 'utf8'));
const playable = fs.readFileSync(paths.playable, 'utf8');
const storefront = fs.readFileSync(paths.storefront, 'utf8');
const signal = JSON.parse(fs.readFileSync(paths.signal, 'utf8'));
const pressAssets = JSON.parse(fs.readFileSync(paths.pressAssets, 'utf8'));
const llms = fs.readFileSync(paths.llms, 'utf8');
const manifest = JSON.parse(fs.readFileSync(paths.manifest, 'utf8'));
const scene = fs.readFileSync(path.join(root, 'src/scenes/HatchingScene.js'), 'utf8');
const smoke = fs.readFileSync(path.join(root, 'scripts/smoke-secondary-journeys.js'), 'utf8');
const assetPath = path.join(root, release.capture?.path || '__missing__');
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

requireValue(release.schemaVersion === 1, 'release schemaVersion must be 1');
requireValue(release.state === 'withdrawn_visual_quality_failed_do_not_publish', 'hatch screenshot must remain withdrawn from public promotion');
requireValue(release.currentHumanReview?.decision === 'withdrawn_from_public_promotion' && /not strong enough/i.test(release.currentHumanReview?.reason || '') && release.currentHumanReview?.replacement === null && release.currentHumanReview?.replacementState === 'pending_new_human_reviewed_gameplay_moment', 'the human visual rejection and pending replacement must remain recorded');
requireValue(release.priorReview?.decision === 'authentic_internal_proof_rejected_for_public_promotion' && release.priorReview?.supersededForOwnedSiteUse === true && release.priorReview?.issuesResolved?.length === 4, 'the rejected old proof and its four fixes must remain recorded');

const capture = manifest.captures?.find(item => item.id === release.capture?.id);
requireValue(Boolean(capture), 'the released hatch capture is missing from the gameplay manifest');
requireValue(capture?.publicPath === '/press/gameplay/creature-cosmic-egg-reveal.png', 'GP-013 public path drifted');
requireValue(capture?.classification === 'authentic_running_build_screenshot' && release.capture?.classification === capture?.classification, 'the hatch proof must remain a real running-build screenshot');
requireValue(capture?.sourceCommit === release.capture?.sourceCommit && /^[a-f0-9]{40}$/.test(capture?.sourceCommit || ''), 'the hatch proof source commit drifted');
requireValue(capture?.width === 1440 && capture?.height === 810 && capture?.bytes === release.capture?.bytes, 'desktop capture dimensions or bytes drifted');
requireValue(fs.existsSync(assetPath), 'the hatch proof image is missing');
if (fs.existsSync(assetPath)) {
    const bytes = fs.readFileSync(assetPath);
    requireValue(sha256(bytes) === capture?.sha256 && capture?.sha256 === release.capture?.sha256, 'the hatch proof fingerprint drifted');
    requireValue(bytes.length === release.capture?.bytes, 'the hatch proof byte count drifted');
}

for (const [field, expected] of Object.entries({ generatedMarketingArtworkUsed: false, playerIdentityUsed: false, personalSaveUsed: false })) {
    requireValue(release.capture?.[field] === expected, `capture.${field} must be ${expected}`);
}
for (const [field, expected] of Object.entries({ fieldClassificationReadable: true, classificationOverlapObserved: false, eggInstructionVisibleAfterReveal: false, tapPromptVisibleAfterReveal: false, controlPanelVisibleAfterReveal: false, scanEstimateVisibleWithoutRescan: false, visibleNextActionCount: 1, nextAction: 'MEET THIS CREATURE' })) {
    requireValue(release.presentation?.[field] === expected, `presentation.${field} must be ${expected}`);
}
requireValue(release.presentation?.creatureBoundsDesktop?.width >= 220 && release.presentation?.creatureBoundsPhone?.width >= 220, 'the creature is not large enough in both reviewed layouts');
requireValue(release.presentation?.phoneViewport?.width === 390 && release.presentation?.phoneViewport?.height === 844, 'the reviewed phone viewport drifted');

requireValue(!playable.includes('/press/gameplay/creature-cosmic-egg-reveal.png') && !playable.includes('/press/gameplay/real-creature-showcase/real-creature-showcase-wide.png') && playable.includes('previous gameplay media pack is withdrawn'), 'Playable Now must keep both weak creature proofs withdrawn pending a new human-reviewed moment');
requireValue(!storefront.includes('id="real-creature-hatch"') && !storefront.includes('/press/gameplay/creature-cosmic-egg-reveal.png'), 'the withdrawn hatch screenshot returned to the press room');
requireValue(!llms.includes('https://mythicalvoid.com/press/#real-creature-hatch'), 'the machine-readable guide still promotes the withdrawn hatch screenshot');

const pressAsset = pressAssets.assets?.find(item => item.url === 'https://mythicalvoid.com/press/gameplay/creature-cosmic-egg-reveal.png');
requireValue(pressAsset?.kind === 'authentic_running_build_screenshot' && pressAsset?.state === 'withdrawn_visual_quality_failed_do_not_publish' && /Retained only as an exact running-build record/i.test(pressAsset?.description || ''), 'the press asset record does not retain the withdrawn state');
const signalEntry = signal.entries?.find(entry => entry.id === 'SIGNAL-012');
requireValue(!signalEntry && release.ownedSiteDiscovery?.signalLogEntry === null && release.ownedSiteDiscovery?.rssAndJsonFeedIncluded === false, 'the withdrawn hatch screenshot is still promoted in the Signal Log or feeds');

for (const [field, expected] of Object.entries({ provesOneRealHatch: true, provesEveryPossibleForm: false, absoluteUniquenessClaimed: false, generatedMarketingArtworkCalledGameplay: false, creatureSentienceClaimed: false })) {
    requireValue(release.claimBoundaries?.[field] === expected, `claimBoundaries.${field} must be ${expected}`);
}
for (const [field, expected] of Object.entries({ ownedWebsitePublicationAuthorized: false, externalSocialPublicationAuthorized: false, emailOrOutreachSendingAuthorized: false, paidPromotionAuthorized: false, publicRepliesAuthorized: false, kevinApprovalRequiredBeforeExternalPublication: true, externalActionTaken: false })) {
    requireValue(release.authority?.[field] === expected, `authority.${field} must be ${expected}`);
}
for (const field of ['freshAutomatedDesktopCapturePassed', 'freshAutomatedPhoneCapturePassed', 'desktopVisualReviewPassed', 'phoneVisualReviewPassed']) {
    requireValue(release.verification?.[field] === true, `verification.${field} must remain true`);
}
requireValue(release.verification?.productionUrlVerified === false, 'production verification must not be invented before release');

const publicWords = `${playable}\n${storefront}\n${JSON.stringify(signalEntry || {})}\n${JSON.stringify(pressAsset || {})}`;
requireValue(!/\bcompanions?\b/i.test(publicWords), 'retired companion wording is present');
requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(publicWords), 'an unsupported creature-uniqueness promise is present');
requireValue(!/NASA (?:made|makes|endorses|partners with) Mythical Void/i.test(publicWords), 'a NASA relationship is implied');
requireValue(scene.includes('const targetScale = width < 600 ? Math.min(2.3, width / 160) : 2.6'), 'large creature presentation rule is missing');
requireValue(scene.includes("const keepLabel = canReroll ? 'CONFIRM CONTACT' : 'MEET THIS CREATURE'"), 'single clear hatch action is missing');
for (const check of ['eggInstructionVisible', 'tapPromptVisible', 'controlPanelVisible', 'scanEstimateVisible', 'classificationOverlapsDetail', 'minimumCreatureWidth']) {
    requireValue(smoke.includes(check), `automated hatch check ${check} is missing`);
}

console.log(JSON.stringify({
    valid: failures.length === 0,
    captureId: release.capture?.id,
    sourceCommit: release.capture?.sourceCommit,
    desktopCreatureWidth: release.presentation?.creatureBoundsDesktop?.width,
    phoneCreatureWidth: release.presentation?.creatureBoundsPhone?.width,
    externalPublicationAuthorized: false,
    failures
}, null, 2));
if (failures.length) process.exit(1);
