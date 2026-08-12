#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultContractPath = path.join(repositoryRoot, 'docs/company/automation/financial-truth-close.json');
const contractPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultContractPath;
const failures = [];

function load(file, label) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

function exactSet(actual, expected, label) {
    if (!Array.isArray(actual) || actual.length !== expected.length || expected.some(value => !actual.includes(value))) failures.push(`${label} must be exactly ${expected.join(', ')}`);
}

function allFalse(object, fields, label) {
    for (const field of fields) if (object?.[field] !== false) failures.push(`${label}.${field} must remain false`);
}

function containsUnsafeValue(value) {
    if (typeof value === 'string') {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) && /\+?\d[\d\s().-]{7,}\d/.test(value)) return true;
        if (/(password|api[_ -]?key|bearer\s+[a-z0-9._-]+|private[_ -]?key|iban\s*[:=]|account\s*number\s*[:=])/i.test(value)) return true;
    }
    if (Array.isArray(value)) return value.some(containsUnsafeValue);
    if (value && typeof value === 'object') return Object.values(value).some(containsUnsafeValue);
    return false;
}

const contract = load(contractPath, 'Financial truth close contract');
const registry = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const risks = load(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risk register').risks || [];
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const workflowIds = new Set((registry.workflows || []).map(item => item.id));
const riskIds = new Set(risks.map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));

if (contract.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.asOf || '')) failures.push('asOf must be an ISO date');
if (contract.status !== 'close_contract_ready_restricted_actuals_gated') failures.push('status must remain close_contract_ready_restricted_actuals_gated');
if (typeof contract.purpose !== 'string' || contract.purpose.length < 100) failures.push('purpose is incomplete');

exactSet(contract.decisionRefs, ['D-006', 'D-013', 'D-016'], 'decisionRefs');
exactSet(contract.riskRefs, ['R-007', 'R-008', 'R-009', 'R-012', 'R-013'], 'riskRefs');
exactSet(contract.workflowRefs, ['A-009', 'A-010', 'A-011', 'A-022', 'A-025', 'A-031', 'A-032', 'A-035', 'A-038'], 'workflowRefs');
for (const id of contract.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`unknown decision ${id}`);
for (const id of contract.riskRefs || []) if (!riskIds.has(id)) failures.push(`unknown risk ${id}`);
for (const id of contract.workflowRefs || []) if (!workflowIds.has(id)) failures.push(`unknown workflow ${id}`);
const financialRisk = risks.find(item => item.id === 'R-012');
if (!financialRisk || financialRisk.severity !== 'high' || financialRisk.status !== 'open' || !financialRisk.owner.includes('unassigned')) failures.push('R-012 must remain the open high financial-baseline risk with unassigned finance ownership');

allFalse(contract.authority, [
    'accountingAccessAuthorized', 'bankingAccessAuthorized', 'billingAccessAuthorized',
    'invoiceAccessAuthorized', 'providerUsageAccessAuthorized', 'restrictedActualsImportAuthorized',
    'financialSourceWriteAuthorized', 'forecastPublicationAuthorized', 'spendApprovalAuthorized',
    'paymentExecutionAuthorized', 'pricingChangeAuthorized', 'revenueRecognitionAuthorized',
    'contractOrSubscriptionChangeAuthorized', 'externalActionAuthorized', 'conversationIsAuthorization'
], 'authority');

const boundary = contract.dataBoundary || {};
allFalse(boundary, [
    'restrictedActualValuesInSharedRepositoryPermitted', 'bankOrPaymentIdentifiersInSharedRepositoryPermitted',
    'transactionRowsInSharedRepositoryPermitted', 'invoiceOrReceiptContentsInSharedRepositoryPermitted',
    'payrollTaxInvestorOrCustomerRecordsInSharedRepositoryPermitted', 'credentialsOrRecoveryValuesInSharedRepositoryPermitted',
    'missingEvidenceMeansZero', 'freeTierMeansActualCostIsZero', 'publicPriceMeansCompanyPriceIsVerified'
], 'dataBoundary');
for (const field of ['opaqueRestrictedSourceReferencesPermitted', 'approvedAggregateOperatingOutputsPermitted', 'unknownValuesRemainNull']) if (boundary[field] !== true) failures.push(`dataBoundary.${field} must be true`);

const roles = contract.humanRoles || {};
for (const role of ['financeOwner', 'backupOwner', 'closePreparer', 'independentReviewer', 'accountingTaxReviewer', 'exceptionRecipient']) {
    if (roles[role]?.status !== 'unassigned' || roles[role]?.personOrRoleRef !== null || roles[role]?.acceptanceRecorded !== false) failures.push(`humanRoles.${role} must remain unassigned and unaccepted`);
}
allFalse(roles, ['preparerReviewerSeparated', 'ownerBackupSeparated', 'rolesApproved'], 'humanRoles');

const sources = contract.restrictedSourceClasses || [];
exactSet(sources.map(item => item.id), Array.from({ length: 6 }, (_, index) => `FS-${String(index + 1).padStart(3, '0')}`), 'restricted source class IDs');
for (const source of sources) {
    if (typeof source.sourceClass !== 'string' || source.sourceClass.length < 35) failures.push(`${source.id || 'source'} description is incomplete`);
    for (const field of ['providerOrProcess', 'opaqueSourceRef']) if (source[field] !== null) failures.push(`${source.id || 'source'}.${field} must remain null`);
    allFalse(source, ['ownerConfirmed', 'readIdentityConfigured', 'connected'], source.id || 'source');
}

const evidenceClasses = contract.baselineEvidenceClasses || [];
exactSet(evidenceClasses.map(item => item.id), Array.from({ length: 12 }, (_, index) => `FB-${String(index + 1).padStart(3, '0')}`), 'baseline evidence class IDs');
for (const item of evidenceClasses) {
    if (item.status !== 'missing' || item.opaqueSourceRef !== null || item.valueStoredHere !== false || item.reconciled !== false) failures.push(`${item.id || 'evidence'} must remain missing, valueless, and unreconciled`);
    if (typeof item.evidenceClass !== 'string' || item.evidenceClass.length < 40) failures.push(`${item.id || 'evidence'} description is incomplete`);
}

const calendar = contract.closeCalendar || {};
for (const field of ['reportingTimezone', 'periodCadence', 'cutoffDayOrRule', 'sourceFreezeRuleRef', 'preparerDueRule', 'reviewerDueRule', 'exceptionDueRule', 'stalenessThresholdDays']) if (calendar[field] !== null) failures.push(`closeCalendar.${field} must remain null`);
if (calendar.calendarApproved !== false) failures.push('closeCalendar.calendarApproved must remain false');

const reconciliation = contract.reconciliationControls || {};
for (const field of [
    'bankToLedgerReconciliationRequired', 'invoiceContractPaymentLinkageRequired',
    'recognizedAndCollectedRevenueSeparated', 'restrictedAndUnrestrictedCashSeparated',
    'committedAndDiscretionarySpendSeparated', 'currencyConversionSourceAndDateRequired',
    'providerPricePlanRegionTaxAndDateRequired', 'usageRequestSuccessAcceptanceAndViewCountsSeparated',
    'retryFailureCreditAndFreeAllowanceVisible', 'duplicateChargeAndDuplicateInvoiceCheckRequired'
]) if (reconciliation[field] !== true) failures.push(`reconciliationControls.${field} must be true`);
for (const field of ['unreconciledDifferenceThresholdMinorUnits', 'materialVarianceThresholdBasisPoints']) if (reconciliation[field] !== null) failures.push(`reconciliationControls.${field} must remain null`);
allFalse(reconciliation, ['controlsApproved', 'controlsTested'], 'reconciliationControls');

const modelRun = spawnSync(process.execPath, [path.join(repositoryRoot, 'scripts/company/validate-financial-model.cjs')], { cwd: repositoryRoot, encoding: 'utf8' });
let modelOutput = null;
try { modelOutput = JSON.parse(modelRun.stdout); } catch { failures.push('A-022 current financial-model output could not be parsed'); }
const model = contract.currentModelEvidence || {};
if (model.workflowRef !== 'A-022' || model.modelRef !== 'docs/company/finance/financial-model.json') failures.push('currentModelEvidence references are invalid');
for (const [field, expected] of Object.entries({ modelValid: true, financialBaselineComplete: false, costDriverCount: 7, verifiedCostDriverCount: 0, monetizationHypothesisCount: 6, monetizationDecisionReadyCount: 0, publishedRunwayAvailable: false, externalSpendAuthorized: false, externalRevenueActionAuthorized: false })) if (model[field] !== expected) failures.push(`currentModelEvidence.${field} must be ${expected}`);
if (!modelOutput || modelOutput.modelValid !== true || modelOutput.financialBaselineComplete !== model.financialBaselineComplete || modelOutput.costDriverCount !== model.costDriverCount || modelOutput.verifiedCostDriverCount !== model.verifiedCostDriverCount || modelOutput.monetizationHypothesisCount !== model.monetizationHypothesisCount || modelOutput.monetizationDecisionReadyCount !== model.monetizationDecisionReadyCount || modelOutput.publishedRunwayAvailable !== false) failures.push('currentModelEvidence must match the live offline A-022 result');

const exercises = contract.requiredExercises || [];
exactSet(exercises.map(item => item.id), Array.from({ length: 10 }, (_, index) => `FGX-${String(index + 1).padStart(3, '0')}`), 'required exercise IDs');
for (const exercise of exercises) if (exercise.status !== 'not_run' || exercise.passed !== false || typeof exercise.scenario !== 'string' || exercise.scenario.length < 65) failures.push(`${exercise.id || 'exercise'} must remain a complete unrun exercise`);

const gates = contract.activationGates || [];
exactSet(gates.map(item => item.id), Array.from({ length: 18 }, (_, index) => `FG-G${String(index + 1).padStart(2, '0')}`), 'activation gate IDs');
for (const gate of gates) if (gate.satisfied !== false || typeof gate.gate !== 'string' || gate.gate.length < 55) failures.push(`${gate.id || 'gate'} must remain unsatisfied and complete`);

if (!Array.isArray(contract.reviewedCloseCycles) || contract.reviewedCloseCycles.length !== 0) failures.push('reviewedCloseCycles must remain empty');
const inputs = contract.kevinInputBrief || [];
exactSet(inputs.map(item => item.id), Array.from({ length: 5 }, (_, index) => `FFI-${String(index + 1).padStart(3, '0')}`), 'Kevin input brief IDs');
for (const item of inputs) if (item.provided !== false || item.provideFinancialValuesHere !== false || typeof item.input !== 'string' || item.input.length < 90) failures.push(`${item.id || 'input'} must remain unprovided, value-free, and complete`);

if (contract.inputBriefReadyForKevinReview !== true) failures.push('inputBriefReadyForKevinReview must be true');
for (const field of ['providedKevinInputCount', 'connectedRestrictedSourceCount', 'reconciledBaselineEvidenceCount', 'passedExerciseCount', 'satisfiedActivationGateCount', 'reviewedCloseCycleCount']) if (contract[field] !== 0) failures.push(`${field} must remain zero`);
if (contract.requiredReviewedCloseCycleCount !== 4) failures.push('requiredReviewedCloseCycleCount must be 4');
for (const field of ['restrictedReadReviewReady', 'financialBaselineReady', 'runwayCalculationReady', 'unitEconomicsReady', 'forecastPublicationReady', 'spendPolicyReady', 'monetizationDecisionReady', 'activationReady', 'externalActionAuthorized']) if (contract[field] !== false) failures.push(`${field} must remain false`);
if (typeof contract.nextDecision !== 'string' || contract.nextDecision.length < 120 || !contract.nextDecision.includes('does not authorize')) failures.push('nextDecision must preserve the non-authorizing value-free input boundary');
if (containsUnsafeValue(contract)) failures.push('contract must not contain an email, phone, account number, credential, recovery value, or secret-like value');

console.log(JSON.stringify({
    workflow: 'A-040',
    mode: 'restricted financial truth and close assurance; no actuals, account access, import, calculation, publication, spend, or execution',
    financialCloseContractValid: failures.length === 0,
    highRiskRef: 'R-012',
    highRiskOpen: financialRisk?.status === 'open',
    inputBriefReadyForKevinReview: contract.inputBriefReadyForKevinReview,
    kevinInputBriefItemCount: inputs.length,
    providedKevinInputCount: inputs.filter(item => item.provided === true).length,
    assignedHumanRoleCount: Object.values(roles).filter(item => item && typeof item === 'object' && item.status === 'assigned').length,
    restrictedSourceClassCount: sources.length,
    connectedRestrictedSourceCount: sources.filter(item => item.connected === true).length,
    baselineEvidenceClassCount: evidenceClasses.length,
    reconciledBaselineEvidenceCount: evidenceClasses.filter(item => item.reconciled === true).length,
    costDriverCount: model.costDriverCount,
    verifiedCostDriverCount: model.verifiedCostDriverCount,
    requiredExerciseCount: exercises.length,
    passedExerciseCount: exercises.filter(item => item.passed === true).length,
    activationGateCount: gates.length,
    satisfiedActivationGateCount: gates.filter(item => item.satisfied === true).length,
    reviewedCloseCycleCount: contract.reviewedCloseCycles.length,
    requiredReviewedCloseCycleCount: contract.requiredReviewedCloseCycleCount,
    restrictedReadReviewReady: contract.restrictedReadReviewReady,
    financialBaselineReady: contract.financialBaselineReady,
    runwayCalculationReady: contract.runwayCalculationReady,
    unitEconomicsReady: contract.unitEconomicsReady,
    forecastPublicationReady: contract.forecastPublicationReady,
    spendPolicyReady: contract.spendPolicyReady,
    monetizationDecisionReady: contract.monetizationDecisionReady,
    activationReady: contract.activationReady,
    externalActionAuthorized: contract.externalActionAuthorized,
    failures,
    nextAction: contract.nextDecision
}, null, 2));

process.exit(failures.length ? 1 : 2);
