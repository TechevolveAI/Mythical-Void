#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const audit = JSON.parse(read('docs/company/growth/LIVE_DISCOVERY_TO_PLAY_AUDIT_2026-08-27.json'));
const copy = read('docs/company/growth/LIVE_DISCOVERY_TO_PLAY_AUDIT_2026-08-27.md');
const visualPlan = JSON.parse(read('docs/company/content/visual-launch-moments.json'));
const handoff = read('docs/company/handoffs/GAME_DEVELOPMENT_HANDOFFS.md');
const packageJson = JSON.parse(read('package.json'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

requireValue(audit.id === 'LIVE-FIRST-IMPRESSION-001', 'audit identity is missing');
requireValue(audit.result === 'owned_entry_pass_game_return_visual_fail_external_launch_closed', 'audit result overstates live quality');
requireValue(audit.scope?.freshFirstTimeGame?.checked === true, 'fresh first-time desktop route must record the observed production check');
requireValue(audit.scope?.freshFirstTimeGame?.completedThrough === 'first_contact_egg' && audit.scope?.freshFirstTimeGame?.meaningfulActionOrHatchReached === false && audit.scope?.freshFirstTimeGame?.phoneChecked === false, 'fresh first-time evidence overstates what was observed');
requireValue(audit.scope?.freshFirstTimeGame?.savedPlayerDataInspected === false && audit.scope?.freshFirstTimeGame?.savedPlayerDataChanged === false, 'fresh first-time evidence crossed the saved-data boundary');
requireValue(audit.scope?.returningGameDesktop?.checked === true && audit.scope?.returningGamePhone?.checked === true, 'returning route viewport evidence is incomplete');
requireValue(audit.conversionRisks?.length === 5, 'five observed conversion risks are required');
for (const id of ['FI-001', 'FI-002', 'FI-003', 'FI-004', 'FI-005']) requireValue(audit.conversionRisks?.some(item => item.id === id), `missing conversion risk ${id}`);
requireValue(audit.conversionRisks?.find(item => item.id === 'FI-004')?.finding.includes('Companion Link'), 'outdated in-game terminology evidence is missing');
requireValue(audit.visualGate?.approvedMoments === 0 && audit.visualGate?.requiredMoments === 4, 'audit visual gate must remain 0 of 4');
requireValue(visualPlan.approvalRule?.approvedMomentCount === 0 && visualPlan.approvalRule?.requiredApprovedMoments === 4, 'authoritative visual gate changed; rerun the live audit deliberately');
for (const field of ['returnSceneApprovedForPromotion', 'gameplayLedDistributionReady']) requireValue(audit.visualGate?.[field] === false, `${field} must remain false`);
for (const field of ['savedStateInspected', 'savedNameRecorded', 'playerDetailsRecorded', 'screenshotsCommitted']) requireValue(audit.privacy?.[field] === false, `privacy boundary ${field} must remain false`);
for (const field of ['externalPublicationAuthorized', 'platformSubmissionAuthorized', 'socialPostingAuthorized', 'gameCodeChangeAuthorizedByThisRecord']) requireValue(audit.authority?.[field] === false, `authority ${field} must remain false`);
for (const phrase of ['This is now a game-presentation problem', 'Make the creature unmistakable', 'Fix the phone composition', 'Use “creature” consistently', 'Prove both beginnings', '0 of 4 approved moments']) requireValue(copy.includes(phrase), `plain-language audit is missing: ${phrase}`);
for (const phrase of ['GDH-009', 'FI-001', 'FI-003', 'Companion Link', 'fresh visitor', 'returning visitor']) requireValue(handoff.includes(phrase), `game-development handoff is missing: ${phrase}`);
requireValue(packageJson.scripts?.['validate:live-first-impression'] === 'node scripts/company/validate-live-first-impression-audit.cjs', 'repeatable audit validator command is missing');

if (failures.length) {
    console.error('Live first-impression audit is incomplete or unsafe:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    result: audit.result,
    conversionRisks: audit.conversionRisks.length,
    freshFirstTimeGameChecked: audit.scope.freshFirstTimeGame.checked,
    visualGate: '0/4',
    externalPublicationAuthorized: false
}, null, 2));
