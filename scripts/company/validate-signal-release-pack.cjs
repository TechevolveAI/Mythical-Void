#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildReleasePack, defaultOutputPath, defaultSourcePath } = require('./build-signal-release-pack.cjs');

const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultSourcePath;
const packPath = process.argv[3] ? path.resolve(process.argv[3]) : defaultOutputPath;
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };
const liveEntries = (source.entries || []).filter(entry => entry.status === 'live');

requireValue(source.publicationBoundary?.liveItemsOnly === true, 'Signal Log must remain live-items-only.');
requireValue(liveEntries.length >= 1, 'At least one verified live source entry is required.');
requireValue((source.entries || []).every(entry => entry.status === 'live' || entry.status === 'withdrawn'), 'Source entries must be live or explicitly withdrawn.');
requireValue(pack.schemaVersion === 1 && pack.state === 'draft_only_missing_verified_social_channels_and_approval', 'Draft pack must retain its internal review-only state.');
requireValue(pack.generatedFrom?.liveEntryCount === liveEntries.length && pack.items?.length === liveEntries.length, 'Draft count must match the live Signal Log.');
requireValue(JSON.stringify(pack) === JSON.stringify(buildReleasePack(source)), 'Draft pack is stale or contains hand-written drift; rebuild it from the Signal Log.');

for (const [field, expected] of Object.entries({
    socialAccountsVerified: false,
    publishingAuthorized: false,
    schedulingAuthorized: false,
    messagingAuthorized: false,
    replyingAuthorized: false,
    paidPromotionAuthorized: false,
    externalActionPerformed: false
})) requireValue(pack.authority?.[field] === expected, `authority.${field} must remain ${expected}.`);

requireValue(pack.audienceBoundary?.childTargetedAdvertising === false && pack.audienceBoundary?.directMinorContact === false && pack.audienceBoundary?.behaviouralTargeting === false, 'Child targeting, direct minor contact and behavioural targeting must remain off.');

const entryMap = new Map(liveEntries.map(entry => [entry.id, entry]));
for (const item of pack.items || []) {
    const entry = entryMap.get(item.sourceEntryId);
    const label = item.id || 'draft item';
    requireValue(Boolean(entry), `${label} has no live Signal Log source.`);
    requireValue(/^https:\/\/mythicalvoid\.com\//.test(item.destination || ''), `${label} destination must stay on mythicalvoid.com.`);
    requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(item.destination || '') && item.trackingParameters === false, `${label} must not add tracking parameters.`);
    requireValue(item.media?.sourcePath === entry?.image && item.media?.alt === entry?.imageAlt && item.media?.class === entry?.imageClass && item.media?.disclosure === entry?.disclosure, `${label} media must stay source-bound.`);
    requireValue(item.approval?.state === 'blocked_missing_verified_channel_and_kevin_approval' && item.approval?.kevinApprovalRequired === true && item.approval?.verifiedChannelRequired === true, `${label} must remain blocked for channel verification and Kevin approval.`);
    requireValue(item.approval?.adultReplyCoverageRequiredBeforeComments === true && item.approval?.copyMediaLinkOrAudienceChangeInvalidatesApproval === true, `${label} must retain reply coverage and change-control gates.`);
    requireValue(item.approval?.approvedAt === null && item.approval?.scheduledAt === null && item.approval?.publishedAt === null, `${label} must not invent approval, scheduling or publication.`);
    requireValue(item.drafts?.pressCreatorSourceNote?.recipient === null && item.drafts?.pressCreatorSourceNote?.format === 'source_note_not_bulk_email', `${label} press note must remain recipient-free source material.`);
    const allDraftText = JSON.stringify(item.drafts || {});
    requireValue(allDraftText.includes(entry?.disclosure || '__missing__'), `${label} drafts must carry the source media disclosure.`);
    requireValue(!/\bcompanions?\b/i.test(allDraftText), `${label} uses retired companion wording.`);
    requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(allDraftText), `${label} contains an unsupported uniqueness promise.`);
    requireValue(!/\b\d[\d,.]*\s+(?:players|customers|downloads|followers|visits)\b/i.test(allDraftText), `${label} contains an unverified audience metric.`);
    requireValue(item.drafts?.professionalNetwork?.characterCount <= 3000, `${label} professional draft is too long.`);
    requireValue(item.drafts?.videoCommunity?.characterCount <= 1500, `${label} video-community draft is too long.`);
    requireValue(item.drafts?.pressCreatorSourceNote?.characterCount <= 2500, `${label} press source note is too long.`);
    if (entry?.imageClass === 'ai_generated_marketing_illustration') requireValue(/not gameplay/i.test(item.media?.disclosure || ''), `${label} generated artwork needs a not-gameplay disclosure.`);
    if (entry?.imageClass === 'authentic_running_build_screenshot') requireValue(/real browser game/i.test(item.media?.disclosure || ''), `${label} running-build image needs a real-game disclosure.`);
    if ((entry?.imageClass || '').startsWith('branded_social_artwork_with_authentic_gameplay_frame')) requireValue(/branded sharing artwork/i.test(item.media?.disclosure || '') && /not a raw screenshot/i.test(item.media?.disclosure || '') && /no player information/i.test(item.media?.disclosure || ''), `${label} branded sharing artwork needs its layout, gameplay and privacy disclosure.`);
    if (entry?.imageClass === 'branded_social_video_poster_with_authentic_running_build_gameplay') requireValue(/branded social edit/i.test(item.media?.disclosure || '') && /complete real gameplay frame/i.test(item.media?.disclosure || '') && /not gameplay/i.test(item.media?.disclosure || '') && /No player identity or private save/i.test(item.media?.disclosure || ''), `${label} branded gameplay-video poster needs its edit, gameplay and privacy disclosure.`);
    if (entry?.imageClass === 'branded_renderer_proof_layout_with_authentic_game_sprite_exports') {
        const disclosure = item.media?.disclosure || '';
        const rangeBoundary = /does not represent normal hatch odds/i.test(disclosure);
        const fieldGuideBoundary = /official universe material/i.test(disclosure) && /not claims? that these events are already playable quests/i.test(disclosure);
        requireValue(/branded proof layout/i.test(disclosure) && /not a playable game scene/i.test(disclosure) && /exact (?:game-renderer )?export/i.test(disclosure) && (rangeBoundary || fieldGuideBoundary), `${label} creature renderer proof needs its layout, exact-export and relevant range or field-guide boundary.`);
    }
    if (/nasa/i.test(entry?.imageClass || '')) requireValue(/NASA does not endorse Mythical Void/i.test(item.media?.disclosure || ''), `${label} NASA artwork needs its non-endorsement boundary.`);
    if (entry?.imageClass === 'branded_founder_story_artwork_with_ai_marketing_background_and_authentic_gameplay_frame') requireValue(/founder-story sharing artwork/i.test(item.media?.disclosure || '') && /not a raw screenshot/i.test(item.media?.disclosure || '') && /not gameplay/i.test(item.media?.disclosure || '') && /real gameplay/i.test(item.media?.disclosure || '') && /no player information/i.test(item.media?.disclosure || '') && /identifying detail of the child/i.test(item.media?.disclosure || ''), `${label} founder-story artwork needs its generated-art, gameplay, privacy and child-identity boundaries.`);
}

if (errors.length) {
    console.error(`Signal release pack validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Signal release pack valid: ${pack.items.length} source-bound releases, ${pack.items.length * 3} review drafts, no publishing authority.`);
