#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const defaultPath = path.join(
    root,
    'docs/company/content/visual-launch-moments.json'
);

function validateVisualLaunchMoments(document) {
    const failures = [];
    const requireValue = (condition, message) => {
        if (!condition) failures.push(message);
    };
    const authority = document?.authority || {};
    const contract = document?.sharedCaptureContract || {};
    const candidateRun = document?.latestPrivateCandidateRun || null;
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
            candidateRun.automatedScreening === 'passed_obvious_fault_checks_only' &&
            [
                'pending_adult_frame_review',
                'rejected_obvious_visual_faults'
            ].includes(candidateRun.editorialScreening) &&
            candidateRun.adultFrameReview === 'pending' &&
            candidateRun.kevinApproval === 'not_requested' &&
            candidateRun.publicationAuthorized === false,
            'candidate run cannot imply human approval or publication authority'
        );
    }
    requireValue(
        contract.source === 'real_running_production_build' &&
        contract.fixture === 'company_controlled_real_creature_profile' &&
        contract.profileId === 'MV-0813' &&
        contract.renderer === 'player_facing_phaser_creature_renderer',
        'capture source, profile or renderer boundary changed'
    );

    const viewportIds = new Set(
        (contract.requiredViewports || []).map(viewport => viewport.id)
    );
    requireValue(
        viewportIds.has('phone') && viewportIds.has('desktop'),
        'phone and desktop review viewports are required'
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
                result: 'safe_food_route_open_with_regrowth_and_5_happiness'
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
                after: 'living_route_reopens_and_memory_persists_in_world'
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
                phenomenon: 'living_current_remembers_choice_v1',
                linkedActors: 2,
                worldAnchor: 'village_heart'
            }
        },
        'VL-004': {
            playableState: 'mythical_forest_normal_movement',
            implementationStatus: 'capture_journey_ready',
            evidence: [
                'continuous_normal_play',
                'creature_stays_fully_rendered_and_recognisable',
                'no_placeholder_missing_sprite_menu_dead_pause_or_explanatory_edit'
            ],
            observableStateGate: {
                minimumFrames: 20,
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
                'candidate_rejected_obvious_visual_faults'
            ].includes(
                moment?.reviewStatus
            ),
            `${label} cannot claim review or approval before human review`
        );
        if (['candidate_under_human_review', 'candidate_rejected_obvious_visual_faults'].includes(moment?.reviewStatus)) {
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
        moment?.reviewStatus === 'candidate_under_human_review'
    ));
    requireValue(
        (
            screeningMatchesCurrentRun &&
            currentRunRejected &&
            candidateRun?.editorialScreening === 'rejected_obvious_visual_faults'
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
