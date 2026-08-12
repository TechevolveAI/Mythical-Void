#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-commercial-qualification.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/commercial/qualification.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a032-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

function updateAssessment(id, changes) {
    return { ...source, assessments: source.assessments.map(item => item.opportunityRef === id ? { ...item, ...changes(item) } : item) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.commercialQualificationValid, true);
    assert.strictEqual(baseline.output.portfolioDecisionReady, true);
    assert.strictEqual(baseline.output.opportunityCount, 4);
    assert.strictEqual(baseline.output.qualifiedOpportunityCount, 0);
    assert.strictEqual(baseline.output.technicalFeasibilityPriorityCount, 1);
    assert.deepStrictEqual(baseline.output.internalSequence, ['OP-001', 'OP-004', 'OP-002', 'OP-003']);
    assert.strictEqual(baseline.output.reviewedDimensionCount, 40);
    assert.strictEqual(baseline.output.disqualifierReviewCount, 32);
    assert.strictEqual(baseline.output.triggeredDisqualifierCount, 0);
    assert.strictEqual(baseline.output.contactRecordCount, 0);
    assert.strictEqual(baseline.output.outreachPackageCount, 0);
    assert.strictEqual(baseline.output.financialAssumptionValueCount, 0);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);

    const externalAuthority = execute('external-authority', { ...source, authority: { ...source.authority, outreachSendingAuthorized: true } });
    assert.strictEqual(externalAuthority.status, 1);
    assert(externalAuthority.output.failures.some(failure => failure.includes('outreachSendingAuthorized')));

    const contact = execute('contact', updateAssessment('OP-001', () => ({ contact: { email: 'person@example.com' } })));
    assert.strictEqual(contact.status, 1);
    assert(contact.output.failures.some(failure => failure.includes('contact must remain null')));

    const revenue = execute('revenue', updateAssessment('OP-001', item => ({ financialAssumptions: { ...item.financialAssumptions, revenueMinorUnits: 1000 } })));
    assert.strictEqual(revenue.status, 1);
    assert(revenue.output.failures.some(failure => failure.includes('revenueMinorUnits')));

    const prematureQualification = execute('premature-qualification', updateAssessment('OP-001', () => ({ assessmentStatus: 'qualified' })));
    assert.strictEqual(prematureQualification.status, 1);
    assert(prematureQualification.output.failures.some(failure => failure.includes('researched_not_qualified')));

    const stageChange = execute('stage-change', updateAssessment('OP-001', () => ({ stageChangeAuthorized: true })));
    assert.strictEqual(stageChange.status, 1);
    assert(stageChange.output.failures.some(failure => failure.includes('stage/external authority')));

    const missingDimension = execute('missing-dimension', updateAssessment('OP-001', item => {
        const dimensions = { ...item.dimensions };
        delete dimensions.reachQuality;
        return { dimensions };
    }));
    assert.strictEqual(missingDimension.status, 1);
    assert(missingDimension.output.failures.some(failure => failure.includes('dimensions')));

    const duplicateRank = execute('duplicate-rank', updateAssessment('OP-004', () => ({ sequenceRank: 1 })));
    assert.strictEqual(duplicateRank.status, 1);
    assert(duplicateRank.output.failures.some(failure => failure.includes('duplicate sequenceRank')));

    const unknownOpportunity = execute('unknown-opportunity', { ...source, assessments: source.assessments.map((item, index) => index === 0 ? { ...item, opportunityRef: 'OP-999' } : item) });
    assert.strictEqual(unknownOpportunity.status, 1);
    assert(unknownOpportunity.output.failures.some(failure => failure.includes('unknown opportunity')));

    const unsupportedClearance = execute('unsupported-clearance', updateAssessment('OP-001', item => ({ disqualifierReview: item.disqualifierReview.map((entry, index) => index === 0 ? { ...entry, state: 'cleared_with_evidence' } : entry) })));
    assert.strictEqual(unsupportedClearance.status, 1);
    assert(unsupportedClearance.output.failures.some(failure => failure.includes('cleared without evidence')));

    const triggeredButProceed = execute('triggered-but-proceed', updateAssessment('OP-001', item => ({ disqualifierReview: item.disqualifierReview.map((entry, index) => index === 0 ? { ...entry, state: 'triggered' } : entry) })));
    assert.strictEqual(triggeredButProceed.status, 1);
    assert(triggeredButProceed.output.failures.some(failure => failure.includes('triggered disqualifier')));

    const minorTargeting = execute('minor-targeting', { ...source, authority: { ...source.authority, minorTargetingPermitted: true } });
    assert.strictEqual(minorTargeting.status, 1);
    assert(minorTargeting.output.failures.some(failure => failure.includes('minorTargetingPermitted')));

    const outreachPackage = execute('outreach-package', updateAssessment('OP-001', () => ({ outreachPackage: { subject: 'Hello' } })));
    assert.strictEqual(outreachPackage.status, 1);
    assert(outreachPackage.output.failures.some(failure => failure.includes('outreachPackage must remain null')));

    console.log('A-032 commercial-qualification evaluations passed (13 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

