#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

const DEFAULT_ORIGIN = 'https://mythicalvoid.com';
const GOOGLE_TAG_ID = 'G-FTM4W73ECQ';
const MAX_REDIRECTS = 4;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 15000;

function fetchPage(url, redirects = 0) {
    return new Promise(resolve => {
        const request = https.get(url, {
            headers: { 'User-Agent': 'Mythical-Void-Live-Health/1.0', Accept: '*/*' }
        }, response => {
            const status = response.statusCode || 0;
            const location = response.headers.location;
            if (status >= 300 && status < 400 && location) {
                response.resume();
                if (redirects >= MAX_REDIRECTS) {
                    resolve({ url, status, headers: response.headers, body: '', error: 'redirect limit reached' });
                    return;
                }
                const next = new URL(location, url);
                if (next.hostname !== 'mythicalvoid.com') {
                    resolve({ url, status, headers: response.headers, body: '', error: 'redirected outside mythicalvoid.com' });
                    return;
                }
                resolve(fetchPage(next.href, redirects + 1));
                return;
            }
            const chunks = [];
            let bytes = 0;
            response.on('data', chunk => {
                bytes += chunk.length;
                if (bytes <= MAX_RESPONSE_BYTES) chunks.push(chunk);
            });
            response.on('end', () => resolve({
                url,
                status,
                headers: response.headers,
                body: Buffer.concat(chunks).toString('utf8'),
                bytes,
                error: bytes > MAX_RESPONSE_BYTES ? 'response exceeded 3 MiB review limit' : null
            }));
        });
        request.setTimeout(TIMEOUT_MS, () => request.destroy(new Error('timeout')));
        request.on('error', error => resolve({ url, status: 0, headers: {}, body: '', bytes: 0, error: error.message }));
    });
}

function visibleText(html) {
    return String(html || '')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&(?:nbsp|amp|quot|#39);/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function ownedLinks(html, base) {
    const links = [];
    for (const match of String(html || '').matchAll(/\bhref=["']([^"']+)["']/gi)) {
        const raw = match[1];
        if (/^(?:mailto:|tel:|javascript:|#)/i.test(raw)) continue;
        let url;
        try { url = new URL(raw, base); } catch { continue; }
        if (url.hostname !== 'mythicalvoid.com') continue;
        url.hash = '';
        url.search = '';
        links.push(url.href);
    }
    return [...new Set(links)];
}

function expectedContentType(url) {
    if (url.endsWith('/robots.txt') || url.endsWith('/llms.txt')) return 'text/plain';
    if (url.endsWith('/sitemap.xml')) return 'application/xml';
    if (url.endsWith('/updates/feed.xml')) return 'application/rss+xml';
    if (url.endsWith('/updates/feed.json')) return 'application/feed+json';
    if (url.endsWith('/api/live-presence')) return 'application/json';
    return 'text/html';
}

function inspectLivePresence(body) {
    const errors = [];
    const allowed = { quiet: null, one: '1', two_to_three: '2–3', four_to_six: '4–6', seven_to_ten: '7–10', more_than_ten: '10+' };
    let data = null;
    try { data = JSON.parse(String(body || '')); } catch (error) {
        errors.push(`live presence: invalid JSON (${error.message})`);
        return { errors, data: null };
    }
    if (!Object.prototype.hasOwnProperty.call(allowed, data?.status)) errors.push('live presence: unknown activity state');
    else if (data.range !== allowed[data.status]) errors.push('live presence: activity range does not match its state');
    if (data?.activeWindowSeconds !== 90 || data?.approximate !== true) errors.push('live presence: truthful approximation boundary is missing');
    for (const forbidden of ['name', 'email', 'account', 'creatureId', 'sessionId', 'playerId']) {
        if (Object.prototype.hasOwnProperty.call(data || {}, forbidden)) errors.push(`live presence: personal field exposed (${forbidden})`);
    }
    return { errors, data };
}

function inspectCorePages({ homeHtml, playHtml, updatesHtml, rssBody, jsonBody }, minimumFeedItems = 17) {
    const errors = [];
    const home = String(homeHtml || '');
    const play = String(playHtml || '');
    const updates = String(updatesHtml || '');
    const gameRouteGuarded = /path === ['"]\/play['"][\s\S]*?if \(isGameRoute\) return;[\s\S]*?MYTHICAL_GOOGLE_TAG_ID/.test(play);
    const gameRouteLoadsWebsiteTag = new RegExp(`${GOOGLE_TAG_ID}|googletagmanager\\.com\/gtag`, 'i').test(play) && !gameRouteGuarded;
    if (!home.includes(GOOGLE_TAG_ID) || !/analytics_storage\s*:\s*['"]denied['"]/.test(home)) errors.push('homepage: consent-denied website analytics boundary missing');
    if (gameRouteLoadsWebsiteTag) errors.push('play route: website analytics tag leaked into the game');
    if (!/<title>Mythical Void \| Free Creature Adventure Browser Game<\/title>/i.test(play)) errors.push('play route: expected game title missing');
    if (!updates.includes('href="/updates/feed.xml">Follow the news</a>')) errors.push('updates page: visible RSS link missing');
    let jsonItems = 0;
    try { jsonItems = JSON.parse(String(jsonBody || '{}')).items?.length || 0; } catch (error) { errors.push(`JSON feed: ${error.message}`); }
    const rssItems = (String(rssBody || '').match(/<item>/g) || []).length;
    if (jsonItems < minimumFeedItems || rssItems < minimumFeedItems || jsonItems !== rssItems) errors.push(`feed count mismatch: JSON ${jsonItems}, RSS ${rssItems}`);
    return { errors, gameRouteGuarded, gameRouteLoadsWebsiteTag, analyticsDefaultDenied: home.includes(GOOGLE_TAG_ID) && /analytics_storage\s*:\s*['"]denied['"]/.test(home), rssItems, jsonItems };
}

function parseArguments(argv) {
    const outputIndex = argv.indexOf('--output');
    return { outputPath: outputIndex >= 0 && argv[outputIndex + 1] ? path.resolve(argv[outputIndex + 1]) : null };
}

async function runAudit({ outputPath = null, checkedAt = new Date().toISOString() } = {}) {
    const origin = DEFAULT_ORIGIN;
    const errors = [];
    const sitemap = await fetchPage(`${origin}/sitemap.xml`);
    if (sitemap.status !== 200 || sitemap.error) errors.push(`sitemap: ${sitemap.error || sitemap.status}`);
    const sitemapUrls = [...sitemap.body.matchAll(/<loc>(https:\/\/mythicalvoid\.com\/[^<]*)<\/loc>/g)].map(match => match[1]);
    if (sitemapUrls.length < 16) errors.push(`sitemap contains ${sitemapUrls.length} URLs; expected at least 16`);
    const coreExtras = [`${origin}/play/`, `${origin}/robots.txt`, `${origin}/llms.txt`, `${origin}/updates/feed.xml`, `${origin}/updates/feed.json`, `${origin}/api/live-presence`];
    const firstTargets = [...new Set([...sitemapUrls, ...coreExtras])];
    const firstResponses = await Promise.all(firstTargets.map(fetchPage));
    const responseMap = new Map(firstResponses.map(result => [result.url, result]));
    for (const result of firstResponses) {
        if (result.error) errors.push(`${result.url}: ${result.error}`);
        if (result.status !== 200) errors.push(`${result.url}: HTTP ${result.status}`);
        const contentType = String(result.headers['content-type'] || '').toLowerCase();
        const expected = expectedContentType(result.url);
        if (!contentType.includes(expected)) errors.push(`${result.url}: expected ${expected}, received ${contentType || 'no content type'}`);
    }
    const htmlResponses = firstResponses.filter(result => String(result.headers['content-type'] || '').includes('text/html'));
    const owned = [...new Set(htmlResponses.flatMap(result => ownedLinks(result.body, result.url)))];
    const missingTargets = owned.filter(url => !responseMap.has(url));
    const linkedResponses = await Promise.all(missingTargets.map(fetchPage));
    linkedResponses.forEach(result => responseMap.set(result.url, result));
    for (const result of linkedResponses) if (result.error || result.status !== 200) errors.push(`${result.url}: ${result.error || `HTTP ${result.status}`}`);
    for (const result of htmlResponses.filter(item => sitemapUrls.includes(item.url))) {
        const text = visibleText(result.body);
        if (/\b(?:companions?|signals?)\b/i.test(text)) errors.push(`${result.url}: retired visitor wording is visible`);
        if (!/<title>[^<]+<\/title>/i.test(result.body)) errors.push(`${result.url}: missing page title`);
    }
    const home = responseMap.get(`${origin}/`);
    const play = responseMap.get(`${origin}/play/`);
    const updates = responseMap.get(`${origin}/updates/`);
    const rss = responseMap.get(`${origin}/updates/feed.xml`);
    const jsonFeed = responseMap.get(`${origin}/updates/feed.json`);
    const livePresence = responseMap.get(`${origin}/api/live-presence`);
    const core = inspectCorePages({ homeHtml: home?.body, playHtml: play?.body, updatesHtml: updates?.body, rssBody: rss?.body, jsonBody: jsonFeed?.body });
    errors.push(...core.errors);
    const presence = inspectLivePresence(livePresence?.body);
    errors.push(...presence.errors);
    const report = {
        checkedAt,
        origin,
        status: errors.length ? 'fail' : 'pass',
        sitemapUrls: sitemapUrls.length,
        coreExtraRoutes: coreExtras.length,
        uniqueOwnedLinksChecked: owned.length,
        totalResponsesChecked: responseMap.size,
        playRouteReachable: play?.status === 200,
        analyticsDefaultDenied: core.analyticsDefaultDenied,
        gameRouteGuardedBeforeWebsiteTag: core.gameRouteGuarded,
        gameRouteLoadsWebsiteTag: core.gameRouteLoadsWebsiteTag,
        rssItems: core.rssItems,
        jsonItems: core.jsonItems,
        livePresenceEndpointHealthy: livePresence?.status === 200 && presence.errors.length === 0,
        livePresenceStatus: presence.data?.status || null,
        livePresenceRange: presence.data?.range ?? null,
        livePresenceIsApproximateActivity: presence.data?.approximate === true,
        interpretation: { healthySiteDoesNotProvePlayers: true, healthySiteDoesNotProveEnjoyment: true, healthySiteDoesNotProveGrowth: true },
        errors
    };
    const rendered = `${JSON.stringify(report, null, 2)}\n`;
    if (outputPath) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, rendered);
    }
    return report;
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    const report = await runAudit(options);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.errors.length) process.exitCode = 1;
}

module.exports = { expectedContentType, inspectCorePages, inspectLivePresence, ownedLinks, parseArguments, runAudit, visibleText };

if (require.main === module) main().catch(error => { console.error(error); process.exit(1); });
