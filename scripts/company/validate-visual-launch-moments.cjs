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
    const expectedIds = ['VL-001', 'VL-002', 'VL-003', 'VL-004'];
    const ids = new Set(moments.map(moment => moment.id));
    for (const id of expectedIds) {
        requireValue(ids.has(id), `missing launch moment ${id}`);
    }
    for (const moment of moments) {
        const label = moment?.id || 'unknown moment';
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
            moment?.reviewStatus === 'capture_pending',
            `${label} cannot claim review or approval before capture`
        );
        requireValue(
            Object.values(moment?.candidateAssets || {}).every(filename => (
                typeof filename === 'string' &&
                !filename.includes('/') &&
                /\.(?:png|mp4)$/.test(filename)
            )),
            `${label} candidate assets must stay inside the private run directory`
        );
    }

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
