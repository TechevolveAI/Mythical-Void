#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const registryPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'docs/company/content/channel-launch/OFFICIAL_CHANNEL_REGISTRY.json');
const activationPath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'docs/company/content/channel-launch/channel-activation-pack.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const activation = JSON.parse(fs.readFileSync(activationPath, 'utf8'));
const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };

function validUrl(platform, raw) {
    if (typeof raw !== 'string') return false;
    try {
        const value = new URL(raw);
        const host = value.hostname.toLowerCase().replace(/^www\./, '');
        if (value.protocol !== 'https:' || value.search || value.hash || value.username || value.password || value.port) return false;
        if (platform === 'youtube') return host === 'youtube.com' && (/^\/@[A-Za-z0-9._-]{3,100}\/?$/.test(value.pathname) || /^\/channel\/UC[A-Za-z0-9_-]{10,100}\/?$/.test(value.pathname));
        return host === 'linkedin.com' && /^\/company\/[a-z0-9][a-z0-9-]{1,99}\/?$/i.test(value.pathname);
    } catch {
        return false;
    }
}

requireValue(registry.schemaVersion === 1 && registry.id === 'OFFICIAL-CHANNEL-REGISTRY-2026-08-14', 'Official channel registry identity is invalid.');
requireValue(registry.channels?.length === 2, 'Official channel registry must retain YouTube and LinkedIn.');
requireValue(registry.authority?.localRecordingAfterKevinConfirmationAuthorized === true, 'Kevin-confirmed local recording must remain allowed.');
for (const field of ['accountCreationAuthorized', 'externalMutationAuthorized', 'publicationAuthorized', 'engagementAuthorized', 'paidPromotionAuthorized']) {
    requireValue(registry.authority?.[field] === false, `${field} must remain false.`);
}

let createdCount = 0;
for (const channel of registry.channels || []) {
    const activationChannel = activation.channels?.find(item => item.channelRef === channel.channelRef);
    requireValue(Boolean(activationChannel), `${channel.platform} activation entry is missing.`);
    requireValue(['youtube', 'linkedin'].includes(channel.platform), `Unsupported platform ${channel.platform}.`);
    requireValue(channel.accountState === activationChannel?.accountState, `${channel.platform} registry and activation state disagree.`);
    const created = channel.accountState === 'created_owner_confirmed_not_published';
    if (created) {
        createdCount += 1;
        requireValue(validUrl(channel.platform, channel.officialUrl), `${channel.platform} official URL is invalid.`);
        requireValue(channel.confirmedBy === 'Kevin Murphy' && /^\d{4}-\d{2}-\d{2}T/.test(channel.confirmedAt || ''), `${channel.platform} lacks Kevin's dated confirmation.`);
        requireValue(activationChannel?.officialUrl === channel.officialUrl, `${channel.platform} activation URL disagrees with the registry.`);
    } else {
        requireValue(channel.accountState === 'not_created_owner_confirmed', `${channel.platform} has an unsupported account state.`);
        requireValue(channel.officialUrl === null && channel.confirmedBy === null && channel.confirmedAt === null, `${channel.platform} has invented account details.`);
    }
    for (const field of ['linkReachabilityVerified', 'websiteLinkApproved', 'firstPublicationAuthorized', 'engagementAuthorized', 'paidPromotionAuthorized']) {
        requireValue(channel[field] === false, `${channel.platform}.${field} must remain false until separately verified or approved.`);
    }
}

const expectedState = createdCount === 0
    ? 'waiting_for_first_owner_confirmed_channel'
    : createdCount === registry.channels.length
        ? 'all_planned_channels_owner_confirmed_not_published'
        : 'one_channel_owner_confirmed_not_published';
requireValue(registry.state === expectedState, 'Registry summary state does not match the recorded channels.');

if (errors.length) {
    console.error(`Official channel registry validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Official channel registry valid: ${createdCount} owner-confirmed channel(s), ${2 - createdCount} waiting, all publication and engagement gates closed.`);
