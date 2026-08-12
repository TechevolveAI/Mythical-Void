#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const validator = path.join(repositoryRoot, 'scripts/company/validate-company-operating-cadence.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/operating-cadence.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-operating-cadence-'));

function execute(name, value) {
    const file = path.join(temporaryDirectory, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
    const result = spawnSync(process.execPath, [validator, file], { cwd: repositoryRoot, encoding: 'utf8' });
    return { status: result.status, output: JSON.parse(result.stdout) };
}
function schedules(id, changes) { return source.calendarSchedules.map(item => item.id === id ? { ...item, ...changes } : item); }

try {
    const baseline = execute('baseline', source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.cadenceContractValid, true);
    assert.strictEqual(baseline.output.calendarScheduleCount, 4);
    assert.strictEqual(baseline.output.simulatedPlannedOccurrenceCount, 34);
    assert.strictEqual(baseline.output.simulatedMaximumOccurrencesOnOneDay, 3);
    assert.strictEqual(baseline.output.simulatedSameStartCollisionCount, 0);

    const authority = execute('authority', { ...source, authority: { ...source.authority, schedulerActivationAuthorized: true } });
    assert.strictEqual(authority.status, 1);
    assert(authority.output.failures.some(item => item.includes('schedulerActivationAuthorized')));

    const owner = execute('owner', { ...source, people: { ...source.people, schedulerOwner: { status: 'assigned', personOrRoleRef: 'PERSON-001', acceptanceRecorded: true } } });
    assert.strictEqual(owner.status, 1);
    assert(owner.output.failures.some(item => item.includes('schedulerOwner')));

    const timezone = execute('timezone', { ...source, clockPolicy: { ...source.clockPolicy, ianaTimezone: 'UTC' } });
    assert.strictEqual(timezone.status, 1);
    assert(timezone.output.failures.some(item => item.includes('timezone')));

    const timeSource = execute('time-source', { ...source, clockPolicy: { ...source.clockPolicy, timeSourceConfigured: true } });
    assert.strictEqual(timeSource.status, 1);
    assert(timeSource.output.failures.some(item => item.includes('clock source')));

    const concurrency = execute('concurrency', { ...source, resourceEnvelope: { ...source.resourceEnvelope, maximumConcurrentRuns: 2 } });
    assert.strictEqual(concurrency.status, 1);
    assert(concurrency.output.failures.some(item => item.includes('maximumConcurrentRuns')));

    const spend = execute('spend', { ...source, resourceEnvelope: { ...source.resourceEnvelope, spendMinorUnitsPerMonth: 1 } });
    assert.strictEqual(spend.status, 1);
    assert(spend.output.failures.some(item => item.includes('spendMinorUnitsPerMonth')));

    const enabled = execute('enabled', { ...source, calendarSchedules: schedules('OC-001', { state: 'enabled' }) });
    assert.strictEqual(enabled.status, 1);
    assert(enabled.output.failures.some(item => item.includes('OC-001')));

    const command = execute('command', { ...source, calendarSchedules: schedules('OC-001', { command: ['scripts/company/missing.cjs'] }) });
    assert.strictEqual(command.status, 1);
    assert(command.output.failures.some(item => item.includes('command')));

    const write = execute('write', { ...source, calendarSchedules: schedules('OC-002', { mayWrite: true }) });
    assert.strictEqual(write.status, 1);
    assert(write.output.failures.some(item => item.includes('mayWrite')));

    const credential = execute('credential', { ...source, calendarSchedules: schedules('OC-003', { mayUseCredentials: true }) });
    assert.strictEqual(credential.status, 1);
    assert(credential.output.failures.some(item => item.includes('mayUseCredentials')));

    const external = execute('external', { ...source, calendarSchedules: schedules('OC-004', { mayCauseExternalAction: true }) });
    assert.strictEqual(external.status, 1);
    assert(external.output.failures.some(item => item.includes('mayCauseExternalAction')));

    const network = execute('network', { ...source, calendarSchedules: schedules('OC-001', { networkMode: 'public_read_via_nested_A-001_only' }) });
    assert.strictEqual(network.status, 1);
    assert(network.output.failures.some(item => item.includes('cadence or command')));

    const collision = execute('collision', { ...source, calendarSchedules: schedules('OC-004', { recurrence: { ...source.calendarSchedules.find(item => item.id === 'OC-004').recurrence, localTime: '08:00' } }) });
    assert.strictEqual(collision.status, 1);
    assert(collision.output.failures.some(item => item.includes('OC-004') || item.includes('simulation')));

    const trigger = execute('trigger', { ...source, eventTriggerPlans: source.eventTriggerPlans.map(item => item.id === 'OT-001' ? { ...item, automaticInvocationPermitted: true } : item) });
    assert.strictEqual(trigger.status, 1);
    assert(trigger.output.failures.some(item => item.includes('OT-001')));

    const triggerNetwork = execute('trigger-network', { ...source, eventTriggerPlans: source.eventTriggerPlans.map(item => item.id === 'OT-002' ? { ...item, networkMode: 'public_read_via_nested_A-001_only' } : item) });
    assert.strictEqual(triggerNetwork.status, 1);
    assert(triggerNetwork.output.failures.some(item => item.includes('OT-002')));

    const triggerBinding = execute('trigger-binding', { ...source, eventTriggerPlans: source.eventTriggerPlans.map(item => item.id === 'OT-003' ? { ...item, inputBinding: { ...item.inputBinding, bindingConfigured: true } } : item) });
    assert.strictEqual(triggerBinding.status, 1);
    assert(triggerBinding.output.failures.some(item => item.includes('OT-003')));

    const lease = execute('lease', { ...source, idempotencyAndOverlap: { ...source.idempotencyAndOverlap, leaseProvider: 'provider' } });
    assert.strictEqual(lease.status, 1);
    assert(lease.output.failures.some(item => item.includes('lease provider')));

    const retry = execute('retry', { ...source, staleAndFailurePolicy: { ...source.staleAndFailurePolicy, automaticRetryPermitted: true } });
    assert.strictEqual(retry.status, 1);
    assert(retry.output.failures.some(item => item.includes('stale and failure')));

    const history = execute('history', { ...source, historyAndAlerts: { ...source.historyAndAlerts, protectedHistoryConfigured: true } });
    assert.strictEqual(history.status, 1);
    assert(history.output.failures.some(item => item.includes('protectedHistoryConfigured')));

    const simulation = execute('simulation', { ...source, referenceSimulation: { ...source.referenceSimulation, plannedOccurrenceCount: 35 } });
    assert.strictEqual(simulation.status, 1);
    assert(simulation.output.failures.some(item => item.includes('referenceSimulation') || item.includes('simulation')));

    const gate = execute('gate', { ...source, activationGates: source.activationGates.map(item => item.id === 'OC-G01' ? { ...item, satisfied: true } : item) });
    assert.strictEqual(gate.status, 1);
    assert(gate.output.failures.some(item => item.includes('OC-G01')));

    const input = execute('input', { ...source, kevinInputBrief: source.kevinInputBrief.map(item => item.id === 'OCI-001' ? { ...item, provided: true } : item) });
    assert.strictEqual(input.status, 1);
    assert(input.output.failures.some(item => item.includes('OCI-001')));

    const scheduler = execute('scheduler', { ...source, schedulerEnabled: true });
    assert.strictEqual(scheduler.status, 1);
    assert(scheduler.output.failures.some(item => item.includes('schedulerEnabled')));

    const promotion = execute('promotion', { ...source, runtimePromotionEligible: true });
    assert.strictEqual(promotion.status, 1);
    assert(promotion.output.failures.some(item => item.includes('runtimePromotionEligible')));

    console.log('A-041 company operating cadence evaluations passed (25 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
