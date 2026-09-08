#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildReleaseToAudienceQueue, defaults, loadDefaults } = require('./build-release-to-audience-queue.cjs');

const queuePath = process.argv[2] ? path.resolve(process.argv[2]) : defaults.output;
const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
const inputs = loadDefaults();
const expected = buildReleaseToAudienceQueue(inputs);
const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };

requireValue(JSON.stringify(queue) === JSON.stringify(expected), 'Audience queue is stale or contains hand-written drift; rebuild it from the checked source records.');
requireValue(queue.schemaVersion === 1 && queue.state === 'one_text_only_community_move_waiting_for_kevin', 'Audience queue state is invalid.');
requireValue(queue.generatedFrom?.liveLatestNewsEntries === inputs.releasePack.generatedFrom?.liveEntryCount, 'Latest News and prepared release drafts are out of sync.');
requireValue(queue.generatedFrom?.preparedReleaseDrafts === queue.generatedFrom?.liveLatestNewsEntries * 3, 'Every live update must have exactly three prepared source drafts.');
requireValue(queue.generatedFrom?.approvedGameplayVisuals === 0, 'Queue must not invent gameplay visual approval.');
requireValue(queue.generatedFrom?.verifiedExternalPublishingChannels === 0, 'Queue must not invent a verified external publishing channel.');
requireValue(queue.generatedFrom?.checkedDiscoveryDoorways === 13, 'The wider discovery queue is incomplete.');
requireValue(queue.nextMove?.route === 'r/WebGames' && queue.nextMove?.state === 'waiting_for_kevin_action_time_approval', 'The one agreed first community route is missing or out of order.');
requireValue(queue.nextMove?.exactPost?.url === 'https://mythicalvoid.com/play/', 'First route must use the clean direct game link.');
requireValue(queue.nextMove?.mediaAttached === false && queue.nextMove?.manualMediaAttached === false && queue.nextMove?.trackingParametersPresent === false, 'First route must remain free of attached media and tracking.');
requireValue(queue.nextMove?.automaticLinkPreviewExpected === 'https://mythicalvoid.com/marketing/mythical-void-brand-link-card-v1.png', 'First route must expect the labelled emblem brand card.');
requireValue(queue.nextMove?.automaticLinkPreviewCheckedAt === null, 'Unpublished queue must not invent a live automatic-preview check.');
requireValue(queue.nextMove?.approvalNeeded?.length === 3, 'Kevin account, exact-post and reply-coverage decisions must all remain explicit.');
requireValue(queue.afterThat?.route === 'Phaser Showcase' && /waiting_until_first_community_read/.test(queue.afterThat?.state || ''), 'The second community route must wait for the first read.');
requireValue(queue.widerDoorwayQueue?.source === 'docs/company/growth/DISCOVERY_DOORWAY_REGISTRY_2026-09-08.json', 'The wider doorway queue is detached from its checked source.');
requireValue(queue.widerDoorwayQueue?.checkedRoutes === 13 && queue.widerDoorwayQueue?.laterRoutes?.length === 11, 'The wider doorway queue count is incomplete.');
requireValue(queue.widerDoorwayQueue?.immediateRoutes?.join('|') === 'r/WebGames', 'The wider queue must expose exactly one immediate route.');
requireValue(/not permission to cross-post/i.test(queue.widerDoorwayQueue?.rule || ''), 'The wider queue is missing its no-cross-post boundary.');
requireValue(queue.latestReleaseDraft?.sourceEntryId === expected.latestReleaseDraft?.sourceEntryId, 'The current text-first Latest News hand-off has drifted.');
requireValue(queue.latestReleaseDraft?.state === 'prepared_not_publishable_until_an_official_channel_is_confirmed', 'Latest release draft must not imply publication readiness.');
requireValue(queue.latestReleaseDraft?.releaseProof?.gameplayVisualApproved === false && queue.latestReleaseDraft?.releaseProof?.mediaAttached === false, 'Latest release hand-off must retain its visual and media boundary.');

for (const [field, expectedValue] of Object.entries({
    accountCreationAuthorized: false,
    platformTermsAcceptanceAuthorized: false,
    externalPublishingAuthorized: false,
    automatedRepliesAuthorized: false,
    paidPromotionAuthorized: false,
    fakeEngagementAuthorized: false,
    childContactAuthorized: false,
    externalActionTaken: false
})) requireValue(queue.authority?.[field] === expectedValue, `authority.${field} must remain false.`);

const publicDraftText = JSON.stringify({
    next: queue.nextMove?.exactPost,
    after: queue.afterThat?.exactTopic,
    release: queue.latestReleaseDraft?.professionalNetworkDraft
});
requireValue(!/\bcompanions?\b/i.test(publicDraftText), 'Prepared public wording uses retired companion language.');
requireValue(!/\bsignal\b/i.test(publicDraftText), 'Prepared public wording uses vague signal language.');
requireValue(!/\b\d[\d,.]*\s+(?:players|customers|downloads|followers|visits)\b/i.test(publicDraftText), 'Prepared public wording contains an unverified audience number.');
requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(publicDraftText), 'Prepared public wording contains a tracking parameter.');
requireValue(queue.truthRules?.includes('A post view is not a player.') && queue.truthRules?.includes('A website visit is not a play.'), 'Views, visits, players and plays must remain separate.');

if (errors.length) {
    console.error(`Release-to-audience queue validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Release-to-audience queue valid: one next move, ${queue.generatedFrom.preparedReleaseDrafts} source drafts kept behind human control.`);
