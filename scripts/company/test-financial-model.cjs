#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-financial-model.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/finance/financial-model.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a022-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.modelValid, true);
    assert.strictEqual(baseline.output.financialBaselineComplete, false);
    assert.strictEqual(baseline.output.unitEconomicsReady, false);
    assert.strictEqual(baseline.output.monetizationHypothesisCount, 6);
    assert.strictEqual(baseline.output.monetizationDecisionReadyCount, 0);
    assert.strictEqual(baseline.output.verifiedCostDriverCount, 0);
    assert.strictEqual(baseline.output.externalSpendAuthorized, false);

    const inventedCash = execute('invented-cash', {
        ...source,
        actuals: { ...source.actuals, unrestrictedCashMinorUnits: 100000 }
    });
    assert.strictEqual(inventedCash.status, 1);
    assert(inventedCash.output.failures.some(failure => failure.includes('unrestrictedCashMinorUnits')));

    const spend = execute('spend', { ...source, externalSpendAuthorized: true });
    assert.strictEqual(spend.status, 1);
    assert(spend.output.failures.some(failure => failure.includes('externalSpendAuthorized')));

    const inventedPrice = execute('invented-price', {
        ...source,
        monetizationHypotheses: source.monetizationHypotheses.map((item, index) => index === 1 ? { ...item, customerPriceMinorUnits: 999 } : item)
    });
    assert.strictEqual(inventedPrice.status, 1);
    assert(inventedPrice.output.failures.some(failure => failure.includes('future price')));

    const advertising = execute('advertising', {
        ...source,
        monetizationHypotheses: source.monetizationHypotheses.map((item, index) => index === 0 ? { ...item, advertisingAuthorized: true } : item)
    });
    assert.strictEqual(advertising.status, 1);
    assert(advertising.output.failures.some(failure => failure.includes('advertisingAuthorized')));

    const unknownVendor = execute('unknown-vendor', {
        ...source,
        costDrivers: source.costDrivers.map((item, index) => index === 0 ? { ...item, vendorIds: [...item.vendorIds, 'V-999'] } : item)
    });
    assert.strictEqual(unknownVendor.status, 1);
    assert(unknownVendor.output.failures.some(failure => failure.includes('V-999')));

    const fakeRunway = execute('fake-runway', {
        ...source,
        actuals: { ...source.actuals, cashRunwayMonths: 24 }
    });
    assert.strictEqual(fakeRunway.status, 1);
    assert(fakeRunway.output.failures.some(failure => failure.includes('cashRunwayMonths')));

    console.log('A-022 financial model evaluations passed (7 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
