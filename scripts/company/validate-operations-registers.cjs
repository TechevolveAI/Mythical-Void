#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const vendorPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(repositoryRoot, 'docs', 'company', 'operations', 'vendors.json');
const riskPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(repositoryRoot, 'docs', 'company', 'operations', 'risks.json');
if (process.argv.length > 4) {
    console.error('Usage: validate-operations-registers.cjs [vendors.json] [risks.json]');
    process.exit(1);
}
const failures = [];
const warnings = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} register could not be read: ${error.message}`);
        process.exit(1);
    }
}

const vendors = load(vendorPath, 'Vendor');
const risks = load(riskPath, 'Risk');
if (vendors.schemaVersion !== 1) failures.push('Vendor schemaVersion must be 1');
if (risks.schemaVersion !== 1) failures.push('Risk schemaVersion must be 1');

function uniqueIds(items, pattern, label) {
    const seen = new Set();
    for (const item of items) {
        if (!pattern.test(item.id || '')) failures.push(`${label} has invalid ID ${item.id}`);
        if (seen.has(item.id)) failures.push(`Duplicate ${label} ID ${item.id}`);
        seen.add(item.id);
    }
}

uniqueIds(vendors.vendors || [], /^V-\d{3}$/, 'vendor');
uniqueIds(risks.risks || [], /^R-\d{3}$/, 'risk');

for (const vendor of vendors.vendors || []) {
    for (const field of ['name', 'status', 'owner', 'contractReview', 'dpaReview', 'exitPlan', 'nextAction']) {
        if (typeof vendor[field] !== 'string' || !vendor[field].trim()) failures.push(`${vendor.id} lacks ${field}`);
    }
    if (!Array.isArray(vendor.purpose) || vendor.purpose.length === 0) failures.push(`${vendor.id} lacks purpose`);
    if (!Array.isArray(vendor.data) || vendor.data.length === 0) failures.push(`${vendor.id} lacks data categories`);
    if (!Array.isArray(vendor.evidence) || vendor.evidence.length === 0) failures.push(`${vendor.id} lacks evidence`);
    if (vendor.owner.toLowerCase().includes('unassigned')) warnings.push(`${vendor.id} has no fully assigned owner`);
    const active = vendor.status.includes('active') || vendor.status.includes('activation');
    if (active && (!vendor.retentionVerified || !vendor.spendControlsVerified)) {
        warnings.push(`${vendor.id} is active/activation-indicated with unverified retention or spend controls`);
    }
}

const severityRank = { low: 1, medium: 2, high: 3, critical: 4 };
for (const risk of risks.risks || []) {
    for (const field of ['title', 'severity', 'status', 'owner', 'cause', 'consequence', 'nextAction', 'due', 'reviewCadence']) {
        if (typeof risk[field] !== 'string' || !risk[field].trim()) failures.push(`${risk.id} lacks ${field}`);
    }
    if (!severityRank[risk.severity]) failures.push(`${risk.id} has invalid severity ${risk.severity}`);
    if (!Array.isArray(risk.controls) || risk.controls.length === 0) failures.push(`${risk.id} lacks controls`);
    if (['high', 'critical'].includes(risk.severity) && risk.status === 'open' && risk.owner.toLowerCase().includes('unassigned')) {
        warnings.push(`${risk.id} is ${risk.severity}, open, and unassigned`);
    }
}

const openRisks = (risks.risks || []).filter(risk => risk.status === 'open');
const severityCounts = {};
for (const risk of openRisks) severityCounts[risk.severity] = (severityCounts[risk.severity] || 0) + 1;

console.log(JSON.stringify({
    workflow: 'A-009',
    registersValid: failures.length === 0,
    operationalReadiness: failures.length === 0 && warnings.length === 0 && openRisks.length === 0,
    vendorCount: (vendors.vendors || []).length,
    riskCount: (risks.risks || []).length,
    openRiskCount: openRisks.length,
    openRiskSeverity: severityCounts,
    failures,
    warnings,
    highestPriorityActions: openRisks
        .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
        .slice(0, 5)
        .map(risk => ({ id: risk.id, severity: risk.severity, title: risk.title, nextAction: risk.nextAction }))
}, null, 2));
if (failures.length) process.exitCode = 1;
else if (warnings.length || openRisks.length) process.exitCode = 2;
