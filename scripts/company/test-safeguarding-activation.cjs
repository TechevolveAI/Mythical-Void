#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validator = path.join(repositoryRoot, 'scripts/company/validate-safeguarding-activation.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/safeguarding-activation.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-safeguarding-activation-'));

function execute(name, value) {
    const file = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
    const result = spawnSync(process.execPath, [validator, file], { cwd: repositoryRoot, encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.safeguardingContractValid, true);
    assert.strictEqual(baseline.output.syntheticCaseCount, 17);
    assert.strictEqual(baseline.output.requiredExerciseCount, 10);
    assert.strictEqual(baseline.output.activationGateCount, 16);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);

    const authority = execute('authority', { ...source, authority: { ...source.authority, inboxAccessAuthorized: true } });
    assert.strictEqual(authority.status, 1);
    assert(authority.output.failures.some(item => item.includes('inboxAccessAuthorized')));

    const minorContact = execute('minor-contact', { ...source, operatingBoundary: { ...source.operatingBoundary, directMinorContactPermitted: true } });
    assert.strictEqual(minorContact.status, 1);
    assert(minorContact.output.failures.some(item => item.includes('directMinorContactPermitted')));

    const emergencyDecision = execute('emergency-decision', { ...source, operatingBoundary: { ...source.operatingBoundary, agentMayContactEmergencyServices: true } });
    assert.strictEqual(emergencyDecision.status, 1);
    assert(emergencyDecision.output.failures.some(item => item.includes('agentMayContactEmergencyServices')));

    const primary = execute('primary', { ...source, humanCoverage: { ...source.humanCoverage, primary: { ...source.humanCoverage.primary, status: 'assigned', accountablePersonRef: 'PERSON-001' } } });
    assert.strictEqual(primary.status, 1);
    assert(primary.output.failures.some(item => item.includes('primary')));

    const geography = execute('geography', { ...source, humanCoverage: { ...source.humanCoverage, geographicScope: ['Ireland'] } });
    assert.strictEqual(geography.status, 1);
    assert(geography.output.failures.some(item => item.includes('geography')));

    const target = execute('target', { ...source, responseTargets: { ...source.responseTargets, q0HumanAcknowledgementMinutes: 15 } });
    assert.strictEqual(target.status, 1);
    assert(target.output.failures.some(item => item.includes('q0HumanAcknowledgementMinutes')));

    const route = execute('route', { ...source, protectedRoutesAndRecords: { ...source.protectedRoutesAndRecords, urgentRouteConfigured: true } });
    assert.strictEqual(route.status, 1);
    assert(route.output.failures.some(item => item.includes('urgentRouteConfigured')));

    const routeValue = execute('route-value', { ...source, protectedRoutesAndRecords: { ...source.protectedRoutesAndRecords, urgentRouteValueStoredHere: true } });
    assert.strictEqual(routeValue.status, 1);
    assert(routeValue.output.failures.some(item => item.includes('urgentRouteValueStoredHere')));

    const professional = execute('professional', { ...source, professionalReview: { ...source.professionalReview, reviewCompleted: true } });
    assert.strictEqual(professional.status, 1);
    assert(professional.output.failures.some(item => item.includes('reviewCompleted')));

    const synthetic = execute('synthetic', { ...source, currentSyntheticEvidence: { ...source.currentSyntheticEvidence, openWorldSafetyProven: true } });
    assert.strictEqual(synthetic.status, 1);
    assert(synthetic.output.failures.some(item => item.includes('openWorldSafetyProven')));

    const exercise = execute('exercise', { ...source, requiredExercises: source.requiredExercises.map(item => item.id === 'SGX-001' ? { ...item, status: 'passed', passed: true } : item) });
    assert.strictEqual(exercise.status, 1);
    assert(exercise.output.failures.some(item => item.includes('SGX-001')));

    const gate = execute('gate', { ...source, activationGates: source.activationGates.map(item => item.id === 'SG-G01' ? { ...item, satisfied: true } : item) });
    assert.strictEqual(gate.status, 1);
    assert(gate.output.failures.some(item => item.includes('SG-G01')));

    const dependency = execute('dependency', { ...source, downstreamDependencies: source.downstreamDependencies.map(item => item.id === 'SGD-001' ? { ...item, ready: true } : item) });
    assert.strictEqual(dependency.status, 1);
    assert(dependency.output.failures.some(item => item.includes('SGD-001')));

    const input = execute('input', { ...source, kevinInputBrief: source.kevinInputBrief.map(item => item.id === 'SGI-001' ? { ...item, provided: true } : item) });
    assert.strictEqual(input.status, 1);
    assert(input.output.failures.some(item => item.includes('SGI-001')));

    const coverage = execute('coverage', { ...source, coverageReady: true });
    assert.strictEqual(coverage.status, 1);
    assert(coverage.output.failures.some(item => item.includes('coverageReady')));

    const activation = execute('activation', { ...source, activationReady: true });
    assert.strictEqual(activation.status, 1);
    assert(activation.output.failures.some(item => item.includes('activationReady')));

    const external = execute('external', { ...source, externalActionAuthorized: true });
    assert.strictEqual(external.status, 1);
    assert(external.output.failures.some(item => item.includes('externalActionAuthorized')));

    const sensitive = execute('sensitive', { ...source, protectedRoutesAndRecords: { ...source.protectedRoutesAndRecords, urgentRouteReference: 'urgent@example.com' } });
    assert.strictEqual(sensitive.status, 1);
    assert(sensitive.output.failures.some(item => item.includes('must not contain')));

    console.log('A-039 safeguarding activation evaluations passed (19 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
