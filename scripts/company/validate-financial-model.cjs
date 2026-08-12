#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const defaultModelPath = path.join(repositoryRoot, 'docs/company/finance/financial-model.json');
const modelPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultModelPath;
const failures = [];

function load(file, label) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`${label} could not be read: ${error.message}`);
        process.exit(1);
    }
}

const model = load(modelPath, 'Financial model');
const vendors = load(path.join(repositoryRoot, 'docs/company/operations/vendors.json'), 'Vendors').vendors || [];
const risks = load(path.join(repositoryRoot, 'docs/company/operations/risks.json'), 'Risks').risks || [];
const decisionsText = fs.readFileSync(path.join(repositoryRoot, 'docs/company/registers/DECISIONS.md'), 'utf8');
const vendorIds = new Set(vendors.map(item => item.id));
const riskIds = new Set(risks.map(item => item.id));
const decisionIds = new Set([...decisionsText.matchAll(/\| (D-\d{3}) \|/g)].map(match => match[1]));

if (model.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (model.status !== 'foundation_gated_missing_actuals') failures.push('status must remain foundation_gated_missing_actuals');
if (model.asOf !== null) failures.push('asOf must remain null until verified actuals exist');
if (model.reportingCurrency !== null) failures.push('reportingCurrency must remain null until entity/accounting policy is verified');
for (const field of [
    'legalEntityVerified', 'accountingSystemConnected', 'bankingSystemConnected',
    'billingSystemConnected', 'paymentProcessorConnected', 'invoiceSourceConnected',
    'taxBasisReviewed', 'revenueRecognitionPolicyReviewed', 'externalSpendAuthorized',
    'externalRevenueActionAuthorized', 'agentMayApproveSpend', 'agentMayMoveMoney',
    'agentMaySetPrice', 'agentMayRecognizeRevenue'
]) {
    if (model[field] !== false) failures.push(`${field} must remain false`);
}

const actualNullFields = [
    'source', 'reconciledAt', 'unrestrictedCashMinorUnits', 'restrictedCashMinorUnits',
    'committedLiabilitiesMinorUnits', 'trailingMonthlyRevenueMinorUnits',
    'trailingMonthlyExpenseMinorUnits', 'forwardMonthlyNetBurnMinorUnits',
    'cashRunwayMonths', 'committedRunwayMonths', 'stressRunwayMonths'
];
if (model.actuals?.sourceVerified !== false) failures.push('actuals.sourceVerified must remain false');
for (const field of actualNullFields) if (model.actuals?.[field] !== null) failures.push(`actuals.${field} must remain null until the source is verified`);

if (model.spendPolicy?.currency !== null) failures.push('spendPolicy.currency must remain null');
for (const field of ['maximumPerActionMinorUnits', 'maximumDailyMinorUnits', 'maximumMonthlyMinorUnits', 'maximumCampaignMinorUnits']) {
    if (model.spendPolicy?.[field] !== 0) failures.push(`spendPolicy.${field} must remain 0`);
}
for (const field of ['agentSelfApprovalPermitted', 'paymentMethodMutationPermitted', 'subscriptionMutationPermitted', 'contractAcceptancePermitted', 'duplicateChargeProtectionVerified', 'spendKillSwitchTested']) {
    if (model.spendPolicy?.[field] !== false) failures.push(`spendPolicy.${field} must remain false`);
}

const driverIds = new Set();
for (const [index, driver] of (model.costDrivers || []).entries()) {
    const label = driver?.id || `costDrivers[${index}]`;
    if (!/^FC-\d{3}$/.test(driver?.id || '')) failures.push(`${label} has invalid ID`);
    if (driverIds.has(driver?.id)) failures.push(`duplicate cost driver ${driver.id}`);
    driverIds.add(driver?.id);
    for (const field of ['name', 'unit', 'owner']) if (typeof driver?.[field] !== 'string' || !driver[field].trim()) failures.push(`${label} lacks ${field}`);
    if (!Array.isArray(driver.vendorIds)) failures.push(`${label}.vendorIds must be an array`);
    for (const id of driver.vendorIds || []) if (!vendorIds.has(id)) failures.push(`${label} references unknown vendor ${id}`);
    if (!Array.isArray(driver.decisionRefs)) failures.push(`${label}.decisionRefs must be an array`);
    for (const id of driver.decisionRefs || []) if (!decisionIds.has(id)) failures.push(`${label} references unknown decision ${id}`);
    for (const field of ['currency', 'verifiedUnitCostMinorUnits', 'actualUsage', 'actualMonthlyCostMinorUnits', 'priceSource', 'priceVerifiedAt']) {
        if (driver[field] !== null) failures.push(`${label}.${field} must remain null until verified`);
    }
    if (driver.spendLimitVerified !== false) failures.push(`${label}.spendLimitVerified must remain false`);
}
if (!Array.isArray(model.costDrivers) || model.costDrivers.length !== 7) failures.push('the foundation must contain seven cost drivers');

const hypothesisIds = new Set();
for (const [index, hypothesis] of (model.monetizationHypotheses || []).entries()) {
    const label = hypothesis?.id || `monetizationHypotheses[${index}]`;
    if (!/^MON-\d{3}$/.test(hypothesis?.id || '')) failures.push(`${label} has invalid ID`);
    if (hypothesisIds.has(hypothesis?.id)) failures.push(`duplicate monetization hypothesis ${hypothesis.id}`);
    hypothesisIds.add(hypothesis?.id);
    if (!['current_non_revenue_access', 'research_only'].includes(hypothesis.status)) failures.push(`${label} has invalid status`);
    for (const field of ['name', 'payer', 'valueExchange']) if (typeof hypothesis?.[field] !== 'string' || !hypothesis[field].trim()) failures.push(`${label} lacks ${field}`);
    if (!Array.isArray(hypothesis.evidenceRequired) || hypothesis.evidenceRequired.length < 3) failures.push(`${label} needs at least three evidence requirements`);
    if (!Array.isArray(hypothesis.decisionRefs) || !hypothesis.decisionRefs.every(id => decisionIds.has(id))) failures.push(`${label} has unknown decisionRefs`);
    if (!Array.isArray(hypothesis.riskRefs) || !hypothesis.riskRefs.every(id => riskIds.has(id))) failures.push(`${label} has unknown riskRefs`);
    for (const field of ['advertisingAuthorized', 'childPurchaseAuthorized', 'behavioralMonetizationAuthorized', 'externalRevenueActionAllowed', 'decisionReady']) {
        if (hypothesis[field] !== false) failures.push(`${label}.${field} must remain false`);
    }
    if (hypothesis.id === 'MON-001') {
        if (hypothesis.customerPriceMinorUnits !== 0) failures.push('MON-001 current first-play price must be 0');
    } else if (hypothesis.customerPriceMinorUnits !== null) {
        failures.push(`${label} must not invent a future price`);
    }
    if (hypothesis.currency !== null) failures.push(`${label}.currency must remain null until entity and model review`);
}
if (!Array.isArray(model.monetizationHypotheses) || model.monetizationHypotheses.length !== 6) failures.push('the foundation must contain six monetization hypotheses');

if (model.forecast?.status !== 'unavailable_missing_verified_actuals_and_assumptions') failures.push('forecast status must remain unavailable');
if (!Array.isArray(model.forecast?.scenarios) || model.forecast.scenarios.length !== 0) failures.push('forecast scenarios must remain empty without verified actuals');
for (const field of ['cashRunwayPublished', 'revenueForecastPublished', 'valuationClaimPermitted']) if (model.forecast?.[field] !== false) failures.push(`forecast.${field} must remain false`);

const financialBaselineComplete = Boolean(
    model.legalEntityVerified && model.actuals?.sourceVerified && model.reportingCurrency && model.asOf
);
const unitEconomicsReady = financialBaselineComplete && (model.costDrivers || []).every(driver =>
    driver.verifiedUnitCostMinorUnits !== null && driver.actualUsage !== null && driver.spendLimitVerified
);
const monetizationDecisionReadyCount = (model.monetizationHypotheses || []).filter(item => item.decisionReady).length;

console.log(JSON.stringify({
    workflow: 'A-022',
    mode: 'internal financial truth and monetization assurance',
    modelValid: failures.length === 0,
    financialBaselineComplete,
    unitEconomicsReady,
    monetizationHypothesisCount: (model.monetizationHypotheses || []).length,
    monetizationDecisionReadyCount,
    costDriverCount: (model.costDrivers || []).length,
    verifiedCostDriverCount: (model.costDrivers || []).filter(item => item.verifiedUnitCostMinorUnits !== null).length,
    accountingSystemConnected: false,
    bankingSystemConnected: false,
    paymentProcessorConnected: false,
    externalSpendAuthorized: false,
    externalRevenueActionAuthorized: false,
    publishedRunwayAvailable: false,
    failures,
    nextAction: 'Name a finance owner and use a restricted source to verify entity, currency, cash, commitments, actual expenses/revenue, and vendor prices before calculating runway, unit economics, or monetization scenarios.'
}, null, 2));

if (failures.length) process.exitCode = 1;
else if (!financialBaselineComplete || !unitEconomicsReady || monetizationDecisionReadyCount === 0) process.exitCode = 2;
