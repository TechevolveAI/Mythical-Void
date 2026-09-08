#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const reportFlag = process.argv.indexOf('--report');
const reportPath = reportFlag === -1
    ? path.join(__dirname, '../../docs/company/operations/game-development-change-watch.json')
    : path.resolve(process.argv[reportFlag + 1] || '');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const errors = [];
const fail = message => errors.push(message);

if (report.schemaVersion !== 1) fail('schemaVersion must be 1');
for (const field of ['baselineCommit', 'candidateCommit', 'mergeBase']) {
    if (!/^[0-9a-f]{40}$/.test(report[field] || '')) fail(`${field} must be an exact commit`);
}
for (const field of ['changedFiles', 'playerVisibleFiles', 'portalFiles']) {
    if (!Array.isArray(report[field])) fail(`${field} must be an array`);
}
if (![
    'no_change',
    'record_private_change',
    'remeasure_portal',
    'prepare_private_visual_review',
    'prepare_private_visual_review_and_remeasure_portal',
    'rebase_or_rebuild_before_review'
].includes(report.action)) fail('action is unknown');
for (const field of [
    'passingTestsAreVisualApproval',
    'generatedArtworkIsGameplayApproval',
    'publicationAuthorized',
    'deploymentAuthorized',
    'portalSubmissionAuthorized'
]) {
    if (report.boundaries?.[field] !== false) fail(`${field} must remain false`);
}
if (report.boundaries?.privateReviewOnly !== true) fail('privateReviewOnly must remain true');

if (errors.length) {
    console.error('Game-development watch is invalid:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}
console.log(JSON.stringify({
    valid: true,
    action: report.action,
    changedFiles: report.changedFiles?.length || 0,
    playerVisibleFiles: report.playerVisibleFiles?.length || 0,
    portalFiles: report.portalFiles?.length || 0,
    publicationAuthorized: false
}, null, 2));
