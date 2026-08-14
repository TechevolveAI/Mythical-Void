#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildDashboard, defaultPaths, readJson } = require('./build-founder-launch-dashboard.cjs');

const dashboardDefault = path.resolve(__dirname, '../../docs/company/FOUNDER_LAUNCH_DASHBOARD.md');
const paths = {
    evidence: process.argv[2] ? path.resolve(process.argv[2]) : defaultPaths.evidence,
    outreach: process.argv[3] ? path.resolve(process.argv[3]) : defaultPaths.outreach,
    activation: process.argv[4] ? path.resolve(process.argv[4]) : defaultPaths.activation,
    itch: process.argv[5] ? path.resolve(process.argv[5]) : defaultPaths.itch,
    launch: process.argv[6] ? path.resolve(process.argv[6]) : defaultPaths.launch,
    dashboard: process.argv[7] ? path.resolve(process.argv[7]) : dashboardDefault
};
const values = Object.fromEntries(['evidence', 'outreach', 'activation', 'itch', 'launch'].map(key => [key, readJson(paths[key])]));
const dashboard = fs.readFileSync(paths.dashboard, 'utf8');
const expectedDashboard = buildDashboard(values);
const errors = [];
const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
};

const requiredRoutes = ['/', '/creature-genetics/', '/nasa-space-science/', '/parents/', '/studio/', '/press/', '/play/'];
const routeMap = new Map((values.evidence.routes || []).map(route => [route.route, route]));
requireValue(values.evidence.result === 'owned_discovery_live_game_entry_working', 'Live evidence must record the working owned-discovery result.');
requireValue(requiredRoutes.every(route => routeMap.get(route)?.verified === true && routeMap.get(route)?.notFoundShown === false), 'Every required public route must have a successful live check.');
requireValue(routeMap.get('/play/')?.canvasCountAfterFiveSeconds === 1, 'The live game entry must create one canvas during the check.');

requireValue(values.outreach.messages?.length === 3, 'Exactly three first-wave outreach messages must remain prepared.');
requireValue(values.outreach.messages?.every(message => message.approved === false && message.sentAt === null), 'Every first-wave message must remain unapproved and unsent.');
requireValue(values.outreach.authority?.sendingAuthorized === false && values.outreach.authority?.externalActionAuthorized === false, 'Outreach sending and external action must remain unauthorized.');

const youtube = values.activation.channels?.find(channel => channel.channelRef === 'CH-002');
const linkedin = values.activation.channels?.find(channel => channel.channelRef === 'CH-004');
requireValue(youtube?.accountState === 'not_created_owner_confirmed', 'YouTube must remain recorded as not created.');
requireValue(linkedin?.accountState === 'not_created_owner_confirmed', 'LinkedIn must remain recorded as not created.');

requireValue(values.itch.state === 'internal_draft_not_submitted', 'The itch.io launch pack must remain an internal unsubmitted draft.');
requireValue(values.itch.authority?.accountCreationAuthorized === false && values.itch.authority?.publicationAuthorized === false, 'Itch.io account creation and publication must remain unauthorized.');
requireValue(values.itch.portableBuild?.status === 'built_and_nested_path_launch_tested_locally', 'The portable build must retain its tested-local status.');

const ownedDiscoveryStage = values.launch.stages?.find(stage => stage.id === 'LS-003');
requireValue(values.launch.asOf === values.evidence.checkedAt.slice(0, 10), 'Launch board date must match the live evidence date.');
requireValue(ownedDiscoveryStage?.state === 'completed' && ownedDiscoveryStage?.ready === true, 'Owned discovery must be recorded as completed.');
requireValue(ownedDiscoveryStage?.completedEvidenceRef === values.evidence.id, 'Owned discovery completion must cite the live evidence.');

requireValue(dashboard === expectedDashboard, 'Founder dashboard is stale; rebuild it with build-founder-launch-dashboard.cjs.');
requireValue(!/\bAI companions?\b/i.test(dashboard), 'Founder dashboard must use creature language.');
requireValue(!/\bno two creatures (?:are )?alike\b|\bevery creature is unique\b/i.test(dashboard), 'Founder dashboard must not promise absolute uniqueness.');

if (errors.length) {
    console.error(`Founder launch dashboard validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Founder launch dashboard valid: ${requiredRoutes.length} live routes, ${values.outreach.messages.length} unsent first-wave drafts, ${values.outreach.nextWave.length} later opportunities, no external action.`);
