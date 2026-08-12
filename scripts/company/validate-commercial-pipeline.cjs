#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const pipelinePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(repositoryRoot, 'docs', 'company', 'commercial', 'opportunities.json');
const allowedStages = new Set([
    'observed', 'researched', 'qualified', 'approved_outreach', 'contacted',
    'discovery', 'evaluation', 'proposal', 'diligence', 'contract', 'launch',
    'expand', 'closed_lost', 'archived'
]);
const allowedRatings = new Set(['low', 'medium', 'high', 'unknown']);
const requiredFit = ['audience', 'product', 'trustSafety', 'learning', 'economics', 'controlRights', 'integration', 'reversibility'];
const failures = [];
const warnings = [];

let pipeline;
try {
    pipeline = JSON.parse(fs.readFileSync(pipelinePath, 'utf8'));
} catch (error) {
    console.error(`Commercial pipeline could not be read: ${error.message}`);
    process.exit(1);
}

if (pipeline.schemaVersion !== 1) failures.push('schemaVersion must be 1');
const ids = new Set();
for (const opportunity of pipeline.opportunities || []) {
    if (!/^OP-\d{3}$/.test(opportunity.id || '')) failures.push(`Invalid opportunity ID ${opportunity.id}`);
    if (ids.has(opportunity.id)) failures.push(`Duplicate opportunity ID ${opportunity.id}`);
    ids.add(opportunity.id);
    if (!allowedStages.has(opportunity.stage)) failures.push(`${opportunity.id} has invalid stage ${opportunity.stage}`);
    if (!/^https:\/\//.test(opportunity.source || '')) failures.push(`${opportunity.id} lacks an HTTPS public source`);
    if (!opportunity.organization || !opportunity.type || !opportunity.rationale || !opportunity.nextAction) {
        failures.push(`${opportunity.id} lacks organization, type, rationale, or next action`);
    }
    requiredFit.forEach(field => {
        if (!allowedRatings.has(opportunity.fit?.[field])) failures.push(`${opportunity.id} has invalid fit.${field}`);
    });
    if (!Array.isArray(opportunity.blockers) || opportunity.blockers.length === 0) {
        failures.push(`${opportunity.id} must state blockers or explicitly use ["None identified"]`);
    }
    const contactedStages = new Set(['contacted', 'discovery', 'evaluation', 'proposal', 'diligence', 'contract', 'launch', 'expand']);
    if (contactedStages.has(opportunity.stage)) {
        if (!opportunity.outreachApproved) failures.push(`${opportunity.id} advanced externally without outreach approval`);
        if (!opportunity.contactedAt) failures.push(`${opportunity.id} advanced externally without contactedAt`);
    }
    if (opportunity.contactedAt && !opportunity.outreachApproved) failures.push(`${opportunity.id} has contact activity without approval`);
    if (opportunity.contact && opportunity.stage === 'researched') {
        warnings.push(`${opportunity.id} includes contact data before qualification; confirm necessity and public provenance`);
    }
}

const stageCounts = {};
for (const opportunity of pipeline.opportunities || []) {
    stageCounts[opportunity.stage] = (stageCounts[opportunity.stage] || 0) + 1;
}

const report = {
    workflow: 'A-007',
    valid: failures.length === 0,
    externalActionsAuthorized: false,
    opportunityCount: (pipeline.opportunities || []).length,
    stageCounts,
    failures,
    warnings,
    nextActions: (pipeline.opportunities || []).map(item => ({ id: item.id, organization: item.organization, nextAction: item.nextAction }))
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;

