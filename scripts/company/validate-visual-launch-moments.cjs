#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const defaultPath = path.join(
    root,
    'docs/company/content/visual-launch-moments.json'
);
const candidateCaptureSource = fs.readFileSync(
    path.join(root, 'scripts/company/prepare-visual-launch-candidates.cjs'),
    'utf8'
);

function validateVisualLaunchMoments(document) {
    const failures = [];
    const requireValue = (condition, message) => {
        if (!condition) failures.push(message);
    };
    const authority = document?.authority || {};
    const contract = document?.sharedCaptureContract || {};
    const captureProcess = document?.studioCaptureProcess || {};
    const candidateRun = document?.latestPrivateCandidateRun || null;
    const kevinReview = document?.latestKevinReview || null;
    const moments = Array.isArray(document?.moments) ? document.moments : [];

    requireValue(document?.schemaVersion === 1, 'schemaVersion must be 1');
    requireValue(
        /^\d{4}-\d{2}-\d{2}$/.test(document?.asOf || ''),
        'asOf must be an ISO date'
    );
    requireValue(
        document?.candidateDirectory === '.visual-review/candidates/',
        'candidateDirectory must remain private'
    );
    requireValue(
        document?.candidateDirectoryIsWebsiteContent === false,
        'candidate directory must not be website content'
    );
    requireValue(
        authority.automationMayPrepareCandidates === true &&
        authority.automationMayRejectObviousFaults === true,
        'automation may prepare and reject candidates'
    );
    requireValue(
        authority.automationMayApproveCandidates === false,
        'automation must never approve visual candidates'
    );
    requireValue(
        authority.adultFrameReviewRequired === true,
        'adult frame review must remain required'
    );
    requireValue(
        authority.kevinApprovalRequiredForExactAssetWordingAndChannel === true,
        'Kevin approval must cover the exact asset, wording and channel'
    );
    requireValue(
        authority.externalPublicationAuthorized === false,
        'external publication must remain unauthorized'
    );
    requireValue(
        candidateCaptureSource.includes('function createFrameReviewSheets(videoRecord)') &&
        candidateCaptureSource.includes('everyFrameIncluded: true') &&
        candidateCaptureSource.includes('adultApprovalGranted: false') &&
        candidateCaptureSource.includes("path.join(candidateRoot, 'frame-review')"),
        'private video candidates must include complete non-approving frame-review sheets'
    );
    if (candidateRun) {
        requireValue(
            /^\d{4}-\d{2}-\d{2}T/.test(candidateRun.createdAt || '') &&
            /^[a-f0-9]{40}$/.test(candidateRun.sourceCommit || '') &&
            candidateRun.sourceProfileId === contract.profileId &&
            candidateRun.renderer === contract.renderer,
            'private candidate run must identify its source build, profile and renderer'
        );
        requireValue(
            /^\.visual-review\/candidates\/[^/]+\/manifest\.json$/.test(
                candidateRun.manifest || ''
            ),
            'private candidate manifest must remain in the review quarantine'
        );
        requireValue(
            [
                'passed_obvious_fault_checks_only',
                'failed_technical_and_obvious_visual_checks'
            ].includes(candidateRun.automatedScreening) &&
            [
                'pending_adult_frame_review',
                'rejected_obvious_visual_faults'
            ].includes(candidateRun.editorialScreening) &&
            ['pending', 'not_requested'].includes(candidateRun.adultFrameReview) &&
            candidateRun.kevinApproval === 'not_requested' &&
            candidateRun.movementReview ===
                'rejected_by_kevin_recapture_required' &&
            candidateRun.publicationAuthorized === false,
            'candidate run cannot imply human approval or publication authority'
        );
    }
    requireValue(
        kevinReview?.runId === candidateRun?.runId &&
        kevinReview?.momentId === 'VL-004' &&
        kevinReview?.decision === 'reject_and_recapture' &&
        Array.isArray(kevinReview?.requiredReplacementEvidence) &&
        kevinReview.requiredReplacementEvidence.length === 5 &&
        kevinReview?.publicationAuthorized === false,
        'Kevin movement rejection and recapture requirements must be recorded'
    );
    requireValue(
        contract.source === 'real_running_production_build' &&
        contract.fixture === 'company_controlled_real_creature_profile' &&
        contract.profileId === 'MV-0813' &&
        contract.renderer === 'player_facing_phaser_creature_renderer',
        'capture source, profile or renderer boundary changed'
    );

    const viewports = new Map(
        (contract.requiredViewports || []).map(viewport => [viewport.id, viewport])
    );
    requireValue(
        viewports.get('phone')?.width === 390 &&
        viewports.get('phone')?.height === 844 &&
        viewports.get('desktop')?.width === 1440 &&
        viewports.get('desktop')?.height === 810,
        'phone and desktop review dimensions are required'
    );
    requireValue(
        contract.actorMinimumGapPx?.phone === 24 &&
        contract.actorMinimumGapPx?.desktop === 36,
        'phone and desktop actor-separation floors are required'
    );
    requireValue(
        contract.movementMinimumDurationSeconds === 6 &&
        contract.movementMinimumFrames === 72,
        'movement must provide at least six seconds and 72 captured frames'
    );
    const visualBar = new Set(contract.minimumVisualBar || []);
    for (const requirement of [
        'creature_body_recognisable_at_phone_size',
        'astronaut_and_creature_do_not_overlap_or_read_as_one_actor',
        'important_action_inside_clean_central_frame',
        'instructions_do_not_cover_action',
        'real_creature_profile_uses_player_renderer',
        'one_screenshot_communicates_one_moment'
    ]) {
        requireValue(visualBar.has(requirement), `missing visual bar: ${requirement}`);
    }
    const rejectionChecks = new Set(contract.automaticRejectionChecks || []);
    for (const requirement of [
        'uncaught_runtime_exception',
        'failed_smoke_contract',
        'fallback_or_missing_creature_texture',
        'inactive_or_invisible_creature',
        'astronaut_missing',
        'actor_overlap',
        'action_outside_central_safe_frame',
        'modal_or_menu_interrupts_action',
        'caption_only_proof_without_visible_world_action',
        'choice_capture_omits_plain_pre_choice_options',
        'strange_discovery_does_not_link_both_actors',
        'movement_renderer_changes_between_frames',
        'movement_world_travel_too_small',
        'movement_camera_travel_too_small',
        'movement_has_no_direction_change',
        'movement_has_only_one_airborne_action',
        'movement_idle_or_single_action_dominates',
        'capture_dimensions_wrong',
        'video_too_short_or_missing_frames'
    ]) {
        requireValue(
            rejectionChecks.has(requirement),
            `missing automatic rejection check: ${requirement}`
        );
    }
    requireValue(
        captureProcess.candidateRunDirectory === '.visual-review/candidates/' &&
        captureProcess.candidateRunDirectoryIsWebsiteContent === false,
        'studio candidates must remain in the private review directory'
    );
    requireValue(
        captureProcess.automationMayPrepareCandidates === true &&
        captureProcess.automationMayRejectObviousFaults === true &&
        captureProcess.automationMayApproveCandidates === false,
        'studio automation may prepare and reject but never approve candidates'
    );
    requireValue(
        captureProcess.adultReview?.everyFrameMustBeWatched === true &&
        captureProcess.adultReview?.decisionMustBeRecordedPerAsset === true &&
        JSON.stringify(captureProcess.adultReview?.decisionOptions) ===
            JSON.stringify(['approve_for_kevin_review', 'reject', 'recapture']),
        'adult review must watch every frame and record a decision for each asset'
    );
    requireValue(
        captureProcess.kevinApproval?.exactAssetRequired === true &&
        captureProcess.kevinApproval?.exactWordingRequired === true &&
        captureProcess.kevinApproval?.exactChannelRequired === true &&
        captureProcess.kevinApproval?.requiredBeforeAnythingLeavesOwnedWebsite === true,
        'Kevin must approve the exact asset, wording and channel before publication'
    );

    requireValue(moments.length === 4, 'exactly four launch moments are required');
    const expectedMoments = {
        'VL-001': {
            playableState: 'sanctuary_worker_check_in_and_delivery',
            implementationStatus: 'playable_state_available',
            evidence: [
                'astronaut_and_creature_face_one_obvious_problem_together',
                'creature_action_is_recognisable',
                'result_appears_in_the_same_uninterrupted_shot'
            ],
            observableStateGate: {
                problem: 'blocked_food_route',
                action: 'creature_sends_life_energy',
                result: 'safe_food_route_open_with_regrowth_and_5_happiness',
                actionOrigin: 'creature_body',
                resolvedObstacleRemainsReadable: true
            }
        },
        'VL-002': {
            playableState: 'sanctuary_heart_choice',
            implementationStatus: 'playable_state_available',
            evidence: [
                'choice_is_stated_in_plain_words',
                'consequence_is_visible_after_the_menu_closes',
                'world_or_relationship_change_persists'
            ],
            observableStateGate: {
                before: 'both_plain_language_options_visible_before_selection',
                selection: 'clear_the_current_first',
                after: 'living_route_reopens_and_memory_persists_in_world',
                worldEffects: [
                    'bright_living_route',
                    'visible_regrowth',
                    'persistent_memory'
                ]
            }
        },
        'VL-003': {
            playableState: 'village_heart_living_memory',
            implementationStatus: 'playable_state_available',
            evidence: [
                'mythical_void_specific_memory_or_current_behavior',
                'astronaut_and_creature_remain_visible',
                'discovery_is_part_of_the_world_not_background_art'
            ],
            observableStateGate: {
                phenomenon: 'memory_rain_rises_v2',
                linkedActors: 2,
                worldAnchor: 'village_heart',
                upwardMemoryDropsMinimum: 16,
                livingFlora: 'listening_reeds'
            }
        },
        'VL-004': {
            playableState: 'mythical_forest_normal_movement',
            implementationStatus: 'capture_contract_revised_recapture_pending',
            evidence: [
                'continuous_normal_play',
                'creature_stays_fully_rendered_and_recognisable',
                'no_placeholder_missing_sprite_menu_dead_pause_or_explanatory_edit'
            ],
            observableStateGate: {
                minimumFrames: 72,
                minimumDurationSeconds: 6,
                minimumActorGapPx: { phone: 24, desktop: 36 },
                minimumWorldTravelPx: 320,
                minimumCameraTravelPx: 180,
                minimumRightwardSamples: 3,
                minimumLeftwardSamples: 3,
                minimumAirborneSamples: 1,
                minimumAirbornePhases: 2,
                minimumGroundedSamples: 3,
                minimumMovingSampleRatio: 0.7,
                minimumDistinctMovementPhases: 4,
                renderer: 'player_facing_phaser_creature_renderer',
                fallbackFramesAllowed: 0,
                actorOverlapFramesAllowed: 0
            }
        }
    };
    const expectedIds = Object.keys(expectedMoments);
    const ids = new Set(moments.map(moment => moment.id));
    for (const id of expectedIds) {
        requireValue(ids.has(id), `missing launch moment ${id}`);
    }
    for (const moment of moments) {
        const label = moment?.id || 'unknown moment';
        const expected = expectedMoments[moment?.id];
        requireValue(
            typeof moment?.title === 'string' && moment.title.trim(),
            `${label} needs a title`
        );
        requireValue(
            typeof moment?.plainLanguageBeat === 'string' &&
            moment.plainLanguageBeat.length <= 150,
            `${label} needs a concise plain-language beat`
        );
        requireValue(
            Array.isArray(moment?.requiredEvidence) &&
            moment.requiredEvidence.length === 3,
            `${label} must define three observable requirements`
        );
        requireValue(
            Boolean(expected) && moment?.playableState === expected.playableState,
            `${label} playable state changed or is not implemented`
        );
        requireValue(
            Boolean(expected) &&
            moment?.implementationStatus === expected.implementationStatus,
            `${label} implementation status changed`
        );
        requireValue(
            Boolean(expected) &&
            expected.evidence.every(item => moment.requiredEvidence?.includes(item)),
            `${label} observable evidence contract changed`
        );
        requireValue(
            Boolean(expected) &&
            JSON.stringify(moment?.observableStateGate) ===
                JSON.stringify(expected.observableStateGate),
            `${label} observable state gate changed`
        );
        requireValue(
            [
                'capture_pending',
                'candidate_under_human_review',
                'candidate_rejected_obvious_visual_faults',
                'candidate_rejected_by_kevin_recapture_required'
            ].includes(
                moment?.reviewStatus
            ),
            `${label} cannot claim review or approval before human review`
        );
        if ([
            'candidate_under_human_review',
            'candidate_rejected_obvious_visual_faults',
            'candidate_rejected_by_kevin_recapture_required'
        ].includes(moment?.reviewStatus)) {
            requireValue(
                Boolean(candidateRun),
                `${label} needs a recorded private candidate run`
            );
        }
        requireValue(
            Object.values(moment?.candidateAssets || {}).every(filename => (
                typeof filename === 'string' &&
                !filename.includes('/') &&
                /\.(?:png|mp4)$/.test(filename)
            )),
            `${label} candidate assets must stay inside the private run directory`
        );
    }

    requireValue(
        /^docs\/company\/content\/visual-screening-\d{4}-\d{2}-\d{2}\.json$/.test(document?.latestScreening?.path || '') &&
        /^[0-9a-f]{40}$/.test(document?.latestScreening?.sourceCommit || '') &&
        document?.latestScreening?.decision === 'all_four_rejected_before_kevin_review' &&
        document?.latestScreening?.kevinReviewRequested === false,
        'latest screening decision is missing or incorrectly asks Kevin to review rejected work'
    );
    const screeningMatchesCurrentRun =
        candidateRun?.runId === document?.latestScreening?.candidateRunId &&
        candidateRun?.sourceCommit === document?.latestScreening?.sourceCommit;
    const currentRunRejected = moments.every(moment => (
        moment?.reviewStatus === 'candidate_rejected_obvious_visual_faults'
    ));
    const sourceChangedReplacementPending = moments.every(moment => (
        moment?.reviewStatus === 'candidate_under_human_review' ||
        (
            moment?.id === 'VL-004' &&
            moment?.reviewStatus ===
                'candidate_rejected_by_kevin_recapture_required'
        )
    ));
    requireValue(
        (
            screeningMatchesCurrentRun &&
            currentRunRejected &&
            candidateRun?.editorialScreening === 'rejected_obvious_visual_faults' &&
            ['pending', 'not_requested'].includes(candidateRun?.adultFrameReview)
        ) || (
            !screeningMatchesCurrentRun &&
            sourceChangedReplacementPending &&
            candidateRun?.editorialScreening === 'pending_adult_frame_review'
        ),
        'current candidates must be either the recorded rejection or a source-changed private replacement pending human review'
    );

    return {
        valid: failures.length === 0,
        momentCount: moments.length,
        externalPublicationAuthorized:
            authority.externalPublicationAuthorized === true,
        automatedApprovalPermitted:
            authority.automationMayApproveCandidates === true,
        failures
    };
}

if (require.main === module) {
    const sourcePath = process.argv[2]
        ? path.resolve(process.argv[2])
        : defaultPath;
    const document = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const result = validateVisualLaunchMoments(document);
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exitCode = 1;
}

module.exports = { defaultPath, validateVisualLaunchMoments };
