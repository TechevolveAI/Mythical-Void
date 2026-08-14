#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const calendarPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'docs/company/content/channel-launch/FOUR_WEEK_LAUNCH_CALENDAR.json');
const calendar = JSON.parse(fs.readFileSync(calendarPath, 'utf8'));
const errors = [];
const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};

requireValue(calendar.schemaVersion === 1, 'Calendar schemaVersion must be 1.');
requireValue(calendar.canonicalUrl === 'https://mythicalvoid.com/', 'Calendar must use the canonical game URL.');
requireValue(calendar.state === 'prepared_waiting_for_official_channels', 'Calendar must remain gated until official channels exist.');
for (const field of ['accountCreationAuthorized', 'publishingAuthorized', 'replyingAuthorized', 'directMessagingAuthorized', 'paidPromotionAuthorized']) {
    requireValue(calendar.authority?.[field] === false, `Calendar authority.${field} must remain false.`);
}

requireValue(Array.isArray(calendar.weeks) && calendar.weeks.length === 4, 'Calendar must contain exactly four weeks.');
const releases = (calendar.weeks || []).flatMap((week) => week.releases || []);
requireValue(releases.length === 8, 'Calendar must contain eight deliberate releases or reviews.');
requireValue(new Set(releases.map((item) => item.id)).size === releases.length, 'Calendar item ids must be unique.');

const forbiddenCopy = JSON.stringify(calendar);
requireValue(!/\bAI companions?\b/i.test(forbiddenCopy), 'Calendar must not use AI companion language.');
requireValue(!/\bno two creatures (?:are )?alike\b/i.test(forbiddenCopy), 'Calendar must not promise absolute creature uniqueness.');
requireValue(!/\bevery creature is unique\b/i.test(forbiddenCopy), 'Calendar must not promise absolute creature uniqueness.');

for (const item of releases) {
    if (item.channel !== 'Internal review') {
        requireValue(item.state !== 'publication_ready', `${item.id} cannot be publication-ready.`);
        requireValue(Boolean(item.disclosure), `${item.id} needs a disclosure or proof boundary.`);
    }
    const assetPaths = [item.asset, ...(item.additionalAssets || [])].filter(Boolean);
    for (const assetPath of assetPaths) {
        requireValue(assetPath.startsWith('public/'), `${item.id} must use a public first-party asset path.`);
        requireValue(fs.existsSync(path.join(root, assetPath)), `${item.id} asset is missing: ${assetPath}`);
    }
    if (item.assetClass === 'authentic_running_build_screenshot') {
        requireValue(item.disclosure?.includes('real Mythical Void browser game'), `${item.id} must plainly identify authentic gameplay.`);
    }
    if (item.assetClass === 'authentic_running_build_gameplay_video') {
        requireValue(item.disclosure?.includes('real Mythical Void browser game'), `${item.id} must plainly identify authentic gameplay video.`);
        requireValue(item.asset?.endsWith('.mp4'), `${item.id} must use the verified MP4 asset.`);
    }
}

requireValue(calendar.automationBoundary?.mustNot?.some((rule) => /publish without Kevin/i.test(rule)), 'Automation boundary must preserve Kevin publication approval.');
requireValue(calendar.automationBoundary?.mustNot?.some((rule) => /contact a child/i.test(rule)), 'Automation boundary must forbid child contact.');
requireValue(calendar.approvalGate?.requiredBeforeEveryExternalRelease?.length >= 5, 'Every external release needs the full approval gate.');

if (errors.length) {
    console.error(`Four-week launch calendar validation failed (${errors.length}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
}

const ready = releases.filter((item) => item.state === 'waiting_for_channel_and_kevin_approval').length;
const blocked = releases.filter((item) => item.state.startsWith('blocked_until_')).length;
console.log(`Four-week launch calendar valid: ${releases.length} items, ${ready} asset-ready, ${blocked} waiting for new proof.`);
