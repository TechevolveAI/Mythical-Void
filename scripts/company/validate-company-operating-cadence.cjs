#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultPath = path.join(repositoryRoot, 'docs/company/automation/operating-cadence.json');
const cadencePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath;
const failures = [];

function load(file, label) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { console.error(`${label} could not be read: ${error.message}`); process.exit(1); }
}
function exactSet(actual, expected, label) {
    if (!Array.isArray(actual) || actual.length !== expected.length || expected.some(value => !actual.includes(value))) failures.push(`${label} must be exactly ${expected.join(', ')}`);
}
function allFalse(object, fields, label) {
    for (const field of fields) if (object?.[field] !== false) failures.push(`${label}.${field} must remain false`);
}

const cadence = load(cadencePath, 'Operating cadence');
const registry = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const protectedRuntime = load(path.join(repositoryRoot, 'docs/company/automation/protected-runtime.json'), 'Protected runtime');
const risks = load(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register').risks || [];
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set(risks.map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));

if (cadence.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(cadence.asOf || '')) failures.push('asOf must be an ISO date');
if (cadence.status !== 'cadence_contract_ready_scheduler_gated') failures.push('status must remain cadence_contract_ready_scheduler_gated');
if (typeof cadence.purpose !== 'string' || cadence.purpose.length < 100) failures.push('purpose is incomplete');
exactSet(cadence.decisionRefs, ['D-014', 'D-017'], 'decisionRefs');
exactSet(cadence.riskRefs, ['R-011', 'R-012', 'R-013'], 'riskRefs');
exactSet(cadence.workflowRefs, ['A-002', 'A-012', 'A-015', 'A-016', 'A-017', 'A-023', 'A-030', 'A-031', 'A-036', 'A-038', 'A-039', 'A-040'], 'workflowRefs');
for (const id of cadence.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);
for (const id of cadence.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of cadence.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);

allFalse(cadence.authority, ['schedulerActivationAuthorized', 'triggerActivationAuthorized', 'runtimeProvisioningAuthorized', 'historyPersistenceAuthorized', 'alertDeliveryAuthorized', 'automatedDispatchAuthorized', 'repositoryWriteAuthorized', 'credentialUseAuthorized', 'networkAccessAuthorized', 'spendAuthorized', 'externalActionAuthorized', 'conversationIsAuthorization'], 'authority');

const people = cadence.people || {};
for (const role of ['schedulerOwner', 'backupOperator', 'urgentExceptionRecipient', 'killSwitchOperator']) if (people[role]?.status !== 'unassigned' || people[role]?.personOrRoleRef !== null || people[role]?.acceptanceRecorded !== false) failures.push(`people.${role} must remain unassigned and unaccepted`);
allFalse(people, ['ownerBackupSeparated', 'rolesApproved'], 'people');

const clock = cadence.clockPolicy || {};
if (clock.ianaTimezone !== 'Europe/Dublin' || clock.wallClockSchedule !== true || clock.dayOfWeekConvention !== '0_sunday_through_6_saturday') failures.push('clock policy timezone or convention is invalid');
if (clock.dstSpringGapPolicy !== 'skip_and_alert_no_automatic_catch_up' || clock.dstAutumnRepeatPolicy !== 'run_once_using_idempotency_key' || clock.missedRunPolicy !== 'do_not_catch_up_without_human_review') failures.push('clock policy DST or missed-run behavior is invalid');
if (clock.maximumClockSkewSeconds !== 60 || clock.timeSourceConfigured !== false || clock.clockDriftTestPassed !== false) failures.push('clock source and drift controls must remain unconfigured');

const resources = cadence.resourceEnvelope || {};
for (const [field, expected] of Object.entries({ maximumConcurrentRuns: 1, maximumRunsPerDay: 4, maximumRunSeconds: 120, maximumOutputBytes: 5242880, retryCount: 0, maximumPlannedExecutionsInAnyCalendarMonth: 38, minimumMinutesBetweenPlannedStarts: 60, spendMinorUnitsPerRun: 0, spendMinorUnitsPerDay: 0, spendMinorUnitsPerMonth: 0 })) if (resources[field] !== expected) failures.push(`resourceEnvelope.${field} must be ${expected}`);
for (const field of ['failClosedOnTimeout', 'failClosedOnOverlap', 'failClosedOnStaleConfiguration', 'failClosedOnUnknownCommand']) if (resources[field] !== true) failures.push(`resourceEnvelope.${field} must be true`);
if (protectedRuntime.execution?.maximumConcurrentRuns !== 1 || protectedRuntime.execution?.maximumRunsPerDay !== 4 || protectedRuntime.execution?.maximumRunSeconds !== 120 || protectedRuntime.execution?.retryCount !== 0) failures.push('cadence resource envelope must remain bounded by A-031');

const schedules = cadence.calendarSchedules || [];
exactSet(schedules.map(item => item.id), ['OC-001', 'OC-002', 'OC-003', 'OC-004'], 'calendar schedule IDs');
const expectedSchedules = {
    'OC-001': { workflowId: 'A-012', command: ['scripts/company/run-company-control-plane.cjs'], days: [1, 2, 3, 4, 5], time: '09:00', network: 'none' },
    'OC-002': { workflowId: 'A-012', command: ['scripts/company/run-company-control-plane.cjs', '--verify'], days: [1], time: '08:00', network: 'none' },
    'OC-003': { workflowId: 'A-015', command: ['scripts/company/detect-company-control-plane-changes.cjs'], days: [5], time: '08:00', network: 'public_read_via_nested_A-001_only' },
    'OC-004': { workflowId: 'A-002', command: ['scripts/company/compile-weekly-review.cjs'], days: [5], time: '10:00', network: 'none' }
};
for (const schedule of schedules) {
    const expected = expectedSchedules[schedule.id];
    if (!expected || schedule.workflowId !== expected.workflowId || JSON.stringify(schedule.command) !== JSON.stringify(expected.command) || JSON.stringify(schedule.recurrence?.daysOfWeek) !== JSON.stringify(expected.days) || schedule.recurrence?.kind !== 'selected_weekdays' || schedule.recurrence?.localTime !== expected.time || schedule.networkMode !== expected.network) failures.push(`${schedule.id || 'schedule'} cadence or command is invalid`);
    const scriptPath = schedule.command?.[0] ? path.join(repositoryRoot, schedule.command[0]) : null;
    if (!scriptPath || !fs.existsSync(scriptPath) || !scriptPath.startsWith(path.join(repositoryRoot, 'scripts/company'))) failures.push(`${schedule.id || 'schedule'} command is missing or outside company scripts`);
    if (schedule.state !== 'planned_disabled' || schedule.activationGateSatisfied !== false || JSON.stringify(schedule.expectedExitCodes) !== JSON.stringify([0, 2]) || schedule.maximumRunsPerOccurrence !== 1 || schedule.timeoutSeconds !== 120 || schedule.retryCount !== 0 || schedule.spendMinorUnits !== 0) failures.push(`${schedule.id || 'schedule'} must remain a bounded disabled plan`);
    allFalse(schedule, ['mayWrite', 'mayUseCredentials', 'mayCauseExternalAction'], schedule.id || 'schedule');
}

const triggers = cadence.eventTriggerPlans || [];
exactSet(triggers.map(item => item.id), ['OT-001', 'OT-002', 'OT-003', 'OT-004'], 'event trigger IDs');
exactSet(triggers.map(item => item.workflowId), ['A-012', 'A-016', 'A-017', 'A-030'], 'event trigger workflow IDs');
const expectedTriggers = {
    'OT-001': { workflowId: 'A-012', command: ['scripts/company/run-company-control-plane.cjs', '--verify'], inputKind: 'none', sourceWorkflowId: null },
    'OT-002': { workflowId: 'A-016', command: ['scripts/company/build-company-run-record.cjs', '--input', '{protected_trigger_payload_path}'], inputKind: 'protected_prior_workflow_output', sourceWorkflowId: 'A-015' },
    'OT-003': { workflowId: 'A-017', command: ['scripts/company/propose-control-plane-baseline-update.cjs', '--input', '{protected_trigger_payload_path}'], inputKind: 'protected_prior_workflow_output', sourceWorkflowId: 'A-015' },
    'OT-004': { workflowId: 'A-030', command: ['scripts/company/run-internal-shadow-cycle.cjs'], inputKind: 'none', sourceWorkflowId: null }
};
for (const trigger of triggers) {
    const expected = expectedTriggers[trigger.id];
    if (!expected || trigger.workflowId !== expected.workflowId || JSON.stringify(trigger.command) !== JSON.stringify(expected.command)) failures.push(`${trigger.id || 'trigger'} workflow or command template is invalid`);
    if (trigger.state !== 'planned_disabled_manual_review_required' || trigger.automaticInvocationPermitted !== false || typeof trigger.event !== 'string' || trigger.event.length < 55) failures.push(`${trigger.id || 'trigger'} must remain disabled and human-reviewed`);
    if (trigger.networkMode !== 'none' || JSON.stringify(trigger.expectedExitCodes) !== JSON.stringify([0, 2]) || trigger.timeoutSeconds !== 120 || trigger.retryCount !== 0 || trigger.spendMinorUnits !== 0) failures.push(`${trigger.id || 'trigger'} must remain a bounded no-network trigger template`);
    allFalse(trigger, ['mayWrite', 'mayUseCredentials', 'mayCauseExternalAction'], trigger.id || 'trigger');
    const binding = trigger.inputBinding || {};
    if (binding.kind !== expected?.inputKind || binding.sourceWorkflowId !== expected?.sourceWorkflowId || binding.bindingConfigured !== false) failures.push(`${trigger.id || 'trigger'} input binding is invalid or prematurely configured`);
    const protectedBinding = expected?.inputKind === 'protected_prior_workflow_output';
    if (binding.sourceOutputDigestRequired !== protectedBinding || binding.protectedPayloadPathRequired !== protectedBinding) failures.push(`${trigger.id || 'trigger'} protected input digest/path boundary is invalid`);
}

const idempotency = cadence.idempotencyAndOverlap || {};
if (idempotency.idempotencyKeyPattern !== 'workflow_version_config_digest_local_window' || idempotency.contentDigestRequired !== true || idempotency.leaseOrLockRequired !== true || idempotency.duplicateRunAction !== 'suppress_and_record_metadata_only' || idempotency.overlapAction !== 'fail_closed_and_raise_exception_after_route_exists') failures.push('idempotency and overlap design is invalid');
if (idempotency.leaseProvider !== null || idempotency.lockTimeoutSeconds !== null) failures.push('lease provider and timeout must remain unselected');
allFalse(idempotency, ['lateCompletionStartsNextRun', 'partialRunCountsAsSuccess', 'idempotencyTestPassed', 'concurrencyTestPassed'], 'idempotencyAndOverlap');

const stale = cadence.staleAndFailurePolicy || {};
if (stale.configurationDigestPinned !== true || stale.maximumConfigurationAgeHours !== null || stale.staleConfigurationAction !== 'fail_closed' || stale.historyUnavailableAction !== 'fail_closed' || stale.unknownExitCodeAction !== 'broken_control' || stale.automaticRetryPermitted !== false || stale.automaticBackfillPermitted !== false || stale.failurePolicyApproved !== false || stale.failurePolicyTested !== false) failures.push('stale and failure policy must remain fail-closed and unapproved');

const history = cadence.historyAndAlerts || {};
allFalse(history, ['protectedHistoryConfigured', 'rawOutputPersistencePermitted', 'sensitivePayloadPersistencePermitted', 'backupAndRestoreTestPassed', 'authenticatedAlertRouteConfigured', 'unchangedStatusAlertPermitted', 'alertDeduplicationTestPassed', 'deliveryFailureTestPassed'], 'historyAndAlerts');
if (history.compactOutcomeAndDigestRequired !== true || history.retentionDays !== null || history.highAndCriticalOnly !== true) failures.push('history and alert boundary is invalid');

const simulationRun = spawnSync(process.execPath, [path.join(repositoryRoot, 'scripts/company/simulate-company-operating-cadence.cjs'), cadencePath], { cwd: repositoryRoot, encoding: 'utf8' });
let simulation = null;
try { simulation = JSON.parse(simulationRun.stdout); } catch { failures.push('reference cadence simulation could not be parsed'); }
const reference = cadence.referenceSimulation || {};
for (const [field, expected] of Object.entries({ windowStartLocalDate: '2026-09-01', windowEndExclusiveLocalDate: '2026-10-01', calendarDayCount: 30, plannedOccurrenceCount: 34, maximumOccurrencesOnOneDay: 3, sameStartCollisionCount: 0, minimumObservedMinutesBetweenStartsOnSameDay: 60, withinDailyRunLimit: true, withinMonthlyRunLimit: true, simulationActivatesSchedule: false })) if (reference[field] !== expected) failures.push(`referenceSimulation.${field} must be ${expected}`);
if (!simulation || simulation.simulationValid !== true || simulationRun.status !== 0) failures.push('reference simulation must pass without activation');

const gates = cadence.activationGates || [];
exactSet(gates.map(item => item.id), Array.from({ length: 18 }, (_, index) => `OC-G${String(index + 1).padStart(2, '0')}`), 'activation gate IDs');
for (const gate of gates) if (gate.satisfied !== false || typeof gate.gate !== 'string' || gate.gate.length < 70) failures.push(`${gate.id || 'gate'} must remain unsatisfied and complete`);
const inputs = cadence.kevinInputBrief || [];
exactSet(inputs.map(item => item.id), Array.from({ length: 5 }, (_, index) => `OCI-${String(index + 1).padStart(3, '0')}`), 'Kevin input brief IDs');
for (const item of inputs) if (item.provided !== false || typeof item.input !== 'string' || item.input.length < 90) failures.push(`${item.id || 'input'} must remain unprovided and complete`);

if (cadence.inputBriefReadyForKevinReview !== true || cadence.simulationValid !== true) failures.push('input brief and simulation must be ready');
for (const [field, expected] of Object.entries({ providedKevinInputCount: 0, calendarScheduleCount: 4, enabledCalendarScheduleCount: 0, eventTriggerPlanCount: 4, enabledEventTriggerCount: 0, satisfiedActivationGateCount: 0 })) if (cadence[field] !== expected) failures.push(`${field} must be ${expected}`);
for (const field of ['schedulerConfigured', 'schedulerEnabled', 'protectedHistoryReady', 'authenticatedAlertingReady', 'cadenceActivationReady', 'runtimePromotionEligible', 'externalActionAuthorized']) if (cadence[field] !== false) failures.push(`${field} must remain false`);
if (typeof cadence.nextDecision !== 'string' || cadence.nextDecision.length < 120 || !cadence.nextDecision.includes('does not authorize')) failures.push('nextDecision must preserve the non-authorizing scheduler boundary');

console.log(JSON.stringify({
    workflow: 'A-041',
    mode: 'bounded company operating cadence assurance and simulation; no scheduler, trigger, history, alert, network, dispatch, spend, or execution',
    cadenceContractValid: failures.length === 0,
    inputBriefReadyForKevinReview: cadence.inputBriefReadyForKevinReview,
    kevinInputBriefItemCount: inputs.length,
    providedKevinInputCount: inputs.filter(item => item.provided === true).length,
    calendarScheduleCount: schedules.length,
    enabledCalendarScheduleCount: schedules.filter(item => item.state !== 'planned_disabled').length,
    eventTriggerPlanCount: triggers.length,
    enabledEventTriggerCount: triggers.filter(item => item.automaticInvocationPermitted === true).length,
    protectedTriggerInputBindingCount: triggers.filter(item => item.inputBinding?.kind === 'protected_prior_workflow_output').length,
    configuredTriggerInputBindingCount: triggers.filter(item => item.inputBinding?.bindingConfigured === true).length,
    simulatedCalendarDayCount: simulation?.calendarDayCount ?? null,
    simulatedPlannedOccurrenceCount: simulation?.plannedOccurrenceCount ?? null,
    simulatedMaximumOccurrencesOnOneDay: simulation?.maximumOccurrencesOnOneDay ?? null,
    simulatedSameStartCollisionCount: simulation?.sameStartCollisionCount ?? null,
    simulatedMinimumMinutesBetweenStarts: simulation?.minimumObservedMinutesBetweenStartsOnSameDay ?? null,
    simulationWithinDailyLimit: simulation?.withinDailyRunLimit ?? false,
    simulationWithinMonthlyLimit: simulation?.withinMonthlyRunLimit ?? false,
    activationGateCount: gates.length,
    satisfiedActivationGateCount: gates.filter(item => item.satisfied === true).length,
    schedulerConfigured: cadence.schedulerConfigured,
    schedulerEnabled: cadence.schedulerEnabled,
    protectedHistoryReady: cadence.protectedHistoryReady,
    authenticatedAlertingReady: cadence.authenticatedAlertingReady,
    cadenceActivationReady: cadence.cadenceActivationReady,
    runtimePromotionEligible: cadence.runtimePromotionEligible,
    externalActionAuthorized: cadence.externalActionAuthorized,
    failures,
    nextAction: cadence.nextDecision
}, null, 2));

process.exit(failures.length ? 1 : 2);
