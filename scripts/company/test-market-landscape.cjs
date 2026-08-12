#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-market-landscape.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/research/market-landscape-2026-08-11.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a028-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

function replaceReference(id, changes) {
    return source.references.map(reference => reference.id === id ? { ...reference, ...changes(reference) } : reference);
}

function replaceHypothesis(id, changes) {
    return source.hypotheses.map(hypothesis => hypothesis.id === id ? { ...hypothesis, ...changes(hypothesis) } : hypothesis);
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.marketLandscapeValid, true);
    assert.strictEqual(baseline.output.categoryCount, 5);
    assert.strictEqual(baseline.output.sourceCount, 10);
    assert.strictEqual(baseline.output.firstPartySourceCount, 10);
    assert.strictEqual(baseline.output.referenceCount, 10);
    assert.strictEqual(baseline.output.hypothesisCount, 6);
    assert.strictEqual(baseline.output.validatedHypothesisCount, 0);
    assert.strictEqual(baseline.output.acceptedCustomerEvidenceCount, 0);

    const outreach = execute('outreach', { ...source, authority: { ...source.authority, outreachAuthorized: true } });
    assert.strictEqual(outreach.status, 1);
    assert(outreach.output.failures.some(failure => failure.includes('outreachAuthorized')));

    const marketSizing = execute('market-sizing', { ...source, evidencePolicy: { ...source.evidencePolicy, marketSizingPermitted: true } });
    assert.strictEqual(marketSizing.status, 1);
    assert(marketSizing.output.failures.some(failure => failure.includes('marketSizingPermitted')));

    const simulatedCustomers = execute('simulated-customers', { ...source, evidencePolicy: { ...source.evidencePolicy, generatedPersonasCountAsCustomers: true } });
    assert.strictEqual(simulatedCustomers.status, 1);
    assert(simulatedCustomers.output.failures.some(failure => failure.includes('generatedPersonasCountAsCustomers')));

    const thirdPartySource = execute('third-party-source', {
        ...source,
        sources: source.sources.map((item, index) => index === 0 ? { ...item, firstParty: false } : item)
    });
    assert.strictEqual(thirdPartySource.status, 1);
    assert(thirdPartySource.output.failures.some(failure => failure.includes('first-party source')));

    const unknownSource = execute('unknown-source', {
        ...source,
        references: replaceReference('MR-001', reference => ({ sourceIds: [...reference.sourceIds, 'MS-999'] }))
    });
    assert.strictEqual(unknownSource.status, 1);
    assert(unknownSource.output.failures.some(failure => failure.includes('MS-999')));

    const inventedUsers = execute('invented-users', {
        ...source,
        references: replaceReference('MR-002', () => ({ estimatedUsers: 1000000 }))
    });
    assert.strictEqual(inventedUsers.status, 1);
    assert(inventedUsers.output.failures.some(failure => failure.includes('estimatedUsers')));

    const prematureValidation = execute('premature-validation', {
        ...source,
        hypotheses: replaceHypothesis('MH-001', () => ({ status: 'validated' }))
    });
    assert.strictEqual(prematureValidation.status, 1);
    assert(prematureValidation.output.failures.some(failure => failure.includes('MH-001.status')));

    const missingFalsifier = execute('missing-falsifier', {
        ...source,
        hypotheses: replaceHypothesis('MH-002', () => ({ falsifier: '' }))
    });
    assert.strictEqual(missingFalsifier.status, 1);
    assert(missingFalsifier.output.failures.some(failure => failure.includes('lacks falsifier')));

    const publicComparison = execute('public-comparison', {
        ...source,
        authority: { ...source.authority, publicComparisonAuthorized: true }
    });
    assert.strictEqual(publicComparison.status, 1);
    assert(publicComparison.output.failures.some(failure => failure.includes('publicComparisonAuthorized')));

    console.log('A-028 market-landscape evaluations passed (10 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

