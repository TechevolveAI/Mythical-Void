#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { runAudit } = require('./audit-live-site-health.cjs');

const ROOT = path.resolve(__dirname, '..', '..');

function deriveFounderStatus(control, health) {
    const publicDoorwayHealthy = health.status === 'pass' &&
        health.playRouteReachable === true &&
        health.analyticsDefaultDenied === true &&
        health.gameRouteLoadsWebsiteTag === false &&
        health.livePresenceEndpointHealthy === true &&
        health.rssItems === health.jsonItems &&
        health.rssItems > 0;

    const currentDecision = control.currentDecisions?.[0] || null;
    const nextAction = publicDoorwayHealthy
        ? currentDecision?.question || 'Review the founder control page.'
        : 'Restore the public website, then run npm run founder:status again.';

    return {
        checkedAt: health.checkedAt,
        publicDoorwayHealthy,
        discoveryMayProceedToHumanApproval: publicDoorwayHealthy,
        publicActionAuthorized: false,
        currentDecisionId: publicDoorwayHealthy ? currentDecision?.id || null : null,
        nextAction,
        website: {
            status: health.status,
            playRouteReachable: health.playRouteReachable,
            sitemapUrls: health.sitemapUrls,
            ownedLinksChecked: health.uniqueOwnedLinksChecked,
            rssItems: health.rssItems,
            jsonItems: health.jsonItems,
            analyticsDefaultDenied: health.analyticsDefaultDenied,
            gameRouteLoadsWebsiteTag: health.gameRouteLoadsWebsiteTag,
            livePresenceEndpointHealthy: health.livePresenceEndpointHealthy,
            errors: health.errors
        },
        truthBoundary: {
            availabilityProvesPlayers: false,
            availabilityProvesEnjoyment: false,
            availabilityProvesGrowth: false,
            inventedActivityAllowed: false
        }
    };
}

async function main() {
    const control = JSON.parse(fs.readFileSync(
        path.join(ROOT, 'docs/company/operations/founder-control-page.json'),
        'utf8'
    ));
    const health = await runAudit();
    const status = deriveFounderStatus(control, health);
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    if (!status.publicDoorwayHealthy) process.exitCode = 2;
}

module.exports = { deriveFounderStatus };

if (require.main === module) main().catch(error => {
    console.error(error);
    process.exit(1);
});
