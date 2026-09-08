#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootFlag = process.argv.indexOf('--root');
const root = rootFlag === -1
    ? path.resolve(__dirname, '..', '..')
    : path.resolve(process.argv[rootFlag + 1] || '');
const recordPath = path.join(root, 'docs/company/growth/OWNED_CHANNEL_ATTENTION_2026-09-08.json');
const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

requireValue(record.schemaVersion === 1 && record.id === 'OWNED-CHANNEL-ATTENTION-001', 'record identity is invalid');
requireValue(record.checkedAt === '2026-09-08T14:50:14Z', 'capture time is missing');
requireValue(record.channel === 'GitHub public repository' && record.repository === 'TechevolveAI/Mythical-Void', 'owned channel is invalid');
requireValue(record.sourceWindow?.start === '2026-08-25' && record.sourceWindow?.end === '2026-09-07' && record.sourceWindow?.days === 14, 'traffic window is invalid');

const views = record.observations?.repositoryViews || {};
requireValue(views.count === 2 && views.uniques === 1, 'repository view evidence has drifted');
requireValue(/not website visits, players, plays, enjoyment, retention or growth/i.test(views.meaning || ''), 'view limits are incomplete');

const clones = record.observations?.repositoryClones || {};
requireValue(clones.count === 856 && clones.uniques === 323, 'clone evidence has drifted');
requireValue(clones.useForAudienceDecisions === false, 'clones must be excluded from audience decisions');
requireValue(/development work, continuous integration and other automated retrieval/i.test(clones.reason || ''), 'clone ambiguity is missing');

requireValue(Array.isArray(record.observations?.popularReferrers) && record.observations.popularReferrers.length === 0, 'popular referrer evidence is invalid');
requireValue(Array.isArray(record.observations?.popularPaths) && record.observations.popularPaths.length === 2, 'popular path evidence is invalid');
requireValue(record.observations.popularPaths.some(item => item.path === '/TechevolveAI/Mythical-Void' && item.uniques === 1), 'repository overview path is missing');

requireValue(/does not show meaningful audience attention/i.test(record.interpretation?.finding || ''), 'the low-attention finding is missing');
requireValue(/Do not spend the next growth cycle polishing/i.test(record.interpretation?.decision || ''), 'the owned-channel decision is unclear');
requireValue(/r\/WebGames post/i.test(record.interpretation?.nextMove || '') && /Kevin's adult account confirmation/i.test(record.interpretation?.nextMove || ''), 'the next controlled experiment is unclear');

requireValue(Array.isArray(record.truthRules) && record.truthRules.length === 5, 'five truth rules are required');
requireValue(record.truthRules.some(rule => /clone is not a person/i.test(rule)), 'clone truth boundary is missing');
requireValue(record.truthRules.some(rule => /does not prove growth/i.test(rule)), 'growth truth boundary is missing');
requireValue(Array.isArray(record.sources) && record.sources.length === 4 && record.sources.every(source => source.startsWith('https://api.github.com/repos/TechevolveAI/Mythical-Void/traffic/')), 'GitHub traffic sources are incomplete');

requireValue(record.authority?.readOnlyEvidenceCollection === true, 'read-only evidence state is missing');
for (const field of ['repositoryChangedByMeasurement', 'externalPostMade', 'accountOpened', 'platformTermsAccepted', 'outreachPerformed', 'paidPromotionStarted']) {
    requireValue(record.authority?.[field] === false, `authority.${field} must remain false`);
}

if (failures.length) {
    console.error('Owned-channel attention evidence is incomplete or unsafe:\n');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(JSON.stringify({
    valid: true,
    channel: record.channel,
    windowDays: record.sourceWindow.days,
    repositoryViews: views.count,
    uniqueRepositoryViews: views.uniques,
    clonesUsedAsAudienceEvidence: clones.useForAudienceDecisions,
    nextMove: 'r/WebGames waiting for Kevin action-time approval',
    externalActionTaken: false
}, null, 2));
