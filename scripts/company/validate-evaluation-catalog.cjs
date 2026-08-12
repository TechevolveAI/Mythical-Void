#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultCatalogPath = path.join(repositoryRoot, 'docs/company/automation/evaluation-catalog.json');
const catalogPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultCatalogPath;
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

const catalog = load(catalogPath, 'Evaluation catalog');
const registry = load(path.join(repositoryRoot, 'docs/company/automation/registry.json'), 'Automation registry');
const registryById = new Map((registry.workflows || []).map(workflow => [workflow.id, workflow]));

if (catalog.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!/^\d{4}-\d{2}-\d{2}$/.test(catalog.asOf || '')) failures.push('asOf must be an ISO date');
if (catalog.status !== 'complete_current_evaluation_coverage_promotion_gated') failures.push('status must remain complete_current_evaluation_coverage_promotion_gated');
if (typeof catalog.purpose !== 'string' || catalog.purpose.length < 50) failures.push('purpose is incomplete');

for (const field of [
    'workflowPromotionAuthorized', 'autonomyIncreaseAuthorized', 'schedulerActivationAuthorized',
    'credentialConnectionAuthorized', 'permissionExpansionAuthorized', 'baselineWriteAuthorized',
    'externalExecutionAuthorized', 'spendAuthorized', 'conversationIsAuthorization',
    'passingEvaluationIsAuthorization'
]) if (catalog.authority?.[field] !== false) failures.push(`authority.${field} must remain false`);

for (const field of [
    'separateEvaluatorScriptRequired', 'everyRegisteredWorkflowMustBeCovered',
    'documentedCaseCountRequired', 'inputBoundaryRequired', 'networkUseMustBeExplicit',
    'minimumEligibleCyclesForPromotion', 'implementationChangeInvalidatesPriorResult',
    'policyModelToolDataPermissionChangeRequiresReevaluation'
]) {
    const expected = field === 'minimumEligibleCyclesForPromotion' ? 4 : true;
    if (catalog.policy?.[field] !== expected) failures.push(`policy.${field} must be ${expected}`);
}
for (const field of ['productionCredentialsInEvaluationPermitted', 'externalMutationInEvaluationPermitted', 'selfPromotionPermitted', 'localProcessCountsAsIndependentRuntime']) if (catalog.policy?.[field] !== false) failures.push(`policy.${field} must remain false`);

const evaluations = catalog.workflows || [];
if (!Array.isArray(catalog.workflows) || evaluations.length !== registryById.size) failures.push('catalog must cover every registered workflow exactly once');
const seen = new Set();
const evaluatorPaths = new Set();
const allowedModes = new Set(['offline_fixture_unit', 'fixture_adversarial', 'isolated_repository_fixture', 'system_integration']);
let totalDocumentedCaseCount = 0;
for (const [index, evaluation] of evaluations.entries()) {
    const label = evaluation?.workflowId || `workflows[${index}]`;
    const registered = registryById.get(evaluation?.workflowId);
    if (!registered) failures.push(`${label} is not a registered workflow`);
    if (seen.has(evaluation?.workflowId)) failures.push(`duplicate evaluation ${evaluation.workflowId}`);
    seen.add(evaluation?.workflowId);
    if (evaluation?.workflowVersion !== registered?.version) failures.push(`${label} workflowVersion does not match the registry`);
    if (evaluation?.implementationPath !== registered?.implementation) failures.push(`${label} implementationPath does not match the registry`);
    if (!allowedModes.has(evaluation?.evaluationMode)) failures.push(`${label} has invalid evaluationMode`);
    if (typeof evaluation?.inputBoundary !== 'string' || evaluation.inputBoundary.length < 10) failures.push(`${label} lacks inputBoundary`);
    if (!Number.isInteger(evaluation?.documentedCaseCount) || evaluation.documentedCaseCount < 1) failures.push(`${label} documentedCaseCount must be positive`);
    totalDocumentedCaseCount += Number.isInteger(evaluation?.documentedCaseCount) ? evaluation.documentedCaseCount : 0;
    if (evaluation?.lastResult !== 'passed' || evaluation?.lastEvaluated !== '2026-08-11') failures.push(`${label} lacks the current passed result`);
    if (evaluation?.separateEvaluatorScript !== true) failures.push(`${label} must use a separate evaluator script`);
    for (const field of ['networkAccessPermitted', 'productionCredentialUsePermitted', 'externalMutationPermitted', 'promotionEligible', 'externalExecutionEligible']) if (evaluation?.[field] !== false) failures.push(`${label}.${field} must remain false`);
    if (evaluation?.eligibleCyclesCompleted !== 0 || evaluation?.requiredEligibleCycles !== 4) failures.push(`${label} promotion-cycle evidence is invalid`);

    if (typeof evaluation?.evaluatorPath !== 'string' || !/^scripts\/company\/test-[a-z0-9-]+\.cjs$/.test(evaluation.evaluatorPath)) {
        failures.push(`${label} evaluatorPath must remain a company test script`);
        continue;
    }
    if (evaluatorPaths.has(evaluation.evaluatorPath)) failures.push(`evaluator ${evaluation.evaluatorPath} is assigned more than once`);
    evaluatorPaths.add(evaluation.evaluatorPath);
    const evaluatorAbsolute = path.resolve(repositoryRoot, evaluation.evaluatorPath);
    if (!evaluatorAbsolute.startsWith(path.join(repositoryRoot, 'scripts/company') + path.sep) || !fs.existsSync(evaluatorAbsolute)) {
        failures.push(`${label} evaluator script is missing or outside scripts/company`);
        continue;
    }
    const evaluatorBody = fs.readFileSync(evaluatorAbsolute, 'utf8');
    if (!evaluatorBody.includes(label)) failures.push(`${label} evaluator does not identify its workflow`);
    if (label === 'A-012') {
        if (evaluation.documentedCaseCount !== 1 || !evaluatorBody.includes('A-012 company control-plane evaluation passed.')) failures.push('A-012 system integration declaration is invalid');
    } else {
        const ordinary = evaluatorBody.match(/passed \((\d+) cases\)/);
        const support = evaluatorBody.match(/passed \((\d+) control cases, (\d+) routing cases\)/);
        const declared = ordinary ? Number(ordinary[1]) : support ? Number(support[1]) + Number(support[2]) : null;
        if (declared !== evaluation.documentedCaseCount) failures.push(`${label} documentedCaseCount does not match its evaluator declaration`);
    }
}

for (const id of registryById.keys()) if (!seen.has(id)) failures.push(`missing evaluation for ${id}`);
if (catalog.coverageComplete !== true) failures.push('coverageComplete must be true only with exact registry coverage');
if (catalog.productionEvaluationHistoryProtected !== false || catalog.independentRuntimeIdentityVerified !== false || catalog.promotionReady !== false || catalog.externalActionAuthorized !== false) failures.push('production history, identity, promotion, and authority must remain false');

console.log(JSON.stringify({
    workflow: 'A-036',
    mode: 'static evaluation binding and promotion assurance; evaluator execution remains in A-012 --verify',
    evaluationCatalogValid: failures.length === 0,
    coverageComplete: failures.length === 0 && catalog.coverageComplete === true,
    registeredWorkflowCount: registryById.size,
    coveredWorkflowCount: evaluations.filter(item => registryById.has(item.workflowId)).length,
    missingEvaluatorCount: [...registryById.keys()].filter(id => !seen.has(id)).length,
    totalDocumentedCaseCount,
    fixtureOrAdversarialWorkflowCount: evaluations.filter(item => item.evaluationMode !== 'system_integration').length,
    systemIntegrationWorkflowCount: evaluations.filter(item => item.evaluationMode === 'system_integration').length,
    networkEnabledEvaluatorCount: evaluations.filter(item => item.networkAccessPermitted).length,
    productionCredentialEvaluatorCount: evaluations.filter(item => item.productionCredentialUsePermitted).length,
    externalMutationEvaluatorCount: evaluations.filter(item => item.externalMutationPermitted).length,
    eligiblePromotionCycleCount: evaluations.reduce((count, item) => count + (item.eligibleCyclesCompleted || 0), 0),
    promotionEligibleWorkflowCount: evaluations.filter(item => item.promotionEligible).length,
    productionEvaluationHistoryProtected: false,
    independentRuntimeIdentityVerified: false,
    promotionReady: false,
    externalActionAuthorized: false,
    failures,
    nextAction: 'Keep all workflows gated. After owners and protected runtime exist, record four independently reviewed eligible cycles per candidate workflow and re-evaluate on every implementation, policy, model, tool, data, identity, permission, cost, or incident change.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else process.exitCode = 2;
