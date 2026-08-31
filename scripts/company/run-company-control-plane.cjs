#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const includeOnline = process.argv.includes('--online');
const includeVerification = process.argv.includes('--verify');
const unknownArguments = process.argv.slice(2).filter(argument => !['--online', '--verify'].includes(argument));

if (unknownArguments.length) {
    console.error(`Unknown arguments: ${unknownArguments.join(', ')}`);
    process.exit(1);
}

const registry = JSON.parse(fs.readFileSync(
    path.join(repositoryRoot, 'docs', 'company', 'automation', 'registry.json'),
    'utf8'
));
const currentState = JSON.parse(fs.readFileSync(
    path.join(repositoryRoot, 'docs', 'company', 'operations', 'current-state.json'),
    'utf8'
));
const risks = JSON.parse(fs.readFileSync(
    path.join(repositoryRoot, 'docs', 'company', 'operations', 'risks.json'),
    'utf8'
));
const decisionQueue = JSON.parse(fs.readFileSync(
    path.join(repositoryRoot, 'docs', 'company', 'operations', 'decision-queue.json'),
    'utf8'
));

const controls = [
    {
        id: 'FOUNDATION',
        command: ['scripts/company/validate-foundations.cjs'],
        output: 'text'
    },
    {
        id: 'A-002',
        command: ['scripts/company/compile-weekly-review.cjs'],
        output: 'markdown'
    },
    {
        id: 'A-003',
        command: ['scripts/company/validate-content-package.cjs', 'docs/company/content/drafts/PROJECT_BEACON_INTRO.json'],
        output: 'json'
    },
    {
        id: 'A-004',
        command: ['scripts/company/evaluate-support-triage.cjs'],
        output: 'json'
    },
    {
        id: 'A-005',
        command: ['scripts/company/synthesize-customer-evidence.cjs'],
        output: 'json'
    },
    {
        id: 'A-006',
        command: ['scripts/company/validate-measurement-contract.cjs'],
        output: 'json'
    },
    {
        id: 'A-007',
        command: ['scripts/company/validate-commercial-pipeline.cjs'],
        output: 'json'
    },
    {
        id: 'A-008',
        command: ['scripts/company/validate-channel-registry.cjs'],
        output: 'json'
    },
    {
        id: 'A-009',
        command: ['scripts/company/validate-operations-registers.cjs'],
        output: 'json'
    },
    {
        id: 'A-010',
        command: ['scripts/company/audit-provider-policy-drift.cjs'],
        output: 'json'
    },
    {
        id: 'A-011',
        command: ['scripts/company/validate-approval-envelope.cjs'],
        output: 'json'
    },
    {
        id: 'A-011-RM-001',
        command: ['scripts/company/validate-approval-envelope.cjs', 'docs/company/automation/approval-requests/RM-001_PREVIEW_DRAFT.json'],
        output: 'json'
    },
    {
        id: 'A-013',
        command: ['scripts/company/validate-editorial-queue.cjs'],
        output: 'json'
    },
    {
        id: 'A-014',
        command: ['scripts/company/validate-objective-action-queue.cjs'],
        output: 'json'
    },
    {
        id: 'A-018',
        command: ['scripts/company/validate-release-manifest.cjs'],
        output: 'json'
    },
    {
        id: 'A-019',
        command: ['scripts/company/validate-growth-experiment-portfolio.cjs'],
        output: 'json'
    },
    {
        id: 'A-020',
        command: ['scripts/company/validate-engagement-lifecycle.cjs'],
        output: 'json'
    },
    {
        id: 'A-021',
        command: ['scripts/company/validate-search-opportunity-map.cjs'],
        output: 'json'
    },
    {
        id: 'A-022',
        command: ['scripts/company/validate-financial-model.cjs'],
        output: 'json'
    },
    {
        id: 'A-023',
        command: ['scripts/company/validate-agent-roster.cjs'],
        output: 'json'
    },
    {
        id: 'A-024',
        command: ['scripts/company/build-agent-delegation-plan.cjs'],
        output: 'json'
    },
    {
        id: 'A-025',
        command: ['scripts/company/validate-decision-queue.cjs'],
        output: 'json'
    },
    {
        id: 'A-026',
        command: ['scripts/company/validate-launch-readiness.cjs'],
        output: 'json'
    },
    {
        id: 'A-027',
        command: ['scripts/company/validate-proof-production.cjs'],
        output: 'json'
    },
    {
        id: 'A-028',
        command: ['scripts/company/validate-market-landscape.cjs'],
        output: 'json'
    },
    {
        id: 'A-029',
        command: ['scripts/company/validate-adult-research-operations.cjs'],
        output: 'json'
    },
    {
        id: 'A-030',
        command: ['scripts/company/run-internal-shadow-cycle.cjs'],
        output: 'json'
    },
    {
        id: 'A-031',
        command: ['scripts/company/validate-protected-runtime.cjs'],
        output: 'json'
    },
    {
        id: 'A-032',
        command: ['scripts/company/validate-commercial-qualification.cjs'],
        output: 'json'
    },
    {
        id: 'A-033',
        command: ['scripts/company/validate-channel-identity.cjs'],
        output: 'json'
    },
    {
        id: 'A-034',
        command: ['scripts/company/validate-campaign-package.cjs'],
        output: 'json'
    },
    {
        id: 'A-035',
        command: ['scripts/company/validate-integration-activation.cjs'],
        output: 'json'
    },
    {
        id: 'A-036',
        command: ['scripts/company/validate-evaluation-catalog.cjs'],
        output: 'json'
    },
    {
        id: 'A-037',
        command: ['scripts/company/validate-protected-runtime-provider-evaluation.cjs'],
        output: 'json'
    },
    {
        id: 'A-038',
        command: ['scripts/company/validate-pe001-public-due-diligence.cjs'],
        output: 'json'
    },
    {
        id: 'A-039',
        command: ['scripts/company/validate-safeguarding-activation.cjs'],
        output: 'json'
    },
    {
        id: 'A-040',
        command: ['scripts/company/validate-financial-truth-close.cjs'],
        output: 'json'
    },
    {
        id: 'A-041',
        command: ['scripts/company/validate-company-operating-cadence.cjs'],
        output: 'json'
    },
    {
        id: 'A-042',
        command: ['scripts/company/compile-cadence-work-packets.cjs'],
        output: 'json'
    },
    {
        id: 'A-043',
        command: ['scripts/company/validate-cadence-transitive-effects.cjs'],
        output: 'json'
    },
    {
        id: 'A-044',
        command: ['scripts/company/rehearse-protected-trigger-binding.cjs'],
        output: 'json'
    },
    {
        id: 'A-045',
        command: ['scripts/company/rehearse-protected-trigger-envelope-admission.cjs'],
        output: 'json'
    },
    {
        id: 'A-046',
        command: ['scripts/company/rehearse-protected-run-history.cjs'],
        output: 'json'
    },
    {
        id: 'A-047',
        command: ['scripts/company/rehearse-authenticated-exception-delivery.cjs'],
        output: 'json'
    },
    {
        id: 'A-048',
        command: ['scripts/company/rehearse-protected-execution-lease.cjs'],
        output: 'json'
    },
    {
        id: 'A-049',
        command: ['scripts/company/rehearse-protected-failure-recovery.cjs'],
        output: 'json'
    },
    {
        id: 'A-050',
        command: ['scripts/company/rehearse-protected-time-and-split-brain.cjs'],
        output: 'json'
    },
    {
        id: 'A-051',
        command: ['scripts/company/rehearse-protected-backup-and-restore.cjs'],
        output: 'json'
    },
    {
        id: 'A-052',
        command: ['scripts/company/rehearse-protected-recovery-objectives-and-key-continuity.cjs'],
        output: 'json'
    },
    {
        id: 'A-053',
        command: ['scripts/company/rehearse-protected-cryptographic-misuse-and-recovery-poisoning.cjs'],
        output: 'json'
    },
    {
        id: 'A-054',
        command: ['scripts/company/rehearse-protected-nonce-concurrency-and-failover.cjs'],
        output: 'json'
    },
    {
        id: 'A-055',
        command: ['scripts/company/validate-audience-language-and-comprehension.cjs'],
        output: 'json'
    },
    {
        id: 'A-056',
        command: ['scripts/company/validate-inbound-contact-triage.cjs'],
        output: 'json'
    },
    {
        id: 'A-057',
        command: ['scripts/company/validate-grounded-support-drafting.cjs'],
        output: 'json'
    },
    {
        id: 'A-058',
        command: ['scripts/company/validate-website-analytics-tag.cjs'],
        output: 'json'
    }
];

if (includeOnline) {
    controls.splice(1, 0, {
        id: 'A-001',
        command: ['scripts/company/audit-public-footprint.cjs'],
        output: 'json'
    });
}

if (includeVerification) {
    controls.push(
        {
            id: 'EVAL-A-001',
            command: ['scripts/company/test-public-footprint-audit.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-002',
            command: ['scripts/company/test-weekly-review.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-003',
            command: ['scripts/company/test-content-package.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-004',
            command: ['scripts/company/test-support-triage.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-005',
            command: ['scripts/company/test-customer-evidence-synthesis.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-006',
            command: ['scripts/company/test-measurement-contract.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-007',
            command: ['scripts/company/test-commercial-pipeline.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-008',
            command: ['scripts/company/test-channel-registry.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-009',
            command: ['scripts/company/test-operations-registers.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-010',
            command: ['scripts/company/test-provider-policy-drift.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-011',
            command: ['scripts/company/test-approval-envelope.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-013',
            command: ['scripts/company/test-editorial-queue.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-014',
            command: ['scripts/company/test-objective-action-queue.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-018',
            command: ['scripts/company/test-release-manifest.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-019',
            command: ['scripts/company/test-growth-experiment-portfolio.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-020',
            command: ['scripts/company/test-engagement-lifecycle.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-021',
            command: ['scripts/company/test-search-opportunity-map.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-022',
            command: ['scripts/company/test-financial-model.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-023',
            command: ['scripts/company/test-agent-roster.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-024',
            command: ['scripts/company/test-agent-delegation-plan.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-025',
            command: ['scripts/company/test-decision-queue.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-026',
            command: ['scripts/company/test-launch-readiness.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-027',
            command: ['scripts/company/test-proof-production.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-028',
            command: ['scripts/company/test-market-landscape.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-029',
            command: ['scripts/company/test-adult-research-operations.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-030',
            command: ['scripts/company/test-internal-shadow-cycle.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-031',
            command: ['scripts/company/test-protected-runtime.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-032',
            command: ['scripts/company/test-commercial-qualification.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-033',
            command: ['scripts/company/test-channel-identity.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-034',
            command: ['scripts/company/test-campaign-package.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-035',
            command: ['scripts/company/test-integration-activation.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-036',
            command: ['scripts/company/test-evaluation-catalog.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-037',
            command: ['scripts/company/test-protected-runtime-provider-evaluation.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-038',
            command: ['scripts/company/test-pe001-public-due-diligence.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-039',
            command: ['scripts/company/test-safeguarding-activation.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-040',
            command: ['scripts/company/test-financial-truth-close.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-041',
            command: ['scripts/company/test-company-operating-cadence.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-042',
            command: ['scripts/company/test-cadence-work-packets.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-043',
            command: ['scripts/company/test-cadence-transitive-effects.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-044',
            command: ['scripts/company/test-protected-trigger-binding.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-045',
            command: ['scripts/company/test-protected-trigger-envelope-admission.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-046',
            command: ['scripts/company/test-protected-run-history.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-047',
            command: ['scripts/company/test-authenticated-exception-delivery.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-048',
            command: ['scripts/company/test-protected-execution-lease.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-049',
            command: ['scripts/company/test-protected-failure-recovery.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-050',
            command: ['scripts/company/test-protected-time-and-split-brain.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-051',
            command: ['scripts/company/test-protected-backup-and-restore.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-052',
            command: ['scripts/company/test-protected-recovery-objectives-and-key-continuity.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-053',
            command: ['scripts/company/test-protected-cryptographic-misuse-and-recovery-poisoning.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-054',
            command: ['scripts/company/test-protected-nonce-concurrency-and-failover.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-055',
            command: ['scripts/company/test-audience-language-and-comprehension.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-056',
            command: ['scripts/company/test-inbound-contact-triage.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-057',
            command: ['scripts/company/test-grounded-support-drafting.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        },
        {
            id: 'EVAL-A-058',
            command: ['scripts/company/test-website-analytics-tag.cjs'],
            output: 'text',
            expectedExitCodes: [0]
        }
    );
}

function compact(parsed) {
    const keys = [
        'validDraft',
        'readyForHumanApproval',
        'authorizedForPublication',
        'evaluationPassed',
        'promotionEligible',
        'liveInboxConnected',
        'decisionReadiness',
        'acceptedEvidenceCount',
        'credibleThemeCount',
        'contractValid',
        'productionCollectionAuthorized',
        'collectionEnabled',
        'eventCount',
        'valid',
        'externalActionsAuthorized',
        'externalPublishingAuthorized',
        'registersValid',
        'operationalReadiness',
        'openRiskCount',
        'auditValid',
        'policyReadiness',
        'findingCount',
        'envelopeValid',
        'workflowEligible',
        'trustedApprovalVerifierConfigured',
        'externalActionAuthorized',
        'queueValid',
        'draftReadyCount',
        'publicationReadyCount',
        'objectiveCount',
        'actionCount',
        'completedActionCount'
        ,
        'manifestValid',
        'implementationEvidenceReady',
        'releaseReady',
        'deploymentAuthorized',
        'isolatableFromCurrentWorkingTree',
        'isolatedArtifactReadyForReview',
        'artifactDigestValid',
        'baseApplicationValid',
        'isolatedResultDigestsValid',
        'unrelatedStorefrontHunksExcluded',
        'fileCount',
        'portfolioValid',
        'externalExperimentActionsAuthorized',
        'behavioralTargetingPermitted',
        'experimentCount',
        'executableExperimentCount',
        'decisionReadyExperimentCount',
        'eventCollectionEnabled'
        ,
        'lifecycleValid',
        'externalEngagementAuthorized',
        'crmConnected',
        'inboxConnected',
        'autonomousRepliesPermitted',
        'contactRecordCount',
        'programCount',
        'executionReadyProgramCount'
        ,
        'mapValid',
        'publicationAuthorized',
        'integrationPlanValid',
        'inventoryComplete',
        'integrationCount',
        'stageCount',
        'anonymousPublicReadCount',
        'observedHumanAccessContextCount',
        'connectorConfiguredCount',
        'credentialReferenceCount',
        'requestPreparedCount',
        'activationReadyCount',
        'writeCapableIntegrationCount',
        'spendCapableIntegrationCount',
        'personalDataPossibleCount',
        'childDataPossibleCount',
        'firstAccessBriefItemCount',
        'firstAccessBriefReadyForKevinReview',
        'accessRequestDeliveryAuthorized',
        'connectorActivationAuthorized',
        'externalWriteAuthorized',
        'spendAuthorized',
        'evaluationCatalogValid',
        'coverageComplete',
        'registeredWorkflowCount',
        'coveredWorkflowCount',
        'missingEvaluatorCount',
        'totalDocumentedCaseCount',
        'fixtureOrAdversarialWorkflowCount',
        'systemIntegrationWorkflowCount',
        'networkEnabledEvaluatorCount',
        'productionCredentialEvaluatorCount',
        'externalMutationEvaluatorCount',
        'eligiblePromotionCycleCount',
        'promotionEligibleWorkflowCount',
        'productionEvaluationHistoryProtected',
        'independentRuntimeIdentityVerified',
        'promotionReady',
        'providerEvaluationValid',
        'reviewPackageReady',
        'architectureClassRef',
        'candidateCount',
        'platformRequirementCount',
        'officialSourceCount',
        'documentedCapabilityMappingCount',
        'unverifiedRequirementMappingCount',
        'recommendedReviewCandidateCount',
        'selectedProviderCount',
        'accountEvidenceCount',
        'pricingVerifiedCount',
        'securityReviewCompletedCount',
        'privacyReviewCompletedCount',
        'recommendationIsProviderSelection',
        'deploymentReady',
        'runtimePromotionEligible',
        'dueDiligenceValid',
        'publicReviewOutcome',
        'candidateId',
        'documentedPlausibleRequirementCount',
        'partialPublicEvidenceRequirementCount',
        'configurationVerifiedRequirementCount',
        'publicBlockerCount',
        'irelandCloudRunRegionListed',
        'candidateEuropeanRegionCount',
        'selectedRegionCount',
        'exactCompanyCostAvailable',
        'spendCapFeatureStage',
        'disabledBlueprintComponentCount',
        'satisfiedAccountAndHumanGateCount',
        'providerSelected',
        'accountScopedReviewReady',
        'safeguardingContractValid',
        'criticalRiskRef',
        'criticalRiskOpen',
        'inputBriefReadyForKevinReview',
        'kevinInputBriefItemCount',
        'providedKevinInputCount',
        'primaryAssigned',
        'backupAssigned',
        'urgentRouteConfigured',
        'professionalReviewCompleted',
        'syntheticCaseCount',
        'syntheticRestrictedRecall',
        'syntheticQ0ExactRecall',
        'requiredExerciseCount',
        'passedExerciseCount',
        'activationGateCount',
        'satisfiedActivationGateCount',
        'downstreamDependencyCount',
        'readyDownstreamDependencyCount',
        'coverageReady',
        'restrictedRoutingTestReady',
        'supportPilotReady',
        'researchSafeguardingGateReady',
        'publicIntakePromotionReady',
        'activationReady',
        'financialCloseContractValid',
        'highRiskRef',
        'highRiskOpen',
        'assignedHumanRoleCount',
        'restrictedSourceClassCount',
        'connectedRestrictedSourceCount',
        'baselineEvidenceClassCount',
        'reconciledBaselineEvidenceCount',
        'reviewedCloseCycleCount',
        'requiredReviewedCloseCycleCount',
        'restrictedReadReviewReady',
        'financialBaselineReady',
        'runwayCalculationReady',
        'forecastPublicationReady',
        'spendPolicyReady',
        'monetizationDecisionReady',
        'cadenceContractValid',
        'calendarScheduleCount',
        'enabledCalendarScheduleCount',
        'eventTriggerPlanCount',
        'enabledEventTriggerCount',
        'protectedTriggerInputBindingCount',
        'configuredTriggerInputBindingCount',
        'simulatedCalendarDayCount',
        'simulatedPlannedOccurrenceCount',
        'simulatedMaximumOccurrencesOnOneDay',
        'simulatedSameStartCollisionCount',
        'simulatedMinimumMinutesBetweenStarts',
        'simulationWithinDailyLimit',
        'simulationWithinMonthlyLimit',
        'schedulerEnabled',
        'protectedHistoryReady',
        'authenticatedAlertingReady',
        'cadenceActivationReady',
        'packetSetValid',
        'calendarPacketCount',
        'eventTriggerPacketCount',
        'totalPacketCount',
        'uniquePacketIdCount',
        'uniqueContentDigestCount',
        'primaryAgentCount',
        'independentEvaluatorBindingCount',
        'protectedInputBindingPacketCount',
        'configuredInputBindingPacketCount',
        'allPacketsDisabled',
        'allCommandsAllowlisted',
        'allImplementationsRegistered',
        'allEvaluatorsBound',
        'allResourceLimitsWithinCadenceEnvelope',
        'allAuthorityFalse',
        'packetSetReadyForReview',
        'protectedDispatchReady',
        'effectMapValid',
        'effectMapReadyForReview',
        'effectBoundaryCount',
        'packetSourceCount',
        'coveredPacketCount',
        'uncoveredPacketCount',
        'duplicatePacketCoverageCount',
        'publicNetworkPacketCount',
        'publicNetworkSourceIds',
        'unknownTransitiveEffectCount',
        'liveSourceEvidenceCurrent',
        'runtimeTracingReady',
        'packetExecutionReady',
        'bindingContractValid',
        'rehearsalPerformed',
        'rehearsalValid',
        'consumerCount',
        'syntheticPayloadCount',
        'rehearsalCount',
        'passedRehearsalCount',
        'repositoryMutationCount',
        'consumerCommandFallbackCount',
        'protectedBindingConfigured',
        'replayStoreConfigured',
        'protectedHistoryConfigured',
        'productionPayloadAccepted',
        'bindingContractReadyForReview',
        'runtimeBindingReady',
        'eligibleCycleCreditGranted',
        'admissionContractValid',
        'livePacketSetCurrent',
        'admissionAttemptCount',
        'acceptedAdmissionCount',
        'rejectedAdmissionCount',
        'replayRejectionCount',
        'syntheticSignatureVerifiedCount',
        'ephemeralLedgerWriteCount',
        'productionIssuerIdentityConfigured',
        'productionVerifierIdentityConfigured',
        'productionTrustStoreConfigured',
        'trustedTimeConfigured',
        'durableReplayStoreConfigured',
        'admissionContractReadyForReview',
        'productionAdmissionReady',
        'consumerInvocationReady',
        'consumerInvocationCount',
        'historyContractValid',
        'sourceEvidenceCurrent',
        'historyChainValid',
        'reconciliationValid',
        'recordCount',
        'storedRecordCount',
        'readBackRecordCount',
        'branchCount',
        'tamperScenarioCount',
        'detectedTamperCount',
        'undetectedTamperCount',
        'rawPayloadStoredCount',
        'sensitiveMaterialStoredCount',
        'productionHistoryStoreConfigured',
        'productionHistoryIdentityCount',
        'retentionPolicyApproved',
        'backupAndRestoreReady',
        'historyContractReadyForReview',
        'productionHistoryReady',
        'eligibleCycleReady',
        'deliveryContractValid',
        'eligibleChangeCount',
        'alertCount',
        'syntheticRouteCount',
        'ephemeralIdentityCount',
        'deliveryAttemptCount',
        'successfulDeliveryCount',
        'failedDeliveryCount',
        'verifiedAcknowledgementCount',
        'duplicateSuppressionCount',
        'failoverCount',
        'ledgerWriteCount',
        'refusalScenarioCount',
        'refusedScenarioCount',
        'unrefusedScenarioCount',
        'rawPayloadDeliveredCount',
        'contactDetailStoredCount',
        'productionRouteConfiguredCount',
        'productionIdentityConfiguredCount',
        'recipientConfirmationRecorded',
        'durableDeliveryStoreConfigured',
        'authenticatedProductionRouteConfigured',
        'deliveryContractReadyForReview',
        'productionDeliveryReady',
        'leaseContractValid',
        'operationCount',
        'passedOperationCount',
        'acquisitionCount',
        'overlapBlockCount',
        'renewalCount',
        'releaseCount',
        'replaySuppressionCount',
        'expiredHolderRefusalCount',
        'wrongHolderRefusalCount',
        'staleFenceRefusalCount',
        'recoveryCount',
        'highestFencingToken',
        'fencingTokensMonotonic',
        'temporaryRecordWriteCount',
        'killRehearsalPerformed',
        'parentProcessTerminated',
        'childProcessTerminated',
        'killedProcessCount',
        'globalDisableBlockedLeaseCount',
        'underlyingCompanyWorkflowInvocationCount',
        'productionCoordinatorConfigured',
        'trustedTimeConfigured',
        'leaseContractReadyForReview',
        'productionCoordinationReady',
        'failureRecoveryContractValid',
        'scenarioCount',
        'passedScenarioCount',
        'detectedFaultCount',
        'failClosedCount',
        'realCrashCount',
        'realCrashExitCodes',
        'orphanDetectedCount',
        'quarantineCount',
        'boundedRecoveryCount',
        'automaticRecoveryRefusalCount',
        'completionPreservedCount',
        'staleEffectRefusalCount',
        'globalDisableRecoveryBlockCount',
        'fencingTokenAdvanced',
        'terminationPrecededRecovery',
        'scheduledCompanyWorkflowInvocationCount',
        'productionResilienceConfigured',
        'failureRecoveryContractReadyForReview',
        'productionResilienceReady',
        'timeAndSplitBrainContractValid',
        'concurrentContenderProcessCount',
        'acquisitionContenderCount',
        'acquisitionWinnerCount',
        'acquisitionLoserCount',
        'recoveryContenderCount',
        'recoveryWinnerCount',
        'recoveryLoserCount',
        'clockSkewCaseCount',
        'workerClockOverrideIgnoredCount',
        'delayedTriggerSuppressionCount',
        'partitionedDuplicateRefusalCount',
        'stalePartitionRefusalCount',
        'tokenExhaustionRefusalCount',
        'globalDisableEffectBlockCount',
        'temporaryRecordFileCount',
        'productionConsensusConfigured',
        'timeAndSplitBrainContractReadyForReview',
        'productionConsensusReady',
        'backupRestoreContractValid',
        'evidenceRecordCount',
        'backupWriteCount',
        'exactRestoreCount',
        'corruptionDetectionCount',
        'truncationDetectionCount',
        'deletionDetectionCount',
        'reorderDetectionCount',
        'staleGenerationRefusalCount',
        'failureDomainRefusalCount',
        'restoreContenderProcessCount',
        'restoreWinnerCount',
        'restoreLoserCount',
        'globalDisableActivationBlockCount',
        'localRestoreDurationMilliseconds',
        'localRestoreWithinBound',
        'temporaryArtifactFileCount',
        'credentialMaterialStoredCount',
        'productionDurabilityConfigured',
        'encryptionKeyConfigured',
        'backupRestoreContractReadyForReview',
        'productionDurabilityReady',
        'recoveryObjectiveContractValid',
        'sourceEvidenceDigestSha256',
        'sourceContractDigestSha256',
        'generationCount',
        'encryptedCapsuleCount',
        'authenticatedDecryptCount',
        'predecessorGenerationDecryptCount',
        'selectedGeneration',
        'measuredRecoveryPointLossSeconds',
        'localRecoveryDurationMilliseconds',
        'localRecoveryWithinBound',
        'missingKeyRefusalCount',
        'recoveryApprovalSuccessCount',
        'approvalRefusalCount',
        'authenticatedDecryptionRefusalCount',
        'rpoRefusalCount',
        'futurePointRefusalCount',
        'recoveryApproverCount',
        'validRecoveryApprovalCount',
        'ephemeralKeyFileCreateCount',
        'keyMaterialRetainedAfterRun',
        'productionCredentialMaterialStoredCount',
        'productionKeyManagementConfigured',
        'recoveryObjectiveContractReadyForReview',
        'productionRecoveryObjectivesReady',
        'productionKeyContinuityReady',
        'cryptographicMisuseContractValid',
        'probeEncryptionCount',
        'successfulProbeEncryptionCount',
        'uniqueNonceCount',
        'nonceReuseRefusalCount',
        'algorithmDowngradeRefusalCount',
        'aadSubstitutionRefusalCount',
        'keyVersionRefusalCount',
        'rollbackRefusalCount',
        'approvalRefusalCount',
        'objectiveGamingRefusalCount',
        'oversizeRefusalCount',
        'attemptBudgetRefusalCount',
        'globalDisableEffectBlockCount',
        'trustedRecoveryApproverCount',
        'compromisedRecoveryApproverCount',
        'productionCryptographicControlsConfigured',
        'cryptographicMisuseContractReadyForReview',
        'productionCryptographicSafetyReady',
        'productionRecoveryPoisoningDefenseReady',
        'nonceConcurrencyContractValid',
        'concurrentAllocatorProcessCount',
        'concurrentUniqueAllocationCount',
        'retryClaimantProcessCount',
        'retryWinnerCount',
        'retryLoserCount',
        'successfulEncryptionCount',
        'authenticatedRoundTripCount',
        'burnedNonceCount',
        'crashReservedNonceBurnCount',
        'failoverCounterAdvanceCount',
        'corruptLedgerQuarantineCount',
        'keyVersionNamespaceCount',
        'crossRegionDuplicateRefusalCount',
        'counterExhaustionRefusalCount',
        'staleFenceRefusalCount',
        'cancelledNonceBurnCount',
        'globalDisabledNonceBurnCount',
        'reusedNonceEncryptionCount',
        'productionNonceControlsConfigured',
        'nonceConcurrencyContractReadyForReview',
        'productionNonceSafetyReady',
        'productionFailoverNonceSafetyReady',
        'searchSubmissionAuthorized',
        'paidSearchAuthorized',
        'verifiedWebmasterSourceConnected',
        'sampledBrandedResultObserved',
        'sampledSiteRestrictedResultObserved',
        'clusterCount',
        'publicationReadyClusterCount',
        'searchSubmissionReadyClusterCount'
        ,
        'modelValid',
        'financialBaselineComplete',
        'unitEconomicsReady',
        'monetizationHypothesisCount',
        'monetizationDecisionReadyCount',
        'costDriverCount',
        'verifiedCostDriverCount',
        'accountingSystemConnected',
        'bankingSystemConnected',
        'paymentProcessorConnected',
        'externalSpendAuthorized',
        'externalRevenueActionAuthorized',
        'publishedRunwayAvailable',
        'rosterValid',
        'operatingModelReady',
        'agentCount',
        'internalManualAgentCount',
        'designOnlyAgentCount',
        'boundedRuntimeAgentCount',
        'requiredFunctionCount',
        'coveredFunctionCount',
        'registeredWorkflowCount',
        'assignedWorkflowCount',
        'unassignedWorkflowCount',
        'duplicateAssignmentCount',
        'ownerConfirmedCount',
        'backupAssignedCount',
        'separationOfDutiesValid',
        'schedulerConfigured',
        'protectedMemoryStoreConfigured',
        'authenticatedAlertRouteConfigured',
        'productionServiceIdentitiesConfigured',
        'planValid',
        'delegationReady',
        'automatedDispatchAuthorized',
        'readyInternalActionCount',
        'nonReadyInternalActionCount',
        'prohibitedModeReadyCount',
        'workOrderCount',
        'manualInvocationReadyCount',
        'blockedReadyActionCount',
        'queueReadyForReview',
        'automatedDeliveryReady',
        'packetCount',
        'maximumPackets',
        'awaitingDecisionCount',
        'criticalOpenRiskCount',
        'criticalOpenRiskCoverageCount',
        'highOrCriticalOpenRiskCount',
        'coveredHighOrCriticalRiskCount',
        'deliveryConfigured',
        'conversationIsAuthorization',
        'sensitiveValuesIncluded',
        'launchPlanValid',
        'currentStageId',
        'currentStageReady',
        'trackCount',
        'readyTrackCount',
        'stageCount',
        'advancedStageReadyCount',
        'broadLaunchReady',
        'paidLaunchReady',
        'launchAuthorized',
        'outreachAuthorized',
        'dataCollectionAuthorized',
        'paidAcquisitionAuthorized',
        'monetizationExecutionAuthorized',
        'behavioralTargetingOfMinorsPermitted',
        'acceptedCustomerEvidenceCount',
        'gameplayProofApprovedCount',
        'measurementCollectionEnabled',
        'proofProductionPlanValid',
        'stableBuildRecorded',
        'briefCount',
        'internalBriefReadyCount',
        'captureReadyCount',
        'proofApprovalReadyCount',
        'captureAuthorized',
        'proofApprovalAuthorized',
        'derivativeProductionAuthorized',
        'syntheticGameplayPermitted',
        'personalDataInCapturePermitted',
        'marketLandscapeValid',
        'categoryCount',
        'sourceCount',
        'firstPartySourceCount',
        'referenceCount',
        'hypothesisCount',
        'validatedHypothesisCount',
        'acceptedCustomerEvidenceCount',
        'watchSignalCount',
        'marketSizingPermitted',
        'marketShareOrRankClaimsPermitted',
        'generatedPersonasCountAsCustomers',
        'positioningChangeAuthorized',
        'publicComparisonAuthorized',
        'externalResearchWritesAuthorized',
        'minorTargetingPermitted',
        'researchOperationsPlanValid',
        'internalPackageReady',
        'studyId',
        'targetSessionCount',
        'guardianSessionCount',
        'adjacentAdultSessionCount',
        'namedResearchTeamReady',
        'satisfiedEntryGateCount',
        'recruitmentReady',
        'sessionReady',
        'evidenceImportReady',
        'resultCount',
        'recruitmentAuthorized',
        'participantContactAuthorized',
        'sessionRecordingAuthorized',
        'compensationAuthorized',
        'directMinorContactPermitted',
        'contractValid',
        'rehearsalCompleted',
        'cycleId',
        'stepCount',
        'completedStepCount',
        'passedStepCount',
        'gatedStepCount',
        'brokenStepCount',
        'workspaceMutationCount',
        'designedProducerEvaluatorSeparation',
        'runtimeIdentitySeparationProven',
        'singleProcessRehearsal',
        'eligiblePromotionCycle',
        'eligibleShadowCycleCount',
        'minimumEligibleShadowCycles',
        'recordPersisted',
        'runtimeArchitectureValid',
        'architecturePackageReady',
        'architectureOptionCount',
        'recommendedArchitectureOptionId',
        'selectedArchitectureOptionId',
        'missingProviderComponentCount',
        'requiredReadinessGateCount',
        'satisfiedReadinessGateCount',
        'identitySeparationConfigured',
        'protectedHistoryConfigured',
        'authenticatedAlertingConfigured',
        'credentialReferenceCount',
        'failureTestPassedCount',
        'killSwitchExercisePassed',
        'spendMinorUnitsPerRun',
        'deploymentReady',
        'runtimePromotionEligible',
        'commercialQualificationValid',
        'portfolioDecisionReady',
        'opportunityCount',
        'qualifiedOpportunityCount',
        'technicalFeasibilityPriorityCount',
        'internalSequence',
        'reviewedDimensionCount',
        'disqualifierReviewCount',
        'unresolvedDisqualifierReviewCount',
        'triggeredDisqualifierCount',
        'contactRecordCount',
        'outreachPackageCount',
        'financialAssumptionValueCount',
        'pipelineStageMutationAuthorized',
        'contactEnrichmentAuthorized',
        'outreachDraftingAuthorized',
        'outreachSendingAuthorized',
        'accountCreationAuthorized',
        'termsAcceptanceAuthorized',
        'sdkIntegrationAuthorized',
        'pricingOrTermsAuthorized',
        'revenueForecastingAuthorized',
        'contractingAuthorized',
        'channelIdentityPlanValid',
        'publicAuditCurrent',
        'registryChannelCount',
        'ownedWebObservedCount',
        'sampledSearchCount',
        'homepageSocialAccountLinkCount',
        'publicOfficialSocialAccountConfirmedCount',
        'unverifiedSocialChannelCount',
        'candidateAccountUrlCount',
        'publishingCredentialCount',
        'publishReadyChannelCount',
        'requiredPublicationGateCount',
        'satisfiedPublicationGateCount',
        'atomizedCampaignPackagePresent',
        'namingConfusionRiskObserved',
        'twitterCardMetadataPresent',
        'twitterAccountOwnershipEvidencePresent',
        'accountInventoryDecisionReady',
        'impersonationMonitoringReady',
        'publishingReady',
        'publicationReady',
        'campaignPackageValid',
        'campaignId',
        'sourceContentPackageRef',
        'variantCount',
        'channelCount',
        'claimCount',
        'literalClaimEvidenceCount',
        'proofCount',
        'customerEvidenceCount',
        'generatedAssetCount',
        'approvedTrackingUrlCount',
        'publicationGateCount',
        'publicationAuthorized',
        'credentialConnectionAuthorized',
        'publishingAuthorized',
        'replyingAuthorized',
        'paidPromotionAuthorized',
        'audienceLanguageContractValid',
        'sourceAuditPerformed',
        'sourceBindingCount',
        'currentSourcePassCount',
        'currentSourceFailureCount',
        'audienceProfileCount',
        'referenceExampleCount',
        'referenceExamplePassCount',
        'supportDirectAnswerPassCount',
        'sensitiveExplanationPassCount',
        'jargonHitCount',
        'unexplainedAcronymCount',
        'longSentenceCount',
        'pressureLanguageCount',
        'patronisingLanguageCount',
        'blockedAbsoluteCount',
        'adversarialScenarioCount',
        'adversarialRefusalCount',
        'currentSourceAuditReady',
        'readyForHumanReview',
        'humanReviewRequired',
        'automatedApprovalEnabled',
        'publicationReady',
        'supportSendAuthorized',
        'replyAuthorized',
        'inboundTriageContractValid',
        'triageRehearsalPerformed',
        'syntheticCaseCount',
        'passedSyntheticCaseCount',
        'urgentCaseCount',
        'restrictedCaseCount',
        'personalDataDetectionCount',
        'rawMessageRetentionCount',
        'autonomousReplyCount',
        'externalActionCount',
        'categoryCount',
        'inboundTriageReadyForReview',
        'liveInboxReady',
        'replySendAuthorized',
        'directMinorContactAuthorized',
        'marketingReuseAuthorized'
        ,
        'groundedDraftingContractValid',
        'draftingRehearsalPerformed',
        'articleCount',
        'plainLanguagePassCount',
        'syntheticCaseCount',
        'acceptedDraftCount',
        'refusedDraftCount',
        'sourceBoundDraftCount',
        'humanReviewRequiredCount',
        'rawMessageRetentionCount',
        'replySendCount',
        'externalActionCount',
        'knowledgeBaseApproved',
        'groundedDraftingReadyForReview',
        'liveSupportDraftingReady',
        'liveInboxConnected',
        'replySendAuthorized',
        'directMinorContactAuthorized'
        ,
        'tagImplementationReadyForReview',
        'measurementId',
        'scope',
        'defaultConsent',
        'visitorChoiceRequired',
        'pageViewBeforeChoice',
        'adFeaturesOff',
        'publicRouteCount',
        'excludedGameRouteCount',
        'sourceCheckCount',
        'prohibitedDataFieldCount',
        'gameSourceTagHits',
        'hostingPolicyCount',
        'productionDeployed',
        'verifiedDeployId',
        'homepageTagScriptObserved',
        'gameRuntimeTagScriptObserved',
        'freshBrowserConsentJourneyVerified',
        'googlePropertyEventsVerified',
        'measurementTrustedForDecisions'
    ];
    const summary = {};
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(parsed, key)) summary[key] = parsed[key];
    }
    if (Array.isArray(parsed.failures)) summary.failureCount = parsed.failures.length;
    if (Array.isArray(parsed.warnings)) summary.warningCount = parsed.warnings.length;
    if (Array.isArray(parsed.authorizationGates)) summary.authorizationGateCount = parsed.authorizationGates.length;
    if (parsed.workflow === 'A-001') {
        summary.highestSeverity = parsed.highestSeverity;
        summary.publicAudit = parsed.summary;
    }
    return summary;
}

function execute(control) {
    const result = spawnSync(process.execPath, control.command, {
        cwd: repositoryRoot,
        encoding: 'utf8',
        timeout: 60_000,
        maxBuffer: 5 * 1024 * 1024
    });
    const exitCode = typeof result.status === 'number' ? result.status : 1;
    const expectedExitCodes = control.expectedExitCodes || [0, 2];
    const broken = result.error || !expectedExitCodes.includes(exitCode);
    let parsed = null;
    let parseError = null;
    if (control.output === 'json' && result.stdout.trim()) {
        try {
            parsed = JSON.parse(result.stdout);
        } catch (error) {
            parseError = error.message;
        }
    }
    const invalidOutput = control.output === 'json' && (!parsed || parseError);
    return {
        id: control.id,
        command: `node ${control.command.join(' ')}`,
        state: broken || invalidOutput ? 'broken' : exitCode === 2 ? 'gated' : 'passed',
        exitCode,
        summary: parsed ? compact(parsed) : {
            outputProduced: result.stdout.trim().length > 0,
            outputBytes: Buffer.byteLength(result.stdout || '', 'utf8')
        },
        error: result.error?.message || parseError || result.stderr.trim() || null
    };
}

const runs = controls.map(execute);
const brokenRuns = runs.filter(run => run.state === 'broken');
const gatedRuns = runs.filter(run => run.state === 'gated');
const implementedWorkflowIds = new Set(
    (registry.workflows || []).filter(workflow => workflow.implementation).map(workflow => workflow.id)
);
const skippedWorkflows = (registry.workflows || [])
    .filter(workflow => !implementedWorkflowIds.has(workflow.id) || (workflow.id === 'A-001' && !includeOnline))
    .map(workflow => ({
        id: workflow.id,
        status: workflow.status,
        blocking: workflow.id !== 'A-001',
        reason: workflow.id === 'A-001' && !includeOnline
            ? 'Online public read omitted; rerun with --online.'
            : 'No implementation is registered.'
    }));
const metaWorkflowsNotInvoked = (registry.workflows || [])
    .filter(workflow => ['A-012', 'A-015', 'A-016', 'A-017'].includes(workflow.id))
    .map(workflow => ({
        id: workflow.id,
        reason: workflow.id === 'A-012'
            ? 'A-012 is the current runner and does not invoke itself.'
            : workflow.id === 'A-015'
                ? 'A-015 wraps A-012 with a live baseline comparison and is run separately to avoid recursion.'
                : workflow.id === 'A-016'
                    ? 'A-016 wraps A-015 to build a minimal run record and is run separately to avoid recursive orchestration.'
                    : 'A-017 wraps A-015 to propose baseline changes and is run separately to avoid recursive orchestration.'
    }));

const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
const openRisks = (risks.risks || [])
    .filter(risk => risk.status === 'open')
    .sort((left, right) => severityRank[right.severity] - severityRank[left.severity]);
const topActions = openRisks.slice(0, 7).map(risk => ({
    id: risk.id,
    severity: risk.severity,
    owner: risk.owner,
    due: risk.due,
    action: risk.nextAction
}));

const externalActionAuthorized = runs.some(run =>
    run.summary.externalActionAuthorized === true ||
    run.summary.externalActionsAuthorized === true ||
    run.summary.externalPublishingAuthorized === true ||
    run.summary.authorizedForPublication === true
);
const controlPlaneHealthy = brokenRuns.length === 0;
const companyReady = controlPlaneHealthy &&
    gatedRuns.length === 0 &&
    skippedWorkflows.every(workflow => workflow.blocking === false);

const output = {
    workflow: 'A-012',
    generatedAt: new Date().toISOString(),
    mode: {
        onlinePublicReadIncluded: includeOnline,
        evaluationSuitesIncluded: includeVerification,
        externalWritesPermitted: false
    },
    controlPlaneHealthy,
    companyReady,
    externalActionAuthorized,
    registeredWorkflowCount: (registry.workflows || []).length,
    runCount: runs.length,
    passedRunCount: runs.filter(run => run.state === 'passed').length,
    gatedRunCount: gatedRuns.length,
    brokenRunCount: brokenRuns.length,
    runs,
    skippedWorkflows,
    metaWorkflowsNotInvoked,
    topActions,
    kevinDecisionQueue: [...(decisionQueue.packets || [])]
        .sort((left, right) => left.priority - right.priority)
        .map(packet => ({
            id: packet.decisionId,
            packetId: packet.id,
            priority: packet.priority,
            severity: packet.severity,
            decision: packet.decision,
            recommendation: packet.recommendation,
            whyNow: packet.whyNow,
            evidenceRefs: packet.evidenceRefs,
            riskIfDeferred: packet.riskIfDeferred,
            scopeAndCost: packet.scopeAndCost,
            reviewBoundary: packet.approvalExpiry,
            decisionIsAuthorization: false,
            externalActionAuthorized: false,
            mayExecuteOnResponse: false
        })),
    gameDevelopmentHandoffs: currentState.handoffs || [],
    nextSystemAction: brokenRuns.length
        ? 'Repair broken controls before trusting the company state.'
        : 'Continue safe internal pilots; do not bypass the listed evidence, ownership, policy, or approval gates.'
};

console.log(JSON.stringify(output, null, 2));
if (!controlPlaneHealthy) process.exitCode = 1;
else if (!companyReady) process.exitCode = 2;
