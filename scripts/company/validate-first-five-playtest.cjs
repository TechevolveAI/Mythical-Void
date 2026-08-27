#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1 ? path.resolve(__dirname, '..', '..') : path.resolve(process.argv[rootFlag + 1] || '');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const plan = JSON.parse(read('docs/company/research/first-five-playtest.json'));
const copy = read('docs/company/research/FIRST_FIVE_PLAYTEST.md');
const round = read('docs/company/research/ROUND_001_POSITIONING_AND_TRUST.md');
const operations = JSON.parse(read('docs/company/research/round-001a-operations.json'));
const packageJson = JSON.parse(read('package.json'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

requireValue(plan.id === 'FIRST-FIVE-001', 'playtest identity is missing');
requireValue(plan.state === 'ready_after_gdh009_and_kevin_approval', 'playtest overstates readiness');
requireValue(plan.sessionMinutes === 12, 'session must remain twelve minutes');
requireValue(plan.audience?.adultsOnly === true && plan.audience?.minimumAge === 18 && plan.audience?.targetCount === 5, 'adult-only five-person boundary is missing');
requireValue(plan.audience?.minorParticipationPermitted === false, 'minor participation must remain off');
requireValue(plan.deviceMix?.desktopOrLaptop === 3 && plan.deviceMix?.phone === 2, 'device mix must remain three desktop and two phone sessions');
requireValue(Object.values(plan.entryGates || {}).every(value => value === false || value === null), 'entry gate was opened without a reviewed plan update');
requireValue(plan.entryGates?.stableBuildRef === null, 'stable build must not be invented');
requireValue(plan.sessionSlots?.length === 5, 'exactly five session slots are required');
requireValue(plan.sessionSlots?.filter(slot => slot.deviceClass === 'desktop_or_laptop').length === 3, 'three desktop/laptop slots are required');
requireValue(plan.sessionSlots?.filter(slot => slot.deviceClass === 'phone').length === 2, 'two phone slots are required');
for (const [index, slot] of (plan.sessionSlots || []).entries()) {
    requireValue(slot.participantCode === `A${index + 1}`, `session slot ${index + 1} has the wrong de-identified code`);
    requireValue(slot.state === 'unassigned' && slot.result === null, `${slot.participantCode} must remain empty before approved invitations`);
}
for (const field of ['name', 'contact_details', 'exact_age', 'face', 'voice', 'screen_recording', 'creature_name', 'save_data', 'location', 'account_information']) requireValue(plan.prohibitedData?.includes(field), `prohibited data field is missing: ${field}`);
for (const field of ['recruitmentAuthorized', 'participantContactAuthorized', 'recordingAuthorized', 'compensationAuthorized', 'minorContactAuthorized', 'externalPublicationAuthorized', 'platformSubmissionAuthorized', 'externalActionTaken']) requireValue(plan.authority?.[field] === false, `authority ${field} must remain false`);
requireValue(plan.currentOutcome?.sessionsCompleted === 0 && plan.currentOutcome?.gateEvaluated === false && plan.currentOutcome?.gatePassed === false, 'results are falsely claimed before sessions');
requireValue(plan.releaseRule?.loadSucceededMinimum === 5 && plan.releaseRule?.beganWithoutHelpMinimum === 4 && plan.releaseRule?.creatureUnmistakableMinimum === 4 && plan.releaseRule?.meaningfulActionWithinSixMinutesMinimum === 4 && plan.releaseRule?.nextActionClearMinimum === 4 && plan.releaseRule?.phoneUsableMinimum === 2 && plan.releaseRule?.wantsToContinueYesMinimum === 3, 'release thresholds drifted');
requireValue(plan.releaseRule?.countsAreMarketPercentages === false && plan.releaseRule?.humanReviewCanFailRunDespiteCounts === true && plan.releaseRule?.failedRunMayBeDeletedOrRewritten === false, 'honest interpretation boundary is missing');
for (const phrase of ['five adults', 'twelve-minute product check', 'testing the game, not you', 'Do not explain the game', 'The release rule', 'not audience percentages', 'The test has not started']) requireValue(copy.includes(phrase), `plain-language protocol is missing: ${phrase}`);
requireValue(!/\bcompanion\b/i.test(`${round}\n${JSON.stringify(operations)}`), 'outdated companion-led research wording remains');
requireValue(round.includes('creature relationship lead') && operations.messageCards?.some(card => card.id === 'M-B' && card.name === 'Creature relationship lead'), 'creature-led research framing is incomplete');
requireValue(packageJson.scripts?.['validate:first-five'] === 'node scripts/company/validate-first-five-playtest.cjs', 'repeatable First Five validator command is missing');
requireValue(packageJson.scripts?.['test:first-five'] === 'node scripts/company/test-first-five-playtest.cjs', 'First Five safeguard command is missing');

const serialized = JSON.stringify(plan);
const contactLike = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(serialized) || /(?:\+?\d[\d .()-]{7,}\d)/.test(serialized.replace(/2026-\d{2}-\d{2}/g, ''));
requireValue(!contactLike, 'shared playtest plan appears to contain contact data');

if (failures.length) {
    console.error('First Five playtest is incomplete or unsafe:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({ valid: true, state: plan.state, adultSlots: plan.sessionSlots.length, desktopSlots: 3, phoneSlots: 2, sessionsCompleted: 0, recruitmentAuthorized: false }, null, 2));

