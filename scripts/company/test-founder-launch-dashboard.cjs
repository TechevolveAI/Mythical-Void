#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const validator = path.join(__dirname, 'validate-founder-launch-dashboard.cjs');
const sources = {
    evidence: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/growth/live-launch-evidence-2026-08-14.json'), 'utf8')),
    outreach: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/FIRST_CREATOR_OUTREACH_WAVE.json'), 'utf8')),
    activation: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/channel-activation-pack.json'), 'utf8')),
    itch: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/distribution/itch-launch-pack-2026-08-14.json'), 'utf8')),
    launch: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/growth/launch-readiness.json'), 'utf8')),
    trailer: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/TRAILER_PAGE_RELEASE.json'), 'utf8')),
    analytics: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/automation/website-analytics-tag.json'), 'utf8')),
    calendar: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/content/channel-launch/FOUR_WEEK_LAUNCH_CALENDAR.json'), 'utf8')),
    discovery: JSON.parse(fs.readFileSync(path.join(root, 'docs/company/search/organic-discovery-release-2026-08-14.json'), 'utf8')),
    dashboard: fs.readFileSync(path.join(root, 'docs/company/FOUNDER_LAUNCH_DASHBOARD.md'), 'utf8')
};
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-founder-dashboard-'));

function run(name, changes = {}) {
    const values = { ...sources, ...changes };
    const paths = ['evidence', 'outreach', 'activation', 'itch', 'launch', 'trailer', 'analytics', 'calendar', 'discovery'].map(key => {
        const file = path.join(temp, `${name}-${key}.json`);
        fs.writeFileSync(file, `${JSON.stringify(values[key], null, 2)}\n`);
        return file;
    });
    const dashboardFile = path.join(temp, `${name}-dashboard.md`);
    fs.writeFileSync(dashboardFile, values.dashboard);
    return spawnSync(process.execPath, [validator, ...paths, dashboardFile], { cwd: root, encoding: 'utf8' });
}

try {
    if (run('valid').status !== 0) throw new Error('Valid founder dashboard was rejected.');

    const failedRoute = structuredClone(sources.evidence);
    failedRoute.routes.find(route => route.route === '/press/').verified = false;
    if (run('failed-route', { evidence: failedRoute }).status === 0) throw new Error('A failed live route was accepted.');

    const sentMessage = structuredClone(sources.outreach);
    sentMessage.messages[0].sentAt = '2026-08-14T00:00:00Z';
    if (run('sent-message', { outreach: sentMessage }).status === 0) throw new Error('An unrecorded sent message was accepted.');

    const inventedChannel = structuredClone(sources.activation);
    inventedChannel.channels.find(channel => channel.channelRef === 'CH-002').accountState = 'created';
    if (run('invented-channel', { activation: inventedChannel }).status === 0) throw new Error('An invented social channel was accepted.');

    const publicItch = structuredClone(sources.itch);
    publicItch.authority.publicationAuthorized = true;
    if (run('public-itch', { itch: publicItch }).status === 0) throw new Error('An unauthorized itch.io publication state was accepted.');

    const inventedTrailerRelease = structuredClone(sources.trailer);
    inventedTrailerRelease.productionPublished = true;
    if (run('invented-trailer-release', { trailer: inventedTrailerRelease }).status === 0) throw new Error('An invented trailer release was accepted.');

    const trustedAnalytics = structuredClone(sources.analytics);
    trustedAnalytics.trustedForCompanyReporting = true;
    if (run('trusted-analytics', { analytics: trustedAnalytics }).status === 0) throw new Error('Unverified analytics reporting was accepted.');

    const ungatedCalendar = structuredClone(sources.calendar);
    ungatedCalendar.weeks[0].releases[0].state = 'published';
    if (run('ungated-calendar', { calendar: ungatedCalendar }).status === 0) throw new Error('An unapproved calendar publication was accepted.');

    const staleDashboard = `${sources.dashboard}\nOutdated line.\n`;
    if (run('stale-dashboard', { dashboard: staleDashboard }).status === 0) throw new Error('A stale dashboard was accepted.');

    console.log('Founder launch command centre tests passed: valid snapshot plus 8 drift and authority mutations checked.');
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
