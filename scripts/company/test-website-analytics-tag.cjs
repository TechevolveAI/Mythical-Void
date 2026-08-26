#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const implementationPath = path.join(__dirname, 'validate-website-analytics-tag.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/website-analytics-tag.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a058-eval-'));
let caseCount = 0;
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function execute(value) {
    const target = path.join(temporaryDirectory, `case-${caseCount}.json`);
    fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
    const result = spawnSync(process.execPath, [implementationPath, '--input', target], { cwd: repositoryRoot, encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
    return { status: result.status, output: JSON.parse(result.stdout) };
}
function invalid(mutate, expectedFailure) {
    caseCount += 1;
    const fixture = clone(source);
    mutate(fixture);
    const result = execute(fixture);
    assert.strictEqual(result.status, 1);
    assert.strictEqual(result.output.tagImplementationReadyForReview, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `missing failure: ${expectedFailure}`);
}

try {
    caseCount += 1;
    const baseline = execute(source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.tagImplementationReadyForReview, true);
    assert.strictEqual(baseline.output.measurementId, 'G-FTM4W73ECQ');
    assert.strictEqual(baseline.output.scope, 'public_shop_window_only');
    assert.strictEqual(baseline.output.defaultConsent, 'denied');
    assert.strictEqual(baseline.output.visitorChoiceRequired, true);
    assert.strictEqual(baseline.output.pageViewBeforeChoice, false);
    assert.strictEqual(baseline.output.adFeaturesOff, true);
    assert.strictEqual(baseline.output.publicRouteCount, 3);
    assert.strictEqual(baseline.output.excludedGameRouteCount, 3);
    assert.strictEqual(baseline.output.sourceCheckCount, 6);
    assert.strictEqual(baseline.output.prohibitedDataFieldCount, 17);
    assert.strictEqual(baseline.output.gameSourceTagHits, 0);
    assert.strictEqual(baseline.output.hostingPolicyCount, 2);
    assert.strictEqual(baseline.output.productionDeployed, false);
    assert.strictEqual(baseline.output.externalActionAuthorized, false);
    assert.strictEqual(baseline.output.activationGateCount, 12);
    assert.strictEqual(baseline.output.satisfiedActivationGateCount, 0);

    invalid(value => { value.tag.measurementId = 'G-OTHER'; }, 'measurementId');
    invalid(value => { value.tag.scriptUrl = 'https://example.test/tag'; }, 'scriptUrl');
    invalid(value => { value.tag.scope = 'all_routes'; }, 'scope');
    invalid(value => { value.tag.includedRoutes.pop(); }, 'includedRoutes');
    invalid(value => { value.tag.excludedRoutes.pop(); }, 'excludedRoutes');
    invalid(value => { value.tag.defaultAnalyticsStorage = 'granted'; }, 'defaultAnalyticsStorage');
    invalid(value => { value.tag.allowGoogleSignals = true; }, 'allowGoogleSignals');
    invalid(value => { value.tag.visitorChoiceRequired = false; }, 'visitorChoiceRequired');
    invalid(value => { value.sourceChecks.pop(); }, 'sourceChecks');
    invalid(value => { value.sourceChecks[0].path = 'wrong.html'; }, 'source check 1');
    invalid(value => { value.prohibitedData.pop(); }, 'prohibitedData');
    invalid(value => { value.activationGates.pop(); }, 'activationGates');
    invalid(value => { value.activationGates[0].satisfied = true; }, 'activation gate 1');
    invalid(value => { value.tagImplementationReadyForReview = false; }, 'tagImplementationReadyForReview');
    invalid(value => { value.productionDeployed = true; }, 'productionDeployed');
    invalid(value => { value.externalActionAuthorized = true; }, 'externalActionAuthorized');
    invalid(value => { value.authority.productionDeploymentAuthorizedByKevin = false; }, 'productionDeploymentAuthorizedByKevin');
    invalid(value => { value.nextDecision = 'Deploy.'; }, 'nextDecision is incomplete');
    invalid(value => { value.workflowRefs.pop(); }, 'workflowRefs');
    invalid(value => { value.riskRefs.pop(); }, 'riskRefs');
    invalid(value => { value.decisionRefs.pop(); }, 'decisionRefs');
    invalid(value => { value.status = 'active'; }, 'status is invalid');
    invalid(value => { value.purpose = 'Tag.'; }, 'purpose is incomplete');
    invalid(value => { value.tag.pageViewBeforeChoice = true; }, 'pageViewBeforeChoice');

    assert.strictEqual(caseCount, 25);
    console.log('A-058 website analytics tag evaluations passed (25 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
