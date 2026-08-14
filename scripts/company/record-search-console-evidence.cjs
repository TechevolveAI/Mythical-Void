#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildDashboard, defaultPaths, readJson } = require('./build-founder-launch-dashboard.cjs');

const root = path.resolve(__dirname, '../..');
const defaultConnection = path.join(root, 'docs/company/search/SEARCH_CONSOLE_CONNECTION.json');
const defaultDashboard = path.join(root, 'docs/company/FOUNDER_LAUNCH_DASHBOARD.md');

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

function requireIso(raw, label, optional = false) {
    if (optional && (!raw || raw === 'not shown')) return null;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(raw || '') || Number.isNaN(Date.parse(raw))) {
        throw new Error(`${label} must be an exact UTC timestamp such as 2026-08-14T19:50:00Z${optional ? ' or "not shown"' : ''}.`);
    }
    if (Date.parse(raw) > Date.now() + 5 * 60 * 1000) throw new Error(`${label} cannot be in the future.`);
    return raw;
}

function atomicWrite(file, content) {
    const temp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(temp, content);
    fs.renameSync(temp, file);
}

function buildUpdate(connection, options) {
    const stage = String(options.stage || '').toLowerCase();
    if (options.verifiedBy !== 'Kevin Murphy') throw new Error('verified-by must be exactly "Kevin Murphy".');
    if (stage === 'property') {
        if (options.propertyType !== 'domain' || options.property !== 'mythicalvoid.com') {
            throw new Error('The approved property is the Domain property mythicalvoid.com.');
        }
        const verifiedAt = requireIso(options.verifiedAt, 'verified-at');
        connection.property.googleSearchConsoleConnected = true;
        connection.property.verifiedPropertyEvidenceAvailable = true;
        connection.property.verifiedBy = options.verifiedBy;
        connection.property.verifiedAt = verifiedAt;
        connection.state = 'domain_verified_waiting_for_sitemap_submission';
        return { stage, verifiedAt };
    }
    if (stage === 'sitemap') {
        if (connection.property.googleSearchConsoleConnected !== true || connection.property.verifiedPropertyEvidenceAvailable !== true) {
            throw new Error('Record the verified Domain property before recording a sitemap submission.');
        }
        if (options.sitemapUrl !== 'https://mythicalvoid.com/sitemap.xml') throw new Error('The sitemap URL must be exactly https://mythicalvoid.com/sitemap.xml.');
        if (!['Success', 'Has errors', 'Pending'].includes(options.sitemapStatus)) throw new Error('sitemap-status must be Success, Has errors or Pending.');
        const submittedAt = requireIso(options.submittedAt, 'submitted-at');
        const lastReadAt = requireIso(options.lastReadAt, 'last-read-at', true);
        let discoveredUrls = null;
        if (options.discoveredUrls && options.discoveredUrls !== 'not shown') {
            discoveredUrls = Number(options.discoveredUrls);
            if (!Number.isInteger(discoveredUrls) || discoveredUrls < 0) throw new Error('discovered-urls must be a non-negative whole number or "not shown".');
        }
        connection.sitemap.submittedByStudio = true;
        connection.sitemap.submittedAt = submittedAt;
        connection.sitemap.searchConsoleStatus = options.sitemapStatus;
        connection.sitemap.lastReadAt = lastReadAt;
        connection.sitemap.discoveredUrls = discoveredUrls;
        connection.state = options.sitemapStatus === 'Success' ? 'domain_verified_sitemap_success_waiting_for_index_evidence' : 'domain_verified_sitemap_recorded_needs_follow_up';
        return { stage, submittedAt, sitemapStatus: options.sitemapStatus, lastReadAt, discoveredUrls };
    }
    throw new Error('stage must be property or sitemap.');
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const connectionPath = path.resolve(options.connection || defaultConnection);
    const dashboardPath = path.resolve(options.dashboard || defaultDashboard);
    const connection = readJson(connectionPath);
    const change = buildUpdate(connection, options);
    const receipt = {
        mode: options.apply ? 'applied' : 'dry_run',
        ...change,
        googleAccountAddressStored: false,
        dnsVerificationTokenStored: false,
        indexCoverageKnown: connection.reporting.indexCoverageKnown,
        rankingKnown: connection.reporting.rankingKnown,
        searchTrafficKnown: connection.reporting.searchTrafficKnown,
        trustedForCompanyDecisions: connection.reporting.trustedForCompanyDecisions
    };
    if (!options.apply) {
        console.log(JSON.stringify(receipt, null, 2));
        console.log('Dry run only. Add --apply after comparing the receipt with Kevin\'s exact Search Console result.');
        return;
    }
    let dashboard = null;
    if (!options.skipDashboard) {
        const values = Object.fromEntries(Object.entries(defaultPaths).map(([key, file]) => [key, readJson(file)]));
        values.searchConsole = connection;
        dashboard = buildDashboard(values);
    }
    atomicWrite(connectionPath, `${JSON.stringify(connection, null, 2)}\n`);
    if (dashboard !== null) atomicWrite(dashboardPath, dashboard);
    console.log(JSON.stringify(receipt, null, 2));
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(`Search Console evidence recording failed: ${error.message}`);
        process.exit(1);
    }
}

module.exports = { buildUpdate, parseArgs, requireIso };
