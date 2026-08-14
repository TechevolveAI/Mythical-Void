#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const conceptPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/content/channel-launch/SCIENCE_WEEK_WATER_CONCEPT_2026.json');
const summaryPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(root, 'docs/company/content/channel-launch/SCIENCE_WEEK_WATER_CONCEPT_2026.md');
const concept = JSON.parse(fs.readFileSync(conceptPath, 'utf8'));
const summary = fs.readFileSync(summaryPath, 'utf8');
const biomes = JSON.parse(fs.readFileSync(path.join(root, 'src/config/biomes.json'), 'utf8'));
const reefLevel = fs.readFileSync(path.join(root, 'src/scenes/levels/ReefLevel.js'), 'utf8');
const errors = [];
const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};

requireValue(concept.schemaVersion === 1, 'Science Week water concept schemaVersion must be 1.');
requireValue(concept.state === 'printable_pack_built_internal_review_pending', 'Science Week water work must remain an internal printable pack waiting for review.');
requireValue(concept.opportunity?.dates === '8-15 November 2026' && concept.opportunity?.publishedTheme === 'Water', 'The dated Science Week opportunity must remain accurate.');
requireValue(concept.opportunity?.source === 'https://www.scienceweek.ie/' && concept.opportunity?.sourceCheckedAt === '2026-08-14', 'Science Week facts must retain the official dated source.');
for (const field of ['mythicalEventSubmitted', 'mythicalEventAccepted', 'mythicalPartnershipExists']) {
    requireValue(concept.opportunity?.[field] === false, `${field} must remain false.`);
}

requireValue(concept.realScience?.length === 3, 'Concept must retain three real-space starting points.');
requireValue(concept.realScience?.every(item => item.sourceCheckedAt === '2026-08-14' && /^https:\/\/science\.nasa\.gov\//.test(item.source || '')), 'Every real-space statement must retain a dated official NASA Science source.');
requireValue(/Scientists think Europa/i.test(concept.realScience?.[1]?.statement || ''), 'Europa wording must remain an inference rather than a certainty.');
requireValue(/methane and ethane rather than liquid water/i.test(concept.realScience?.[2]?.statement || ''), 'Titan wording must distinguish its surface liquids from water.');

requireValue(biomes.stellar_reef?.name === 'Stellar Reef', 'The implemented biome must still be Stellar Reef.');
requireValue(/underwater cosmic realm/i.test(biomes.stellar_reef?.description || ''), 'The implemented biome must still support the underwater-cosmic description.');
requireValue(/cosmic[\s*]+energy flows like water/i.test(reefLevel), 'The implemented Reef level must still support the fictional flow premise.');
requireValue(/fictional/i.test(concept.fictionBridge?.fictionLabel || ''), 'The science-to-fiction boundary must remain explicit.');

requireValue(concept.session?.length === 5, 'Concept must retain its five-part session.');
requireValue(concept.alienDesignRules?.length === 5, 'Concept must retain five non-typical alien-design rules.');
requireValue(concept.safeguarding?.length === 5, 'Concept must retain five safeguarding rules.');
requireValue(concept.disclosures?.length === 4, 'Concept must retain four public disclosures.');
requireValue(/No real methane, ethane/i.test((concept.safeguarding || []).join(' ')), 'The activity must forbid unsafe real chemicals.');
requireValue(/Do not use Science Week logos/i.test((concept.disclosures || []).join(' ')), 'Science Week logo and official-event boundary must remain explicit.');

for (const field of ['worksheetExtensionBuilt', 'facilitatorGuideBuilt']) {
    requireValue(concept.readiness?.[field] === true, `${field} must remain true.`);
}
for (const field of ['educatorReviewComplete', 'venueOrHostExists', 'adultSafeguardingOwnerNamed', 'submissionReady', 'publicationReady']) {
    requireValue(concept.readiness?.[field] === false, `${field} must remain false.`);
}
const artifactPath = path.resolve(root, concept.artifact?.file || '');
requireValue(concept.artifact?.format === 'A4 printable PDF' && concept.artifact?.pages === 3, 'Activity artifact must remain a three-page A4 printable PDF.');
requireValue(concept.artifact?.reviewState === 'internal_visual_qa_complete_waiting_for_adult_educator_review', 'Activity pack must remain waiting for adult educator review.');
requireValue(concept.artifact?.publicUseApproved === false, 'Activity pack must remain unapproved for public use.');
requireValue(fs.existsSync(artifactPath), 'Activity PDF must exist at the recorded artifact path.');
if (fs.existsSync(artifactPath)) {
    const actualHash = crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex');
    requireValue(actualHash === concept.artifact?.sha256, 'Activity PDF hash must match the reviewed artifact.');
    const info = spawnSync('pdfinfo', [artifactPath], { encoding: 'utf8' });
    requireValue(info.status === 0 && /^Pages:\s+3$/m.test(info.stdout) && /^Page size:\s+595\.276 x 841\.89 pts \(A4\)$/m.test(info.stdout), 'Activity PDF must remain three A4 pages.');
    const extracted = spawnSync('pdftotext', ['-layout', artifactPath, '-'], { encoding: 'utf8' });
    requireValue(extracted.status === 0, 'Activity PDF text must remain extractable.');
    const requiredText = [
        "WATER THAT ISN'T WATER",
        'DESIGN THE ORGANISM',
        'ADULT FACILITATOR NOTE',
        'Scientists think Europa',
        'NASA does not endorse Mythical Void'
    ];
    requireValue(requiredText.every(text => extracted.stdout.includes(text)), 'Activity PDF must retain its child activity, adult guidance and science boundary text.');
}
requireValue(concept.educatorReview?.state === 'internal_review_packet_ready_no_review_completed', 'Activity must retain its unused adult educator review packet.');
requireValue(concept.educatorReview?.invitationState === 'one_adult_only_draft_ready_waiting_for_kevin', 'Activity must retain its one unsent adult-only review invitation.');
requireValue(fs.existsSync(path.resolve(root, concept.educatorReview?.record || '')), 'Structured adult educator review record must exist.');
requireValue(fs.existsSync(path.resolve(root, concept.educatorReview?.humanReadableChecklist || '')), 'Human-readable adult educator checklist must exist.');
for (const field of ['eventCreationAuthorized', 'eventSubmissionAuthorized', 'partnershipOutreachAuthorized', 'logoUseAuthorized', 'publicationAuthorized', 'childContactAuthorized', 'childWorkCollectionAuthorized', 'spendAuthorized', 'externalActionAuthorized']) {
    requireValue(concept.authority?.[field] === false, `${field} must remain false.`);
}
requireValue(/Do not send it or recruit reviewers yet/i.test(concept.nextStudioAction || ''), 'The next studio action must retain the adult-review outreach gate.');
requireValue(/Keep (?:the finished printable pack|all material) internal until Kevin approves/i.test(concept.nextStudioAction || ''), "The next studio action must retain Kevin's public-release gate.");

const publicText = `${concept.title}\n${concept.preparedPublicSummary}\n${summary}`;
requireValue(!/\bcompanions?\b/i.test(publicText), 'Science Week concept must use creature or organism language.');
requireValue(!/\bno two creatures (?:are )?alike\b|\bevery creature is unique\b/i.test(publicText), 'Science Week concept must not promise absolute uniqueness.');
requireValue(!/\b(?:official|approved) Science Week event\b/i.test(publicText), 'Science Week concept must not claim official or approved event status.');
requireValue(!/\bNASA (?:partner|partnership|approved|endorsed)\b/i.test(publicText), 'Science Week concept must not imply NASA approval or partnership.');

if (errors.length) {
    console.error(`Science Week water concept validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log('Science Week water activity valid: reviewed 3-page A4 pack, 3 real-space sources, implemented Stellar Reef bridge, no event or submission claimed.');
