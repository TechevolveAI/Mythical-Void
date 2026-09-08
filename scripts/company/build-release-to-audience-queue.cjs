#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const defaults = {
    releases: path.join(root, 'public/updates/releases.json'),
    releasePack: path.join(root, 'docs/company/content/generated/signal-log-release-pack.json'),
    communityRun: path.join(root, 'docs/company/growth/COMMUNITY_DISCOVERY_RUN_2026-09-08.json'),
    phaserShowcase: path.join(root, 'docs/company/growth/PHASER_SHOWCASE_ACTIVATION_2026-09-08.json'),
    channels: path.join(root, 'docs/company/content/channels.json'),
    visualPlan: path.join(root, 'docs/company/content/visual-launch-moments.json'),
    socialIdentity: path.join(root, 'docs/company/content/channel-launch/SOCIAL_IDENTITY_RESERVATION_2026-09-08.json'),
    discoveryDoorways: path.join(root, 'docs/company/growth/DISCOVERY_DOORWAY_REGISTRY_2026-09-08.json'),
    output: path.join(root, 'docs/company/content/generated/release-to-audience-queue.json')
};

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fingerprint(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function buildReleaseToAudienceQueue(inputs) {
    const { releases, releasePack, communityRun, phaserShowcase, channels, visualPlan, socialIdentity, discoveryDoorways } = inputs;
    const liveEntries = (releases.entries || []).filter(entry => entry.status === 'live');
    const liveById = new Map(liveEntries.map(entry => [entry.id, entry]));
    const approvedVisuals = (visualPlan.moments || []).filter(moment => moment.reviewStatus === 'approved_by_adult');
    const verifiedExternalChannels = (channels.channels || []).filter(channel => channel.kind !== 'owned_web' && channel.publishingCredential === true);
    const newestTextFirstItem = (releasePack.items || []).find(item => {
        const source = liveById.get(item.sourceEntryId);
        return source && !source.image && !source.imageClass;
    }) || releasePack.items?.[0] || null;

    return {
        schemaVersion: 1,
        id: 'RELEASE-TO-AUDIENCE-QUEUE-2026-09-08',
        state: 'one_text_only_community_move_waiting_for_kevin',
        purpose: 'Turn checked releases and prepared community work into one clear next move, while keeping accounts, replies and publication under human control.',
        generatedFrom: {
            liveLatestNewsEntries: liveEntries.length,
            preparedReleaseDrafts: (releasePack.items || []).length * 3,
            approvedGameplayVisuals: approvedVisuals.length,
            verifiedExternalPublishingChannels: verifiedExternalChannels.length,
            checkedDiscoveryDoorways: (discoveryDoorways.routes || []).length,
            sourceFingerprints: {
                releases: fingerprint(releases),
                releasePack: fingerprint(releasePack),
                communityRun: fingerprint(communityRun),
                phaserShowcase: fingerprint(phaserShowcase),
                channels: fingerprint(channels),
                visualPlan: fingerprint(visualPlan),
                socialIdentity: fingerprint(socialIdentity),
                discoveryDoorways: fingerprint(discoveryDoorways)
            }
        },
        nextMove: {
            rank: 1,
            id: communityRun.id,
            route: communityRun.community,
            state: 'waiting_for_kevin_action_time_approval',
            whyThisIsNext: 'It reaches people actively looking for browser games, uses the live game link, needs no weak artwork and runs as one measured experiment rather than a spray of posts.',
            exactPost: communityRun.preparedPost,
            mediaAttached: communityRun.preflight.gameplayMediaAttached,
            manualMediaAttached: communityRun.preflight.manualMediaAttached,
            automaticLinkPreviewExpected: communityRun.preflight.automaticLinkPreviewExpected,
            automaticLinkPreviewCheckedAt: communityRun.preflight.automaticLinkPreviewCheckedAt,
            trackingParametersPresent: communityRun.preflight.trackingParametersPresent,
            approvalNeeded: [
                'Kevin confirms the adult Reddit account to use.',
                'Kevin approves this exact title, link and first comment at the time of posting.',
                'Kevin confirms that he can read and answer replies himself.'
            ],
            automationMayDoNow: [
                'Recheck the current community rules and duplicate search immediately before an approved post.',
                'Check that the live game opens and the opening journey still works.',
                'Record anonymous totals at day 2 and day 7 after a real post.'
            ],
            automationMayNotDo: [
                'Open or use Kevin’s account without his confirmation.',
                'Publish, reply, ask for votes or create fake activity.',
                'Call post views or website visits players or plays.'
            ]
        },
        afterThat: {
            rank: 2,
            id: phaserShowcase.id,
            route: phaserShowcase.community.name,
            state: 'waiting_until_first_community_read_finishes_or_is_cancelled',
            exactTopic: phaserShowcase.preparedTopic,
            reason: phaserShowcase.sequence.reason,
            nextRequiredAction: phaserShowcase.nextRequiredAction
        },
        widerDoorwayQueue: {
            source: 'docs/company/growth/DISCOVERY_DOORWAY_REGISTRY_2026-09-08.json',
            checkedOn: discoveryDoorways.checkedOn,
            checkedRoutes: (discoveryDoorways.routes || []).length,
            immediateRoutes: (discoveryDoorways.routes || []).filter(route => route.state === 'ready_waiting_for_kevin_action_time_approval').map(route => route.name),
            laterRoutes: (discoveryDoorways.routes || []).slice(2).map(route => ({
                order: route.order,
                name: route.name,
                kind: route.kind,
                state: route.state,
                nextNeed: route.nextNeed
            })),
            rule: 'This is an ordered opportunity queue, not permission to cross-post. Recheck current rules and request action-time approval for every outside move.'
        },
        latestReleaseDraft: newestTextFirstItem ? {
            sourceEntryId: newestTextFirstItem.sourceEntryId,
            title: liveById.get(newestTextFirstItem.sourceEntryId)?.title,
            state: 'prepared_not_publishable_until_an_official_channel_is_confirmed',
            selectionReason: 'Newest checked release that can travel as text without depending on gameplay media.',
            professionalNetworkDraft: newestTextFirstItem.drafts.professionalNetwork,
            destination: newestTextFirstItem.destination,
            releaseProof: newestTextFirstItem.releaseProof,
            approvalState: newestTextFirstItem.approval.state
        } : null,
        holds: [
            {
                area: 'gameplay-led social and video',
                state: 'held',
                reason: visualPlan.state,
                releaseCondition: 'A person approves the exact real-game moment, wording and channel.'
            },
            {
                area: 'official social accounts',
                state: 'held',
                reason: `${socialIdentity.publicAudit.officialAccountsConfirmed} official accounts confirmed`,
                releaseCondition: socialIdentity.nextRequiredAction
            },
            {
                area: 'second community post',
                state: 'held',
                reason: 'One community experiment at a time keeps the learning honest and avoids spam.',
                releaseCondition: 'Finish the r/WebGames seven-day read or explicitly cancel that route.'
            }
        ],
        truthRules: communityRun.truthRules,
        authority: {
            accountCreationAuthorized: false,
            platformTermsAcceptanceAuthorized: false,
            externalPublishingAuthorized: false,
            automatedRepliesAuthorized: false,
            paidPromotionAuthorized: false,
            fakeEngagementAuthorized: false,
            childContactAuthorized: false,
            externalActionTaken: false
        }
    };
}

function loadDefaults() {
    return {
        releases: readJson(defaults.releases),
        releasePack: readJson(defaults.releasePack),
        communityRun: readJson(defaults.communityRun),
        phaserShowcase: readJson(defaults.phaserShowcase),
        channels: readJson(defaults.channels),
        visualPlan: readJson(defaults.visualPlan),
        socialIdentity: readJson(defaults.socialIdentity),
        discoveryDoorways: readJson(defaults.discoveryDoorways)
    };
}

if (require.main === module) {
    const output = process.argv[2] ? path.resolve(process.argv[2]) : defaults.output;
    const queue = buildReleaseToAudienceQueue(loadDefaults());
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(queue, null, 2)}\n`);
    console.log(`Built one next audience move from ${queue.generatedFrom.liveLatestNewsEntries} live updates and ${queue.generatedFrom.preparedReleaseDrafts} prepared drafts.`);
}

module.exports = { buildReleaseToAudienceQueue, defaults, fingerprint, loadDefaults };
