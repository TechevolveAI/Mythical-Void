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

function validateIndieDbPage(candidate, copy, visualRegister, options = {}) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const repositoryRoot = path.resolve(options.root || root);
    const packageJson = options.packageJson || readJson(path.join(repositoryRoot, 'package.json'));
    const listing = candidate.listing || {};
    const media = candidate.mediaGate || {};
    const form = candidate.signedInFormReview || {};
    const terms = candidate.termsReview || {};
    const gate = candidate.releaseGate || {};
    const approvedByPublicPath = new Map((visualRegister.publicApproved || []).map(item => [item.path, item]));

    requireValue(candidate.schemaVersion === 1 && candidate.id === 'INDIEDB-PAGE-CANDIDATE-2026-09-08', 'candidate identity is invalid');
    requireValue(candidate.checkedOn === '2026-09-08', 'candidate check date is stale');
    requireValue(candidate.state === 'copy_and_rights_packet_ready_waiting_for_adult_account_terms_form_check_and_final_preview', 'candidate state overstates readiness');
    requireValue(candidate.platform?.name === 'IndieDB' && candidate.platform?.kind === 'public_independent_game_profile', 'platform identity is invalid');
    requireValue(candidate.platform?.profileCreationUrl === 'https://www.indiedb.com/games/add', 'profile creation doorway is missing');
    requireValue(candidate.platform?.intendedRoute === 'official_website_link' && candidate.platform?.uploadedBuildPlanned === false, 'link-first profile boundary is missing');
    requireValue(candidate.platform?.audienceSizeClaimed === false && candidate.platform?.playerCountClaimed === false, 'candidate invents audience or player numbers');

    requireValue(listing.title === 'Mythical Void', 'listing title drifted');
    requireValue(listing.developmentStatus === 'Early access / in development', 'development status is not honest');
    requireValue(listing.platform === 'Web browser' && listing.engine === 'Phaser 3', 'platform or engine drifted');
    requireValue(listing.officialWebsite === 'https://mythicalvoid.com/' && listing.playUrl === 'https://mythicalvoid.com/play/' && listing.pressRoom === 'https://mythicalvoid.com/press/', 'clean owned links are missing');
    requireValue(normalize(listing.shortDescription).length >= 80, 'short description is too vague');
    requireValue(/free browser adventure/i.test(listing.opening || ''), 'opening does not plainly explain the playable offer');
    requireValue(/Generative AI/i.test(listing.fullDescription || '') && /people remain responsible/i.test(listing.fullDescription || ''), 'full description lacks the AI responsibility boundary');
    requireValue(/not made, approved or endorsed by NASA/i.test(listing.fullDescription || '') && /not made, approved or endorsed by NASA/i.test(listing.nasaDisclosure || ''), 'NASA non-endorsement is missing');
    requireValue(/father-and-son project/i.test(listing.studioStory || '') && /young son/i.test(listing.studioStory || ''), 'father-and-son origin is missing or over-personalised');
    for (const fact of ['free', 'single player', 'plays in a modern browser', 'no download needed to start', 'no account needed to start']) {
        requireValue(listing.accessFacts?.includes(fact), `access fact is missing: ${fact}`);
    }
    for (const field of ['formalAgeRatingClaimed', 'globalCreatureUniquenessClaimed', 'sentientCreaturesClaimed', 'fullyAutonomousStudioClaimed', 'nasaPartnershipClaimed', 'audienceOrPopularityClaimed']) {
        requireValue(listing.claimBoundaries?.[field] === false, `listing claim boundary ${field} must remain false`);
    }

    const publicCopy = [
        listing.title, listing.shortDescription, listing.opening, listing.fullDescription,
        ...(listing.keyFeatures || []), listing.studioStory, listing.aiDisclosure, listing.nasaDisclosure,
        copy
    ].join('\n');
    requireValue(!/\bcompanions?\b/i.test(publicCopy), 'retired companion wording is present');
    requireValue(!/\bsignals?\b/i.test(publicCopy), 'vague signal wording is present');
    requireValue(!/every creature is unique|no two creatures|infinite(?:ly)? unique|sentient|conscious creature/i.test(publicCopy), 'unsupported creature claim is present');
    requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(publicCopy), 'tracking parameter is present');
    requireValue(!/millions? of (?:players|members|views)|thousands? playing|playing now/i.test(publicCopy), 'invented popularity claim is present');

    requireValue(media.sourceOfTruth === 'public/press/visual-publication-register.json', 'visual source of truth is missing');
    requireValue(media.approvedGameplayMoments === 0 && media.screenshotsAttached === 0 && media.videosAttached === 0, 'candidate attaches or claims unapproved gameplay media');
    requireValue(Array.isArray(media.approvedBrandAssets) && media.approvedBrandAssets.length === 2, 'approved brand asset set is invalid');
    for (const asset of media.approvedBrandAssets || []) {
        const absolute = path.resolve(repositoryRoot, asset.repositoryPath || '');
        requireValue(absolute.startsWith(`${repositoryRoot}${path.sep}`) && fs.existsSync(absolute), `approved asset is missing: ${asset.repositoryPath}`);
        const publicPath = `/${String(asset.repositoryPath || '').replace(/^public\//, '')}`;
        requireValue(approvedByPublicPath.get(publicPath)?.review?.startsWith('approved'), `asset is not approved in the public visual register: ${publicPath}`);
        requireValue(/not_gameplay/.test(asset.classification || ''), `asset lacks a not-gameplay classification: ${asset.repositoryPath}`);
    }
    requireValue(/human visual review/i.test(media.rule || ''), 'human visual review rule is missing');
    for (const phrase of ['gameplay screenshots', 'gameplay video', 'generated creature-universe art presented as gameplay', 'withdrawn press and social media families']) {
        requireValue(media.withheld?.includes(phrase), `withheld media boundary is missing: ${phrase}`);
    }

    requireValue(form.completed === false, 'signed-in form is falsely marked checked');
    for (const field of ['exactRequiredFields', 'profileImageDimensionsConfirmed', 'headerImageDimensionsConfirmed', 'aiDisclosureFieldConfirmed', 'teamOrDeveloperProfileRequirementConfirmed', 'uploadedBuildRequiredConfirmed']) {
        requireValue(form[field] === null || form[field] === false, `signed-in form field ${field} is falsely confirmed`);
    }
    requireValue(form.externalWebsiteFieldConfirmed === false, 'external website field is falsely confirmed');

    requireValue(terms.source === 'https://www.indiedb.com/terms-of-use' && terms.checkedOn === candidate.checkedOn, 'terms source or date is missing');
    requireValue(Array.isArray(terms.summaryForFounderReview) && terms.summaryForFounderReview.some(item => /broad worldwide, non-exclusive, royalty-free licence/i.test(item)), 'broad content licence is not disclosed');
    requireValue(terms.summaryForFounderReview?.some(item => /under 13/i.test(item) && /adult account/i.test(item)), 'adult account boundary is missing');
    requireValue(terms.accepted === false && terms.acceptedByKevin === false && terms.legalAdviceProvided === false, 'terms acceptance or legal-advice boundary is invalid');

    requireValue(gate.copyPrepared === true && gate.rightsPacketPrepared === true, 'prepared work is missing');
    for (const field of ['adultAccountAvailable', 'signedInFormChecked', 'exactMediaRightsConfirmedAtUpload', 'aiDisclosurePlacedInPreview', 'finalPreviewApprovedByKevin', 'pageSaved', 'pagePublished', 'readyForPublication']) {
        requireValue(gate[field] === false, `release gate ${field} must remain false`);
    }
    for (const [field, value] of Object.entries(candidate.authority || {})) {
        requireValue(value === false, `authority.${field} must remain false`);
    }
    requireValue(Object.keys(candidate.authority || {}).length === 12, 'authority boundary is incomplete');

    requireValue(Array.isArray(candidate.sourceEvidence) && candidate.sourceEvidence.length === 3, 'official source evidence is incomplete');
    for (const source of candidate.sourceEvidence || []) {
        requireValue(/^https:\/\/www\.indiedb\.com\//.test(source.url || '') && source.observedOn === candidate.checkedOn && Boolean(source.finding), 'source evidence is invalid or stale');
        requireValue(copy.includes(source.url), `plain-language handoff is missing source ${source.url}`);
    }
    requireValue(/read-only signed-in form check/i.test(candidate.nextRequiredAction || '') && /Do not save or publish/i.test(candidate.nextRequiredAction || ''), 'next founder action is not safely bounded');

    requireValue(packageJson.scripts?.['validate:indiedb-page'] === 'node scripts/company/validate-indiedb-page-candidate.cjs', 'IndieDB validation command is missing');
    requireValue(packageJson.scripts?.['test:indiedb-page'] === 'node scripts/company/test-indiedb-page-candidate.cjs', 'IndieDB test command is missing');
    requireValue(packageJson.scripts?.build?.includes('npm run validate:indiedb-page') && packageJson.scripts?.build?.includes('npm run test:indiedb-page'), 'IndieDB safeguards are not part of the production build');

    const normalizedCopy = normalize(copy);
    for (const fragment of [listing.shortDescription, listing.opening, listing.fullDescription, listing.studioStory, listing.aiDisclosure, listing.nasaDisclosure]) {
        requireValue(normalizedCopy.includes(normalize(fragment)), 'plain-language handoff drifted from checked listing copy');
    }
    for (const phrase of ['Ready-to-paste page draft', 'zero approved gameplay screenshots and zero approved gameplay videos', 'Signed-in form check', 'ready for founder review—not ready for publication', 'operational summary, not legal advice']) {
        requireValue(normalizedCopy.includes(normalize(phrase)), `plain-language handoff is missing: ${phrase}`);
    }

    return failures;
}

function run() {
    const candidatePath = path.resolve(valueAfter('--candidate') || path.join(root, 'docs/company/growth/INDIEDB_PAGE_CANDIDATE_2026-09-08.json'));
    const copyPath = path.resolve(valueAfter('--copy') || path.join(root, 'docs/company/growth/INDIEDB_PAGE_CANDIDATE_2026-09-08.md'));
    const registerPath = path.resolve(valueAfter('--visual-register') || path.join(root, 'public/press/visual-publication-register.json'));
    const candidate = readJson(candidatePath);
    const failures = validateIndieDbPage(candidate, fs.readFileSync(copyPath, 'utf8'), readJson(registerPath), { root });

    console.log(JSON.stringify({
        valid: failures.length === 0,
        state: candidate.state,
        screenshotsAttached: candidate.mediaGate?.screenshotsAttached,
        videosAttached: candidate.mediaGate?.videosAttached,
        accountOpened: candidate.authority?.accountOpened,
        termsAccepted: candidate.termsReview?.accepted,
        pagePublished: candidate.releaseGate?.pagePublished,
        failures
    }, null, 2));
    if (failures.length) process.exit(1);
}

if (require.main === module) run();

module.exports = { validateIndieDbPage };
