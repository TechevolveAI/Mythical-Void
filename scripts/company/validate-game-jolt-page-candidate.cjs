#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const valueAfter = flag => {
    const index = process.argv.indexOf(flag);
    return index === -1 ? null : process.argv[index + 1];
};
const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function validateGameJoltPage(candidate, copy, visualRegister, options = {}) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const repositoryRoot = path.resolve(options.root || root);
    const packageJson = options.packageJson || readJson(path.join(repositoryRoot, 'package.json'));
    const platform = candidate.platform || {};
    const listing = candidate.listing || {};
    const observed = candidate.publicRequirementsObserved || {};
    const build = candidate.buildGate || {};
    const media = candidate.mediaGate || {};
    const form = candidate.signedInReview || {};
    const care = candidate.communityCare || {};
    const terms = candidate.termsReview || {};
    const gate = candidate.releaseGate || {};

    requireValue(candidate.schemaVersion === 1 && candidate.id === 'GAME-JOLT-PAGE-CANDIDATE-2026-09-09', 'candidate identity is invalid');
    requireValue(candidate.checkedOn === '2026-09-09', 'candidate check date is stale');
    requireValue(candidate.state === 'copy_ready_public_fit_confirmed_waiting_for_adult_account_terms_signed_in_form_media_and_build_review', 'candidate overstates publication readiness');
    requireValue(platform.name === 'Game Jolt' && platform.kind === 'browser_game_catalogue_and_social_game_page', 'platform identity is invalid');
    requireValue(platform.publicCatalogue === 'https://gamejolt.com/games' && platform.addGameUrl === 'https://gamejolt.com/dashboard/games/add', 'Game Jolt public or add-game route is missing');
    requireValue(/Browser games/i.test(platform.audienceFit || '') && /maturity/i.test(platform.audienceFit || '') && /early-access/i.test(platform.audienceFit || ''), 'public audience fit is incomplete');
    requireValue(platform.accountRequired === true && platform.termsAcceptedAtSignup === true, 'account and terms boundary is missing');
    requireValue(platform.gameApiRequiredForInitialPage === false && platform.listingOnlyWithoutBuildPlanned === false, 'candidate invents a page-only or required-API route');
    requireValue(platform.audienceSizeClaimed === false && platform.playerCountClaimed === false, 'candidate invents audience or player numbers');

    requireValue(listing.title === 'Mythical Void' && listing.developmentStatus === 'Early Access' && listing.platform === 'Browser / HTML5' && listing.price === 'Free' && listing.engine === 'Phaser 3', 'listing identity or public classification drifted');
    requireValue(listing.officialWebsite === 'https://mythicalvoid.com/' && listing.playUrl === 'https://mythicalvoid.com/play/' && listing.pressRoom === 'https://mythicalvoid.com/press/', 'clean owned links are missing');
    requireValue(normalize(listing.shortDescription).length >= 100 && normalize(listing.shortDescription).length <= 160, 'short description is not concise and useful');
    requireValue(/free single-player browser adventure/i.test(listing.fullDescription || '') && /no download or account/i.test(listing.fullDescription || ''), 'playable offer is incomplete');
    requireValue(/father-and-son project/i.test(listing.fullDescription || '') && /father-and-son project/i.test(listing.studioStory || ''), 'father-and-son origin is missing');
    requireValue(/Generative AI/i.test(listing.fullDescription || '') && /people remain responsible/i.test(listing.aiDisclosure || ''), 'AI assistance and human responsibility are incomplete');
    requireValue(/not made, approved or endorsed by NASA/i.test(listing.fullDescription || '') && /not made, approved or endorsed by NASA/i.test(listing.nasaDisclosure || ''), 'NASA non-endorsement is missing');
    requireValue(/no formal rating is claimed/i.test(listing.maturityRating || ''), 'candidate invents a formal maturity rating');
    for (const field of ['formalAgeRatingClaimed', 'globalCreatureUniquenessClaimed', 'sentientCreaturesClaimed', 'nasaPartnershipClaimed', 'audienceOrPopularityClaimed', 'platformAcceptancePromised']) {
        requireValue(listing.claimBoundaries?.[field] === false, `listing claim boundary ${field} must remain false`);
    }

    const publicCopy = [listing.title, listing.shortDescription, listing.fullDescription, ...(listing.features || []), listing.aiDisclosure, listing.nasaDisclosure, listing.studioStory, copy].join('\n');
    requireValue(!/\bcompanions?\b/i.test(publicCopy), 'retired companion wording is present');
    requireValue(!/\bsignals?\b/i.test(publicCopy), 'vague signal wording is present');
    requireValue(!/every creature is unique|no two creatures|infinitely unique|sentient|conscious creature/i.test(publicCopy), 'unsupported creature claim is present');
    requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(publicCopy), 'tracking parameter is present');
    requireValue(!/millions? of (?:players|members|views)|thousands? playing|playing now/i.test(publicCopy), 'invented popularity claim is present');

    for (const field of ['browserHtml5CatalogueObserved', 'freeFilterObserved', 'earlyAccessFilterObserved', 'maturityFilterObserved', 'thumbnailRequiredBeforePublish', 'maturityRatingRequiredBeforePublish', 'releasePackageAndGamePageNeededForDiscovery']) {
        requireValue(observed[field] === true, `public requirement ${field} is missing`);
    }
    for (const field of ['currentSignedInUploadFieldsObserved', 'currentPackageLimitsObserved', 'currentAiMediaPolicyObserved']) {
        requireValue(observed[field] === false, `unknown public requirement ${field} is falsely confirmed`);
    }
    requireValue(/archived official FAQ/i.test(observed.note || '') && /signed-in read-only check/i.test(observed.note || ''), 'source limits are not explained');

    requireValue(build.uploadedBuildRequiredForPlannedBrowserListing === true && build.candidateBuildSelected === false, 'browser-build state is invalid');
    for (const field of ['currentGameJoltPackageRequirementsConfirmed', 'browserEmbedJourneyPassed', 'mobileJourneyPassed', 'externalRequestsReviewed', 'gameJoltApiIncluded', 'sdkIncluded', 'saveOrAccountIntegrationAdded']) {
        requireValue(build[field] === false, `build gate ${field} must remain false`);
    }
    requireValue(/Do not upload the normal website/i.test(build.rule || '') && /isolated browser package/i.test(build.rule || ''), 'isolated browser-build boundary is missing');

    requireValue(media.sourceOfTruth === 'public/press/visual-publication-register.json', 'visual source of truth is missing');
    requireValue(media.requiredThumbnailApproved === false && media.requiredThumbnailPrepared === false && media.headerPrepared === false, 'candidate invents approved catalogue media');
    requireValue(media.gameplayScreenshotsAttached === 0 && media.gameplayVideosAttached === 0, 'candidate attaches unapproved gameplay media');
    const asset = media.possibleBrandSource || {};
    const absoluteAsset = path.resolve(repositoryRoot, asset.repositoryPath || '');
    requireValue(absoluteAsset.startsWith(`${repositoryRoot}${path.sep}`) && fs.existsSync(absoluteAsset), 'possible brand source is missing');
    const publicPath = `/${String(asset.repositoryPath || '').replace(/^public\//, '')}`;
    requireValue((visualRegister.publicApproved || []).some(item => item.path === publicPath && /^approved/.test(item.review || '')), 'possible brand source is not approved in the visual register');
    requireValue(/not_gameplay/.test(asset.classification || '') && /Do not crop, resize or upload/i.test(asset.use || ''), 'brand-source use boundary is incomplete');
    requireValue(/not gameplay/i.test(media.rule || '') && /human visual approval/i.test(media.rule || ''), 'media truth and human-review boundary is missing');

    requireValue(form.completed === false && form.exactRequiredFields === null, 'signed-in form is falsely marked complete');
    for (const field of ['packageTypesAndLimitsConfirmed', 'browserEmbedRulesConfirmed', 'thumbnailDimensionsAndCropConfirmed', 'headerDimensionsAndCropConfirmed', 'maturityChoicesConfirmed', 'aiDisclosurePlacementConfirmed', 'aiGeneratedMediaRuleConfirmed', 'commentAndMessageControlsConfirmed', 'externalWebsiteFieldConfirmed']) {
        requireValue(form[field] === false, `signed-in form field ${field} is falsely confirmed`);
    }
    requireValue(/Do not save a draft, upload a file, join a community or publish/i.test(form.note || ''), 'read-only signed-in review boundary is missing');

    requireValue(care.commentsExpectedOnGamePage === true && care.adultReplyOwnerRequired === true, 'adult comment ownership is missing');
    requireValue(care.automatedRepliesAllowed === false && care.privateConversationWithChildAllowed === false && care.personalDetailsRequestedFromPlayers === false, 'community safety boundary is incomplete');
    requireValue(care.ongoingDevlogCadencePromised === false, 'candidate promises an unsupported publishing cadence');

    for (const field of ['currentTermsReadByKevin', 'termsAccepted', 'privacyAndCookieTermsAccepted', 'contentRightsReviewed', 'accountDeletionRouteReviewed', 'legalAdviceProvided']) {
        requireValue(terms[field] === false, `terms field ${field} must remain false`);
    }
    requireValue(/signing up accepts/i.test(terms.note || '') && /Kevin must review/i.test(terms.note || ''), 'terms decision boundary is missing');

    requireValue(gate.copyPrepared === true && gate.publicAudienceFitConfirmed === true, 'prepared page work is missing');
    for (const field of ['adultAccountAvailable', 'signedInFormChecked', 'termsApprovedByKevin', 'exactBuildApproved', 'exactThumbnailApproved', 'maturityChoiceApproved', 'aiDisclosureVisibleInPreview', 'adultReplyCoverageConfirmed', 'finalPreviewApprovedByKevin', 'gamePageSaved', 'buildUploaded', 'gamePublished', 'readyForPublication']) {
        requireValue(gate[field] === false, `release gate ${field} must remain false`);
    }
    requireValue(Object.keys(candidate.authority || {}).length === 14, 'authority boundary is incomplete');
    for (const [field, value] of Object.entries(candidate.authority || {})) requireValue(value === false, `authority.${field} must remain false`);

    requireValue(candidate.sourceEvidence?.length === 4, 'official source evidence is incomplete');
    for (const source of candidate.sourceEvidence || []) {
        requireValue(/^https:\/\/(?:ssr\.)?gamejolt\.net\//.test(source.url || '') && source.observedOn === candidate.checkedOn && Boolean(source.finding), 'source evidence is invalid or stale');
        requireValue(copy.includes(source.url), `plain-language handoff is missing source ${source.url}`);
    }
    requireValue(/After the Reddit test is read or cancelled/i.test(candidate.nextRequiredAction || '') && /Do not save, upload, join, accept terms or publish/i.test(candidate.nextRequiredAction || ''), 'next founder action is not safely sequenced');

    const normalizedCopy = normalize(copy);
    for (const fragment of [listing.shortDescription, listing.fullDescription, listing.aiDisclosure, listing.nasaDisclosure, listing.studioStory]) {
        requireValue(normalizedCopy.includes(normalize(fragment)), 'plain-language handoff drifted from checked listing copy');
    }
    for (const phrase of ['Ready-to-paste page draft', 'zero approved Game Jolt gameplay screenshots and zero approved gameplay videos', 'Read-only signed-in check', 'ready for a later founder decision—not ready for publication', 'operating summary, not legal advice']) {
        requireValue(normalizedCopy.includes(normalize(phrase)), `plain-language handoff is missing: ${phrase}`);
    }

    requireValue(packageJson.scripts?.['validate:game-jolt-page'] === 'node scripts/company/validate-game-jolt-page-candidate.cjs', 'Game Jolt validation command is missing');
    requireValue(packageJson.scripts?.['test:game-jolt-page'] === 'node scripts/company/test-game-jolt-page-candidate.cjs', 'Game Jolt test command is missing');
    requireValue(packageJson.scripts?.build?.includes('npm run validate:game-jolt-page') && packageJson.scripts?.build?.includes('npm run test:game-jolt-page'), 'Game Jolt safeguards are not part of the production build');
    return failures;
}

function run() {
    const candidatePath = path.resolve(valueAfter('--candidate') || path.join(root, 'docs/company/growth/GAME_JOLT_PAGE_CANDIDATE_2026-09-09.json'));
    const copyPath = path.resolve(valueAfter('--copy') || path.join(root, 'docs/company/growth/GAME_JOLT_PAGE_CANDIDATE_2026-09-09.md'));
    const registerPath = path.resolve(valueAfter('--visual-register') || path.join(root, 'public/press/visual-publication-register.json'));
    const candidate = readJson(candidatePath);
    const failures = validateGameJoltPage(candidate, fs.readFileSync(copyPath, 'utf8'), readJson(registerPath), { root });
    console.log(JSON.stringify({
        valid: failures.length === 0,
        state: candidate.state,
        publicFitConfirmed: candidate.releaseGate?.publicAudienceFitConfirmed,
        accountOpened: candidate.authority?.accountOpened,
        buildUploaded: candidate.authority?.buildUploaded,
        gamePublished: candidate.authority?.gamePublished,
        failures
    }, null, 2));
    if (failures.length) process.exit(1);
}

if (require.main === module) run();
module.exports = { validateGameJoltPage };
