#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1 ? path.resolve(__dirname, '..', '..') : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const load = relative => JSON.parse(read(relative));
const contract = load('docs/company/product/creature-concept-artist-brief.json');
const founder = load('docs/company/operations/founder-control-page.json');
const brief = read(contract.briefPath || '');
const normalized = brief.replace(/\*\*/g, '').replace(/\s+/g, ' ');
const packageJson = load('package.json');
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };
const exactSet = (actual, expected, label) => requireValue(Array.isArray(actual) && actual.length === expected.length && expected.every(value => actual.includes(value)), `${label} is invalid`);

requireValue(contract.schemaVersion === 1 && contract.id === 'CREATURE-CONCEPT-ARTIST-BRIEF-001', 'brief identity is invalid');
requireValue(contract.asOf === '2026-08-31' && contract.state === 'prepared_for_kevin_approval_no_external_action', 'brief date or state is invalid');
requireValue(contract.briefPath === 'docs/company/product/CREATURE_CONCEPT_ARTIST_BRIEF.md', 'brief path is invalid');
requireValue(typeof contract.objective === 'string' && contract.objective.includes('lovable') && contract.objective.includes('alien') && contract.objective.includes('small-screen'), 'brief objective is incomplete');
exactSet(contract.audience, ['children', 'teenagers', 'families'], 'audience');

const first = contract.firstDelivery || {};
exactSet(first.explorationDirections, ['living_current', 'memory_matter', 'private_gravity'], 'exploration directions');
requireValue(first.silhouettesPerDirection === 4 && first.totalSilhouettes === 12, 'first delivery must contain twelve silhouettes');
requireValue(first.phoneProofWidthPx === 96 && first.labelFreeDecisionSheet === true, 'phone-size label-free decision gate is missing');
requireValue(first.kevinSelectionMaximum === 3 && first.stopWhenNonePass === true, 'Kevin selection stop gate is invalid');
requireValue(first.colourOrRenderingAuthorized === false, 'colour or rendering must wait for selection');

const second = contract.secondDelivery || {};
requireValue(second.startsOnlyAfterKevinSelects === true && second.runtimeIntegrationAuthorized === false, 'second delivery must remain behind Kevin selection');
exactSet(second.views, ['side', 'three_quarter'], 'second-delivery views');
exactSet(second.checks, ['solid_black', 'greyscale', 'three_realm_material', 'phone_game_mockup'], 'second-delivery checks');
exactSet(second.motionMoments, ['rest', 'notice', 'gather_force', 'contact', 'recover'], 'motion moments');
requireValue(second.relatedIdentityExamples === 3, 'three related identities are required');

exactSet(contract.mustReadAs, ['one_connected_organism', 'alive', 'alien', 'appealing', 'physically_coherent'], 'required visual reads');
requireValue(contract.dominantReadsToReject?.length === 8, 'familiar-read rejection list is incomplete');
requireValue(contract.humanApproval?.automationMayRejectObviousFaults === true && contract.humanApproval?.automationMayApproveVisualQuality === false, 'automation visual boundary is invalid');
requireValue(contract.humanApproval?.kevinApprovesDirection === true && contract.humanApproval?.separateAdultApprovesGameplayFrames === true, 'human visual approval path is incomplete');

for (const field of ['provenanceRequired', 'aiAssistanceMustBeRecorded']) requireValue(contract.rights?.[field] === true, `rights.${field} must be true`);
for (const field of ['livingArtistImitationAllowed', 'unlicensedReferenceAllowed', 'childExactAgeOrIdentityAllowed', 'generatedConceptMayBeCalledGameplay']) requireValue(contract.rights?.[field] === false, `rights.${field} must remain false`);
for (const field of ['artistContactAuthorized', 'spendAuthorized', 'contractAuthorized', 'imageGenerationAuthorized', 'gameCodeChangeAuthorized', 'runtimeIntegrationAuthorized', 'pushAuthorized', 'deployAuthorized', 'publicationAuthorized', 'platformUseAuthorized']) requireValue(contract.authority?.[field] === false, `authority.${field} must remain false`);

for (const phrase of [
    '# Mythical Void creature concept artist brief',
    'no artist contacted and no money approved',
    'Find one clear visual language for life from another dimension',
    'Lovable without being a pet',
    'Living current',
    'Memory matter',
    'Private gravity',
    'twelve small black silhouettes',
    'Kevin selects no more than three',
    'Software may reject obvious failures. It may never approve beauty, appeal or originality.',
    'No generated concept may be shown publicly as gameplay.',
    'Spending, artist contact, contracts, publication and platform use each need separate approval.'
]) requireValue(normalized.includes(phrase), `plain-language brief is missing: ${phrase}`);
requireValue(!/\bcompanions?\b/i.test(brief), 'outdated companion wording appears in the creature brief');
requireValue(!/\b(?:nine|9)[ -]year[ -]old\b/i.test(brief), 'the creature brief exposes a child\'s exact age');
requireValue(!/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(brief), 'the creature brief contains contact data');

requireValue(founder.currentDecisions?.length === 1 && founder.currentDecisions?.[0]?.preparedDecisionArtifact === contract.briefPath, 'founder control does not point to the prepared brief');
requireValue(packageJson.scripts?.['validate:creature-art-brief'] === 'node scripts/company/validate-creature-concept-artist-brief.cjs', 'creature art brief validator command is missing');
requireValue(packageJson.scripts?.['test:creature-art-brief'] === 'node scripts/company/test-creature-concept-artist-brief.cjs', 'creature art brief safeguard command is missing');

if (failures.length) {
    console.error('Creature concept artist brief is incomplete or unsafe:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    state: contract.state,
    explorationDirections: first.explorationDirections,
    firstDeliverySilhouettes: first.totalSilhouettes,
    phoneProofWidthPx: first.phoneProofWidthPx,
    automationMayApproveVisualQuality: false,
    externalAuthorityGranted: false
}, null, 2));

