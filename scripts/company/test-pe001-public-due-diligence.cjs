#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validator = path.join(repositoryRoot, 'scripts/company/validate-pe001-public-due-diligence.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/pe001-public-due-diligence.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-pe001-diligence-'));

function execute(name, value) {
    const file = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
    const result = spawnSync(process.execPath, [validator, file], { cwd: repositoryRoot, encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.dueDiligenceValid, true);
    assert.strictEqual(baseline.output.officialSourceCount, 17);
    assert.strictEqual(baseline.output.configurationVerifiedRequirementCount, 0);
    assert.strictEqual(baseline.output.satisfiedAccountAndHumanGateCount, 0);

    const authority = execute('authority', { ...source, authority: { ...source.authority, accountReviewAuthorized: true } });
    assert.strictEqual(authority.status, 1);
    assert(authority.output.failures.some(item => item.includes('accountReviewAuthorized')));

    const selection = execute('selection', { ...source, providerSelected: true });
    assert.strictEqual(selection.status, 1);
    assert(selection.output.failures.some(item => item.includes('providerSelected')));

    const ready = execute('ready', { ...source, accountScopedReviewReady: true });
    assert.strictEqual(ready.status, 1);
    assert(ready.output.failures.some(item => item.includes('accountScopedReviewReady')));

    const nonOfficial = execute('non-official', { ...source, sources: source.sources.map(item => item.id === 'GCP-001' ? { ...item, url: 'https://example.com/run' } : item) });
    assert.strictEqual(nonOfficial.status, 1);
    assert(nonOfficial.output.failures.some(item => item.includes('official Google Cloud')));

    const duplicateAssessment = execute('duplicate-assessment', { ...source, publicRequirementAssessments: [...source.publicRequirementAssessments.slice(0, -1), source.publicRequirementAssessments[0]] });
    assert.strictEqual(duplicateAssessment.status, 1);
    assert(duplicateAssessment.output.failures.some(item => item.includes('public requirement assessments')));

    const unknownRequirement = execute('unknown-requirement', { ...source, publicRequirementAssessments: source.publicRequirementAssessments.map(item => item.requirementId === 'PC-012' ? { ...item, requirementId: 'PC-999' } : item) });
    assert.strictEqual(unknownRequirement.status, 1);
    assert(unknownRequirement.output.failures.some(item => item.includes('public requirement assessments')));

    const unsupportedSource = execute('unsupported-source', { ...source, publicRequirementAssessments: source.publicRequirementAssessments.map(item => item.requirementId === 'PC-001' ? { ...item, sourceRefs: ['GCP-002'] } : item) });
    assert.strictEqual(unsupportedSource.status, 1);
    assert(unsupportedSource.output.failures.some(item => item.includes('unsupported sourceRef')));

    const fakeConfiguration = execute('fake-configuration', { ...source, publicRequirementAssessments: source.publicRequirementAssessments.map(item => item.requirementId === 'PC-004' ? { ...item, configurationVerified: true } : item) });
    assert.strictEqual(fakeConfiguration.status, 1);
    assert(fakeConfiguration.output.failures.some(item => item.includes('configuration or test evidence')));

    const ireland = execute('ireland', { ...source, regionalAndPrivacyReview: { ...source.regionalAndPrivacyReview, irelandCloudRunRegionListed: true } });
    assert.strictEqual(ireland.status, 1);
    assert(ireland.output.failures.some(item => item.includes('Irish region')));

    const region = execute('region', { ...source, regionalAndPrivacyReview: { ...source.regionalAndPrivacyReview, selectedRegion: 'europe-west1' } });
    assert.strictEqual(region.status, 1);
    assert(region.output.failures.some(item => item.includes('selected region')));

    const dpa = execute('dpa', { ...source, regionalAndPrivacyReview: { ...source.regionalAndPrivacyReview, dpaAccepted: true } });
    assert.strictEqual(dpa.status, 1);
    assert(dpa.output.failures.some(item => item.includes('dpaAccepted')));

    const cost = execute('cost', { ...source, costReview: { ...source.costReview, exactAllInMonthlyCostMinorUnits: 15 } });
    assert.strictEqual(cost.status, 1);
    assert(cost.output.failures.some(item => item.includes('cost and currency')));

    const spendCap = execute('spend-cap', { ...source, costReview: { ...source.costReview, spendCapInstantaneous: true } });
    assert.strictEqual(spendCap.status, 1);
    assert(spendCap.output.failures.some(item => item.includes('spendCapInstantaneous')));

    const blueprint = execute('blueprint', { ...source, disabledReferenceBlueprint: { ...source.disabledReferenceBlueprint, configured: true } });
    assert.strictEqual(blueprint.status, 1);
    assert(blueprint.output.failures.some(item => item.includes('unselected and unconfigured')));

    const gate = execute('gate', { ...source, accountAndHumanGates: source.accountAndHumanGates.map(item => item.id === 'PE1-G01' ? { ...item, satisfied: true } : item) });
    assert.strictEqual(gate.status, 1);
    assert(gate.output.failures.some(item => item.includes('must remain unsatisfied')));

    const promotion = execute('promotion', { ...source, runtimePromotionEligible: true });
    assert.strictEqual(promotion.status, 1);
    assert(promotion.output.failures.some(item => item.includes('runtimePromotionEligible')));

    console.log('A-038 PE-001 public due-diligence evaluations passed (17 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
