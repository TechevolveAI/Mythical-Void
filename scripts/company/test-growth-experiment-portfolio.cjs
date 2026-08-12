#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-growth-experiment-portfolio.cjs');
const sourcePath = path.join(repositoryRoot, 'docs/company/growth/experiment-portfolio.json');
const portfolio = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a019-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', portfolio);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.portfolioValid, true);
    assert.strictEqual(baseline.output.experimentCount, 4);
    assert.strictEqual(baseline.output.executableExperimentCount, 0);
    assert.strictEqual(baseline.output.decisionReadyExperimentCount, 0);
    assert.strictEqual(baseline.output.eventCollectionEnabled, false);

    const globalAuthorization = execute('global-authorization', { ...portfolio, externalExperimentActionsAuthorized: true });
    assert.strictEqual(globalAuthorization.status, 1);
    assert(globalAuthorization.output.failures.some(failure => failure.includes('externalExperimentActionsAuthorized')));

    const externalAction = execute('external-action', {
        ...portfolio,
        experiments: portfolio.experiments.map((item, index) => index === 0 ? { ...item, externalActionAllowed: true } : item)
    });
    assert.strictEqual(externalAction.status, 1);
    assert(externalAction.output.failures.some(failure => failure.includes('externalActionAllowed')));

    const unknownClaim = execute('unknown-claim', {
        ...portfolio,
        experiments: portfolio.experiments.map((item, index) => index === 1 ? { ...item, claimIds: [...item.claimIds, 'CL-999'] } : item)
    });
    assert.strictEqual(unknownClaim.status, 1);
    assert(unknownClaim.output.failures.some(failure => failure.includes('CL-999')));

    const prematureMeasurement = execute('premature-measurement', {
        ...portfolio,
        experiments: portfolio.experiments.map((item, index) => index === 3 ? { ...item, participantDataCollectionAuthorized: true } : item)
    });
    assert.strictEqual(prematureMeasurement.status, 1);
    assert(prematureMeasurement.output.failures.some(failure => failure.includes('M1 collection')));

    const minorOutreach = execute('minor-outreach', {
        ...portfolio,
        experiments: portfolio.experiments.map((item, index) => index === 2 ? { ...item, minorDirectOutreachPermitted: true } : item)
    });
    assert.strictEqual(minorOutreach.status, 1);
    assert(minorOutreach.output.failures.some(failure => failure.includes('minor direct outreach')));

    const duplicate = execute('duplicate', {
        ...portfolio,
        experiments: portfolio.experiments.map((item, index) => index === 3 ? { ...item, id: 'E-003' } : item)
    });
    assert.strictEqual(duplicate.status, 1);
    assert(duplicate.output.failures.some(failure => failure.includes('duplicate experiment ID')));

    console.log('A-019 growth experiment portfolio evaluations passed (7 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
