#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const valueAfter = flag => {
    const index = process.argv.indexOf(flag);
    return index === -1 ? null : process.argv[index + 1];
};
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();

function validateItchListing(candidate, visualPlan, copy) {
    const failures = [];
    const requireValue = (condition, message) => { if (!condition) failures.push(message); };
    const listing = candidate.listing || {};
    const visualGate = candidate.visualGate || {};
    const reviewGate = candidate.reviewGate || {};
    const moments = Array.isArray(visualPlan.requiredMoments) ? visualPlan.requiredMoments : [];
    const slots = Array.isArray(visualGate.screenshotSlots) ? visualGate.screenshotSlots : [];
    const approvedMoments = moments.filter(moment => moment.currentState === 'approved');
    const slotIds = slots.map(slot => slot.momentId);
    const momentIds = moments.map(moment => moment.id);
    const tags = Array.isArray(listing.tags) ? listing.tags : [];
    const combinedPublicCopy = `${JSON.stringify(listing)}\n${copy}`;

    requireValue(candidate.id === 'ITCH-CANDIDATE-001', 'candidate identity is invalid');
    requireValue(candidate.state === 'technical_package_ready_visual_and_account_approval_pending', 'candidate state is not truthful');
    requireValue(candidate.directPlay === true && candidate.entryPoint === 'index.html', 'candidate must open the game directly');

    requireValue(listing.title === 'Mythical Void', 'listing title drifted');
    requireValue(listing.kind === 'html_game' && listing.releaseStage === 'early_access', 'listing kind or release stage drifted');
    requireValue(listing.genre === 'Adventure' && listing.engine === 'Phaser', 'listing genre or engine drifted');
    requireValue(listing.price === 'free' && listing.donationRequest === false, 'first release must remain free without a donation request');
    requireValue(listing.mobileFriendlyClaimApproved === false, 'mobile-friendly must not be claimed before the uploaded build passes a phone test');
    requireValue(normalize(listing.shortDescription).length >= 70, 'short description is too vague');
    requireValue(normalize(listing.opening).includes('free browser adventure'), 'opening does not plainly describe the playable offer');
    requireValue(normalize(listing.longDescription).includes('NASA does not endorse Mythical Void.'), 'NASA non-endorsement is missing');
    requireValue(/Generative AI/i.test(listing.longDescription || ''), 'generative-AI disclosure is missing');
    requireValue(listing.disclosures?.earlyAccess === true, 'early-access disclosure is missing');
    requireValue(listing.disclosures?.formalAgeRatingClaimed === false, 'the listing must not invent a formal age rating');
    requireValue(listing.disclosures?.generativeAiUseDisclosed === true, 'the listing must disclose generative-AI use');
    requireValue(listing.disclosures?.nasaEndorsementClaimed === false, 'the listing must not imply NASA endorsement');
    requireValue(listing.disclosures?.imaginedMarketingArtMayBeCalledGameplay === false, 'imagined art must not be presented as gameplay');
    for (const fact of ['free', 'no download', 'no account', 'no payment details']) {
        requireValue(listing.accessFacts?.includes(fact), `access fact is missing: ${fact}`);
    }
    for (const control of ['WASD or arrow keys to move', 'Space to interact']) {
        requireValue(listing.controls?.includes(control), `real control is missing: ${control}`);
    }

    requireValue(tags.length >= 5 && tags.length <= 10, 'listing needs five to ten focused tags');
    requireValue(new Set(tags.map(tag => tag.toLowerCase())).size === tags.length, 'listing tags must be distinct');
    for (const tag of ['Adventure', 'Aliens', 'Creatures', 'Family Friendly', 'Science Fiction', 'Story Rich']) {
        requireValue(tags.includes(tag), `focused discovery tag is missing: ${tag}`);
    }
    requireValue(!/\bcompanions?\b/i.test(combinedPublicCopy), 'retired companion wording is present');
    requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(combinedPublicCopy), 'unsupported creature-uniqueness promise is present');

    requireValue(visualGate.sourceOfTruth === 'docs/company/content/visual-launch-moments.json', 'visual source of truth is missing');
    requireValue(visualGate.approvedMoments === approvedMoments.length, 'approved visual count does not match the human visual register');
    requireValue(visualGate.requiredMoments === visualPlan.approvalRule?.requiredApprovedMoments, 'required visual count does not match the human visual register');
    requireValue(slots.length === moments.length && new Set(slotIds).size === moments.length, 'listing must have one distinct screenshot slot for every required moment');
    for (const momentId of momentIds) requireValue(slotIds.includes(momentId), `screenshot slot is missing: ${momentId}`);
    for (const slot of slots) {
        const moment = moments.find(item => item.id === slot.momentId);
        if (!moment) continue;
        requireValue(normalize(slot.caption).length >= 25, `${slot.momentId} needs a clear player-facing caption`);
        if (moment.currentState === 'approved') {
            requireValue(slot.state === 'approved', `${slot.momentId} does not reflect its human approval`);
            requireValue(slot.assetPath === moment.candidatePath, `${slot.momentId} is not bound to the approved asset`);
        } else {
            requireValue(slot.state === 'waiting_for_approved_gameplay', `${slot.momentId} must remain waiting for human approval`);
            requireValue(slot.assetPath === null, `${slot.momentId} attached an unapproved image`);
        }
    }
    requireValue(visualGate.cover?.state === 'waiting_for_approved_cover' && visualGate.cover?.assetPath === null, 'an unapproved cover is attached');
    requireValue(visualGate.cover?.requiredWidth === 630 && visualGate.cover?.requiredHeight === 500, 'cover review size is missing');
    requireValue(visualGate.cover?.mustResembleActualGame === true, 'cover does not require resemblance to the actual game');
    requireValue(visualGate.trailer?.state === 'waiting_for_human_review' && visualGate.trailer?.assetPath === null, 'an unapproved trailer is attached');

    requireValue(reviewGate.state === 'ready_for_human_review_when_visual_gate_passes', 'listing review state is invalid');
    requireValue(reviewGate.distributionDecisionId === 'D-018' && reviewGate.distributionDecisionMade === false, 'distribution-rights decision must remain open');
    requireValue(reviewGate.itchAccountAccessProvided === false && reviewGate.pageCreated === false, 'the listing invents an account or page');
    requireValue(reviewGate.readyForPublication === false && reviewGate.kevinApprovalRequired === true, 'publication must remain blocked for Kevin review');
    for (const field of ['externalPublicationAuthorized', 'platformTermsAccepted', 'paidPromotionAuthorized', 'directMessagesAuthorized', 'bulkOutreachAuthorized', 'hostedAiMediaPromisedInPortal', 'liveNasaDataGuaranteed']) {
        requireValue(candidate.boundaries?.[field] === false, `candidate boundary ${field} must remain false`);
    }

    const normalizedCopy = normalize(copy);
    for (const fragment of [listing.title, listing.shortDescription, listing.opening, listing.longDescription]) {
        requireValue(normalizedCopy.includes(normalize(fragment)), 'human review page drifted from the machine-checked listing copy');
    }
    for (const phrase of ['ready-to-paste page draft', 'The four image slots', 'Final page check', 'ready for review—not ready for publication']) {
        requireValue(copy.includes(phrase), `human review page is missing: ${phrase}`);
    }

    return failures;
}

function run() {
    const candidatePath = path.resolve(valueAfter('--candidate') || path.join(root, 'docs/company/growth/ITCH_RELEASE_CANDIDATE.json'));
    const visualPlanPath = path.resolve(valueAfter('--visual-plan') || path.join(root, 'docs/company/content/visual-launch-moments.json'));
    const copyPath = path.resolve(valueAfter('--copy') || path.join(root, 'docs/company/growth/ITCH_RELEASE_CANDIDATE.md'));
    const candidate = readJson(candidatePath);
    const visualPlan = readJson(visualPlanPath);
    const copy = fs.readFileSync(copyPath, 'utf8');
    const failures = validateItchListing(candidate, visualPlan, copy);

    console.log(JSON.stringify({
        valid: failures.length === 0,
        state: candidate.reviewGate?.state,
        approvedGameplayMoments: candidate.visualGate?.approvedMoments,
        requiredGameplayMoments: candidate.visualGate?.requiredMoments,
        coverAttached: Boolean(candidate.visualGate?.cover?.assetPath),
        publicationAuthorized: candidate.boundaries?.externalPublicationAuthorized,
        failures
    }, null, 2));
    if (failures.length) process.exit(1);
}

if (require.main === module) run();

module.exports = { validateItchListing };
