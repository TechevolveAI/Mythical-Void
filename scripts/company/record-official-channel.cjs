#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildDashboard, defaultPaths, readJson } = require('./build-founder-launch-dashboard.cjs');

const root = path.resolve(__dirname, '../..');
const defaults = {
    registry: path.join(root, 'docs/company/content/channel-launch/OFFICIAL_CHANNEL_REGISTRY.json'),
    activation: path.join(root, 'docs/company/content/channel-launch/channel-activation-pack.json'),
    dashboard: path.join(root, 'docs/company/FOUNDER_LAUNCH_DASHBOARD.md')
};

function parseArgs(argv) {
    const result = { apply: false, skipDashboard: false };
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--apply') result.apply = true;
        else if (token === '--skip-dashboard') result.skipDashboard = true;
        else if (token.startsWith('--')) {
            const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
            result[key] = argv[index + 1];
            index += 1;
        }
    }
    return result;
}

function normalizeOfficialUrl(platform, raw) {
    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        throw new Error('The channel URL is not a valid URL.');
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.port) {
        throw new Error('Use the clean public HTTPS channel URL with no login details, port, query or fragment.');
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname.replace(/\/+$/, '');
    if (platform === 'youtube') {
        const allowedPath = /^\/@[A-Za-z0-9._-]{3,100}$/.test(pathname) || /^\/channel\/UC[A-Za-z0-9_-]{10,100}$/.test(pathname);
        if (host !== 'youtube.com' || !allowedPath) {
            throw new Error('YouTube must use an official youtube.com handle or channel URL.');
        }
        return `https://www.youtube.com${pathname}`;
    }
    if (platform === 'linkedin') {
        if (host !== 'linkedin.com' || !/^\/company\/[a-z0-9][a-z0-9-]{1,99}$/i.test(pathname)) {
            throw new Error('LinkedIn must use an official linkedin.com/company/... Page URL.');
        }
        return `https://www.linkedin.com${pathname.toLowerCase()}`;
    }
    throw new Error('Platform must be youtube or linkedin.');
}

function requireIsoTimestamp(raw) {
    const value = raw || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) || Number.isNaN(Date.parse(value))) {
        throw new Error('confirmed-at must be a UTC timestamp such as 2026-08-14T19:45:00Z.');
    }
    if (Date.parse(value) > Date.now() + 5 * 60 * 1000) {
        throw new Error('confirmed-at cannot be in the future.');
    }
    return value;
}

function atomicWrite(file, content) {
    const temp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(temp, content);
    fs.renameSync(temp, file);
}

function buildUpdatedSources(options) {
    if (options.confirmedBy !== 'Kevin Murphy') {
        throw new Error('confirmed-by must be exactly "Kevin Murphy".');
    }
    const platform = String(options.platform || '').toLowerCase();
    const officialUrl = normalizeOfficialUrl(platform, options.url || '');
    const confirmedAt = requireIsoTimestamp(options.confirmedAt);
    const registryPath = path.resolve(options.registry || defaults.registry);
    const activationPath = path.resolve(options.activation || defaults.activation);
    const registry = readJson(registryPath);
    const activation = readJson(activationPath);
    const registryChannel = registry.channels?.find(channel => channel.platform === platform);
    const activationChannel = activation.channels?.find(channel => channel.channelRef === registryChannel?.channelRef);
    if (!registryChannel || !activationChannel) throw new Error(`No configured ${platform} channel exists.`);

    registryChannel.accountState = 'created_owner_confirmed_not_published';
    registryChannel.officialUrl = officialUrl;
    registryChannel.confirmedBy = options.confirmedBy;
    registryChannel.confirmedAt = confirmedAt;
    registryChannel.linkReachabilityVerified = false;
    registryChannel.websiteLinkApproved = false;
    registryChannel.firstPublicationAuthorized = false;
    registryChannel.engagementAuthorized = false;
    registryChannel.paidPromotionAuthorized = false;
    const createdCount = registry.channels.filter(channel => channel.accountState === 'created_owner_confirmed_not_published').length;
    registry.state = createdCount === registry.channels.length ? 'all_planned_channels_owner_confirmed_not_published' : 'one_channel_owner_confirmed_not_published';

    activationChannel.accountState = 'created_owner_confirmed_not_published';
    activationChannel.officialUrl = officialUrl;
    activationChannel.ownerConfirmedAt = confirmedAt;
    if (platform === 'youtube') activationChannel.handleAvailabilityVerified = true;
    if (platform === 'linkedin') activationChannel.publicUrlAvailabilityVerified = true;

    return { platform, officialUrl, confirmedAt, registryPath, activationPath, registry, activation };
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const updated = buildUpdatedSources(options);
    const receipt = {
        mode: options.apply ? 'applied' : 'dry_run',
        platform: updated.platform,
        officialUrl: updated.officialUrl,
        confirmedBy: options.confirmedBy,
        confirmedAt: updated.confirmedAt,
        linkReachabilityVerified: false,
        websiteLinkApproved: false,
        publicationAuthorized: false,
        engagementAuthorized: false,
        paidPromotionAuthorized: false
    };
    if (!options.apply) {
        console.log(JSON.stringify(receipt, null, 2));
        console.log('Dry run only. Add --apply after checking the exact URL and receipt.');
        return;
    }

    const dashboardPath = path.resolve(options.dashboard || defaults.dashboard);
    let dashboard = null;
    if (!options.skipDashboard) {
        const values = Object.fromEntries(Object.entries(defaultPaths).map(([key, file]) => [key, readJson(file)]));
        values.activation = updated.activation;
        values.registry = updated.registry;
        dashboard = buildDashboard(values);
    }
    atomicWrite(updated.registryPath, `${JSON.stringify(updated.registry, null, 2)}\n`);
    atomicWrite(updated.activationPath, `${JSON.stringify(updated.activation, null, 2)}\n`);
    if (dashboard !== null) atomicWrite(dashboardPath, dashboard);
    console.log(JSON.stringify(receipt, null, 2));
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(`Official channel recording failed: ${error.message}`);
        process.exit(1);
    }
}

module.exports = { buildUpdatedSources, normalizeOfficialUrl, parseArgs, requireIsoTimestamp };
