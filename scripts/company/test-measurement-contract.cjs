#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validatorPath = path.join(__dirname, 'validate-measurement-contract.cjs');
const contractPath = path.join(repositoryRoot, 'docs', 'company', 'measurement', 'event-contract.json');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a006-'));

function execute(name, value) {
    const target = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(target, JSON.stringify(value));
    const result = spawnSync(process.execPath, [validatorPath, target], { encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', contract);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.contractValid, true);
    assert.strictEqual(baseline.output.productionCollectionAuthorized, false);
    assert.strictEqual(baseline.output.collectionEnabled, false);

    const enabled = execute('enabled', { ...contract, collectionEnabled: true });
    assert.strictEqual(enabled.status, 1);
    assert(enabled.output.failures.some(failure => failure.includes('collectionEnabled')));

    const identifier = execute('identifier', {
        ...contract,
        events: contract.events.map(event => event.name === 'hatch_completed'
            ? { ...event, properties: [...event.properties, 'user_id'] }
            : event)
    });
    assert.strictEqual(identifier.status, 1);
    assert(identifier.output.failures.some(failure => failure.includes('user_id')));

    const longitudinal = execute('longitudinal', {
        ...contract,
        events: contract.events.map(event => event.name === 'return_session_started'
            ? { ...event, mode: 'M1', properties: ['schema_version'] }
            : event)
    });
    assert.strictEqual(longitudinal.status, 1);
    assert(longitudinal.output.failures.some(failure => failure.includes('return_session_started')));

    console.log('A-006 measurement-contract evaluations passed (4 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
