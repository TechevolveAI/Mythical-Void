#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const registryPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(repositoryRoot, 'docs', 'company', 'content', 'channels.json');
const allowedStates = new Set(['unknown', 'research_only', 'deferred', 'active_read_only', 'draft_only', 'publish_approved', 'paused', 'retired']);
const failures = [];
const warnings = [];

let registry;
try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
} catch (error) {
    console.error(`Channel registry could not be read: ${error.message}`);
    process.exit(1);
}

if (registry.schemaVersion !== 1) failures.push('schemaVersion must be 1');
const ids = new Set();
for (const channel of registry.channels || []) {
    if (!/^CH-\d{3}$/.test(channel.id || '')) failures.push(`Invalid channel ID ${channel.id}`);
    if (ids.has(channel.id)) failures.push(`Duplicate channel ID ${channel.id}`);
    ids.add(channel.id);
    if (!allowedStates.has(channel.state)) failures.push(`${channel.id} has invalid state ${channel.state}`);
    for (const field of ['name', 'kind', 'owner', 'purpose', 'audience', 'nextGate']) {
        if (typeof channel[field] !== 'string' || !channel[field].trim()) failures.push(`${channel.id} lacks ${field}`);
    }
    if (channel.state === 'publish_approved') {
        if (!registry.externalPublishingAuthorized) failures.push(`${channel.id} is publish-approved while global publishing is off`);
        if (!channel.publishingCredential) failures.push(`${channel.id} is publish-approved without a scoped credential record`);
        if (!channel.moderationReady) failures.push(`${channel.id} is publish-approved without moderation readiness`);
    }
    if (channel.publishingCredential && channel.state !== 'publish_approved') {
        warnings.push(`${channel.id} has a publishing credential before publish approval; remove or scope it`);
    }
}

const stateCounts = {};
for (const channel of registry.channels || []) {
    stateCounts[channel.state] = (stateCounts[channel.state] || 0) + 1;
}

console.log(JSON.stringify({
    workflow: 'A-008',
    valid: failures.length === 0,
    externalPublishingAuthorized: Boolean(registry.externalPublishingAuthorized),
    channelCount: (registry.channels || []).length,
    stateCounts,
    failures,
    warnings,
    nextGates: (registry.channels || []).map(channel => ({ id: channel.id, name: channel.name, nextGate: channel.nextGate }))
}, null, 2));
if (failures.length) process.exitCode = 1;

