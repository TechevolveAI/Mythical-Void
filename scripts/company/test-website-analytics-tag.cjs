#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '../..');
const implementationPath = path.join(__dirname, 'validate-website-analytics-tag.cjs');
const source = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/company/automation/website-analytics-tag.json'), 'utf8'));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-a058-eval-'));
let caseCount = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function execute(value) {
    const target = path.join(temporaryDirectory, `case-${caseCount}.json`);
    fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
    const result = spawnSync(process.execPath, [implementationPath, '--input', target], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 4 * 1024 * 1024
    });
    return { status: result.status, output: JSON.parse(result.stdout) };
}

function invalid(mutate, expectedFailure) {
    caseCount += 1;
    const fixture = clone(source);
    mutate(fixture);
    const result = execute(fixture);
    assert.strictEqual(result.status, 1);
    assert.strictEqual(result.output.implementationLiveAndBounded, false);
    assert(result.output.failures.some(failure => failure.includes(expectedFailure)), `missing failure: ${expectedFailure}`);
}

try {
    caseCount += 1;
    const baseline = execute(source);
    assert.strictEqual(baseline.status, 2);
    assert.strictEqual(baseline.output.implementationLiveAndBounded, true);
    assert.strictEqual(baseline.output.measurementId, 'G-FTM4W73EQC');
    assert.strictEqual(baseline.output.scope, 'consented_public_website_only');
    assert.strictEqual(baseline.output.loadingMode, 'basic_no_google_request_before_affirmative_consent');
    assert.strictEqual(baseline.output.defaultConsent, 'denied');
    assert.strictEqual(baseline.output.publicRouteCount, 10);
    assert.strictEqual(baseline.output.excludedGameRouteCount, 3);
    assert.deepStrictEqual(baseline.output.publicActionEvents, [
        'public_play_selected',
        'public_share_selected',
        'public_trailer_started',
        'public_stem_resource_selected',
        'public_press_asset_selected'
    ]);
    assert.strictEqual(baseline.output.publicActionProperty, 'page_group');
    assert.strictEqual(baseline.output.adFeaturesOff, true);
    assert.strictEqual(baseline.output.pageReferrerBlanked, true);
    assert.strictEqual(baseline.output.enhancedMeasurementMustBeDisabledInProperty, true);
    assert.strictEqual(baseline.output.gameMeasurementAuthorized, false);
    assert.strictEqual(baseline.output.productionDeployed, true);
    assert.strictEqual(baseline.output.upgradeReleaseState, 'prepared_on_feature_branch_not_yet_deployed');
    assert.strictEqual(baseline.output.reportingTrustReady, false);
    assert.strictEqual(baseline.output.trustedForCompanyReporting, false);

    invalid(value => { value.tag.measurementId = 'G-OTHER'; }, 'measurementId');
    invalid(value => { value.tag.scriptUrl = 'https://example.test/tag'; }, 'scriptUrl');
    invalid(value => { value.tag.scope = 'all_routes'; }, 'scope');
    invalid(value => { value.tag.loadingMode = 'advanced'; }, 'loadingMode');
    invalid(value => { value.tag.includedRoutes.pop(); }, 'includedRoutes');
    invalid(value => { value.tag.excludedRoutes.pop(); }, 'excludedRoutes');
    invalid(value => { value.tag.defaultAnalyticsStorage = 'granted'; }, 'defaultAnalyticsStorage');
    invalid(value => { value.tag.allowGoogleSignals = true; }, 'allowGoogleSignals');
    invalid(value => { value.tag.visitorChoiceRequired = false; }, 'visitorChoiceRequired');
    invalid(value => { value.tag.pageReferrerBlanked = false; }, 'pageReferrerBlanked');
    invalid(value => { value.publicActions.enabled = false; }, 'public actions');
    invalid(value => { value.publicActions.eventNames.push('button_clicked'); }, 'public action events');
    invalid(value => { value.publicActions.allowedProperty = 'full_url'; }, 'page_group');
    invalid(value => { value.publicActions.allowedPageGroups.pop(); }, 'allowed page groups');
    invalid(value => { value.sourceChecks.pop(); }, 'sourceChecks');
    invalid(value => { value.prohibitedData.pop(); }, 'prohibitedData');
    invalid(value => { value.activationGates[0].satisfied = false; }, 'activation gate 1');
    invalid(value => { value.authority.productionDeploymentAuthorizedByKevin = false; }, 'productionDeploymentAuthorizedByKevin');
    invalid(value => { value.authority.consentedPublicWebsiteMeasurementApproved = false; }, 'consentedPublicWebsiteMeasurementApproved');
    invalid(value => { value.authority.gameMeasurementAuthorized = true; }, 'gameMeasurementAuthorized');
    invalid(value => { value.productionDeployed = false; }, 'productionDeployed');
    invalid(value => { value.upgradeReleaseState = 'deployed'; }, 'upgradeReleaseState');
    invalid(value => { value.reportingTrustGates.reportAccessVerified = true; }, 'reportAccessVerified');
    invalid(value => { value.reportingTrustGates.enhancedMeasurementSettingsConfirmed = true; }, 'enhancedMeasurementSettingsConfirmed');
    invalid(value => { value.trustedForCompanyReporting = true; }, 'trustedForCompanyReporting');
    invalid(value => { value.nextDecision = 'Trust it.'; }, 'nextDecision is incomplete');
    invalid(value => { value.workflowRefs.pop(); }, 'workflowRefs');
    invalid(value => { value.riskRefs.pop(); }, 'riskRefs');
    invalid(value => { value.decisionRefs.pop(); }, 'decisionRefs');
    invalid(value => { value.status = 'active'; }, 'status is invalid');
    invalid(value => { value.purpose = 'Tag.'; }, 'purpose is incomplete');

    assert.strictEqual(caseCount, 32);
    console.log('A-058 public website measurement evaluations passed (32 cases).');
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
