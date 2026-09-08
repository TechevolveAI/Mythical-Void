#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE_URL = (process.env.MYTHICAL_VOID_ANALYTICS_URL || 'http://127.0.0.1:8125').replace(/\/$/, '');
const CHROME_PATH = process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT) || (9800 + (process.pid % 100));
const TIMEOUT_MS = Number(process.env.ANALYTICS_SMOKE_TIMEOUT_MS) || 20_000;
const CONSENT_KEY = 'mythical-analytics-consent';
const GOOGLE_TAG_ID = 'G-FTM4W73ECQ';

function delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function waitFor(check, label, timeoutMs = TIMEOUT_MS) {
    const startedAt = Date.now();
    let lastError = null;
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const result = await check();
            if (result) return result;
        } catch (error) {
            lastError = error;
        }
        await delay(100);
    }
    throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

async function waitForStable(check, label, stableMs = 1_200, timeoutMs = TIMEOUT_MS) {
    const startedAt = Date.now();
    let stableSince = null;
    while (Date.now() - startedAt < timeoutMs) {
        const result = await check().catch(() => false);
        if (result) {
            stableSince ??= Date.now();
            if (Date.now() - stableSince >= stableMs) return true;
        } else {
            stableSince = null;
        }
        await delay(100);
    }
    throw new Error(`Timed out waiting for stable ${label}`);
}

class CdpSession {
    constructor(url) {
        this.socket = new WebSocket(url);
        this.nextId = 1;
        this.pending = new Map();
        this.events = new Map();
    }

    async connect() {
        await new Promise((resolve, reject) => {
            this.socket.addEventListener('open', resolve, { once: true });
            this.socket.addEventListener('error', reject, { once: true });
        });
        this.socket.addEventListener('message', event => {
            const message = JSON.parse(event.data);
            if (message.id) {
                const pending = this.pending.get(message.id);
                if (!pending) return;
                this.pending.delete(message.id);
                clearTimeout(pending.timeout);
                if (message.error) pending.reject(new Error(message.error.message));
                else pending.resolve(message.result);
                return;
            }
            for (const listener of this.events.get(message.method) || []) {
                listener(message.params);
            }
        });
    }

    call(method, params = {}) {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`CDP command timed out: ${method}`));
            }, TIMEOUT_MS);
            this.pending.set(id, { resolve, reject, timeout });
            this.socket.send(JSON.stringify({ id, method, params }));
        });
    }

    on(method, listener) {
        const listeners = this.events.get(method) || [];
        listeners.push(listener);
        this.events.set(method, listeners);
    }

    close() {
        this.socket.close();
    }
}

async function evaluate(session, expression) {
    const result = await session.call('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
    });
    if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result?.value;
}

async function navigate(session, url) {
    let pageLoaded = false;
    session.on('Page.loadEventFired', () => { pageLoaded = true; });
    await session.call('Page.navigate', { url });
    await waitFor(
        () => pageLoaded,
        `load event ${url}`
    );
    await waitFor(
        () => evaluate(session, `document.readyState === 'complete' && location.href === ${JSON.stringify(url)}`),
        `page load ${url}`
    );
}

function isCollectRequest(url) {
    try {
        const parsed = new URL(url);
        return /(^|\.)google-analytics\.com$/.test(parsed.hostname) &&
            /\/(?:g\/)?collect$/.test(parsed.pathname);
    } catch (error) {
        return false;
    }
}

function publicUrl(value) {
    try {
        const parsed = new URL(value);
        return `${parsed.origin}${parsed.pathname}`;
    } catch (error) {
        return 'unknown';
    }
}

function assert(condition, message, details = null) {
    if (!condition) {
        throw new Error(`${message}${details == null ? '' : `: ${JSON.stringify(details)}`}`);
    }
}

async function readPageState(session) {
    return evaluate(session, `(() => ({
        href: location.href,
        title: document.title,
        path: location.pathname,
        siteHeaderVisible: Boolean(document.querySelector('.site-header')),
        consent: (() => { try { return localStorage.getItem(${JSON.stringify(CONSENT_KEY)}); } catch (error) { return null; } })(),
        bannerVisible: Boolean(document.querySelector('[data-analytics-consent]')),
        tagScriptCount: [...document.scripts].filter(script => script.src.includes('googletagmanager.com/gtag/js')).length,
        tagLoaded: Boolean(window.google_tag_manager?.[${JSON.stringify(GOOGLE_TAG_ID)}]),
        analyticsApiPresent: Boolean(window.MythicalAnalytics),
        dataLayer: (window.dataLayer || []).map(item => Array.from(item).map(value => value instanceof Date ? 'date' : value))
    }))()`);
}

async function main() {
    if (!fs.existsSync(CHROME_PATH)) throw new Error(`Chrome was not found at ${CHROME_PATH}`);

    const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-analytics-consent-'));
    const chrome = spawn(CHROME_PATH, [
        '--headless=new',
        '--no-sandbox',
        '--no-first-run',
        `--remote-debugging-port=${DEBUG_PORT}`,
        `--user-data-dir=${profileDirectory}`,
        '--window-size=1280,720',
        'about:blank'
    ], { stdio: ['ignore', 'ignore', 'ignore'] });

    let session = null;
    let phase = 'opening';
    const requests = [];
    const responses = [];
    const sameOriginFailures = [];
    const origin = new URL(BASE_URL).origin;

    try {
        const target = await waitFor(async () => {
            const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
            const targets = await response.json();
            return targets.find(item => item.type === 'page') || null;
        }, 'Chrome DevTools target');

        session = new CdpSession(target.webSocketDebuggerUrl);
        await session.connect();
        await session.call('Page.enable');
        await session.call('Runtime.enable');
        await session.call('Network.enable');
        session.on('Network.requestWillBeSent', event => {
            requests.push({
                phase,
                requestId: event.requestId || '',
                url: event.request?.url || '',
                type: event.type || 'Other'
            });
        });
        session.on('Network.responseReceived', event => {
            responses.push({
                phase,
                url: event.response?.url || '',
                status: Number(event.response?.status) || 0
            });
        });
        session.on('Network.loadingFailed', event => {
            const request = requests.findLast(item => item.requestId === event.requestId);
            if (request?.url?.startsWith(origin)) {
                sameOriginFailures.push({ phase, url: publicUrl(request.url), error: event.errorText });
            }
        });

        await navigate(session, `${BASE_URL}/`);
        await waitForStable(
            () => evaluate(session, `Boolean(
                document.querySelector('.site-header') &&
                document.querySelector('[data-analytics-consent]')
            )`),
            'finished storefront and fresh visitor analytics choice'
        );
        const fresh = await readPageState(session);
        const preChoiceCollects = requests.filter(item => isCollectRequest(item.url));
        const preChoiceEvents = fresh.dataLayer.filter(item => item[0] === 'event');
        assert(fresh.consent === null, 'Fresh profile already had a saved analytics choice', fresh);
        assert(fresh.bannerVisible, 'Fresh profile did not show the analytics choice', fresh);
        assert(fresh.tagScriptCount === 1, 'Homepage Google tag script count was not one', fresh);
        assert(preChoiceCollects.length === 0, 'Analytics collection started before a choice', preChoiceCollects);
        assert(preChoiceEvents.length === 0, 'An analytics event was queued before a choice', preChoiceEvents);

        phase = 'denied';
        await evaluate(session, 'document.querySelector("[data-analytics-deny]").click()');
        await waitFor(
            () => evaluate(session, `localStorage.getItem(${JSON.stringify(CONSENT_KEY)}) === 'denied' && !document.querySelector('[data-analytics-consent]')`),
            'denied choice to persist'
        );
        await delay(800);
        const denied = await readPageState(session);
        const deniedCollects = requests.filter(item => item.phase === 'denied' && isCollectRequest(item.url));
        const deniedEvents = denied.dataLayer.filter(item => item[0] === 'event');
        assert(denied.consent === 'denied' && !denied.bannerVisible, 'No thanks did not persist cleanly', denied);
        assert(deniedCollects.length === 0, 'Analytics collection ran after No thanks', deniedCollects);
        assert(deniedEvents.length === 0, 'An analytics event was queued after No thanks', deniedEvents);

        phase = 'denied_reload';
        await navigate(session, `${BASE_URL}/`);
        await waitForStable(
            () => evaluate(session, `Boolean(
                document.querySelector('.site-header') &&
                localStorage.getItem(${JSON.stringify(CONSENT_KEY)}) === 'denied' &&
                !document.querySelector('[data-analytics-consent]')
            )`),
            'denied storefront reload'
        );
        const deniedReload = await readPageState(session);
        const deniedReloadCollects = requests.filter(item => item.phase === 'denied_reload' && isCollectRequest(item.url));
        const deniedReloadEvents = deniedReload.dataLayer.filter(item => item[0] === 'event');
        assert(deniedReload.consent === 'denied' && !deniedReload.bannerVisible, 'Denied choice was not retained on reload', deniedReload);
        assert(deniedReloadCollects.length === 0, 'Analytics collection ran after a denied reload', deniedReloadCollects);
        assert(deniedReloadEvents.length === 0, 'An analytics event was queued after a denied reload', deniedReloadEvents);

        await evaluate(session, `localStorage.removeItem(${JSON.stringify(CONSENT_KEY)})`);
        phase = 'fresh_allow';
        await navigate(session, `${BASE_URL}/`);
        await waitForStable(
            () => evaluate(session, `Boolean(
                document.querySelector('.site-header') &&
                document.querySelector('[data-analytics-allow]')
            )`),
            'fresh storefront analytics allow choice'
        );
        await evaluate(session, 'document.querySelector("[data-analytics-allow]").click()');
        await waitFor(
            () => evaluate(session, `(window.dataLayer || []).some(item => item[0] === 'event' && item[1] === 'discovery_arrival')`),
            'approved discovery arrival event'
        );
        await delay(800);
        const allowed = await readPageState(session);
        const allowedCollects = requests.filter(item => item.phase === 'fresh_allow' && isCollectRequest(item.url));
        const allowedResponses = responses.filter(item => item.phase === 'fresh_allow' && isCollectRequest(item.url));
        const allowedEvents = allowed.dataLayer.filter(item => item[0] === 'event').map(item => item[1]);
        assert(allowed.consent === 'granted' && !allowed.bannerVisible, 'Allow analytics did not persist cleanly', allowed);
        assert(allowed.dataLayer.some(item => item[0] === 'consent' && item[1] === 'update' && item[2]?.analytics_storage === 'granted'), 'Granted consent update was missing', allowed.dataLayer);
        assert(allowed.dataLayer.some(item => item[0] === 'event' && item[1] === 'discovery_arrival'), 'Approved arrival event was missing', allowed.dataLayer);
        assert(allowedEvents.length === 1 && allowedEvents[0] === 'discovery_arrival', 'An unapproved event was queued after permission', allowedEvents);

        phase = 'game';
        await navigate(session, `${BASE_URL}/play/`);
        await waitForStable(
            () => evaluate(session, `document.title === 'Play Mythical Void' && Boolean(document.querySelector('#game'))`),
            'game route without website analytics'
        );
        const game = await readPageState(session);
        const gameGoogleRequests = requests.filter(item => item.phase === 'game' && /google(?:tagmanager|-analytics)\.com/.test(item.url));
        assert(game.path === '/play/', 'Game route did not load', game);
        assert(game.tagScriptCount === 0 && game.analyticsApiPresent === false, 'Google tag leaked into the game route', game);
        assert(gameGoogleRequests.length === 0, 'Google request leaked into the game route', gameGoogleRequests);
        assert(sameOriginFailures.length === 0, 'Same-origin resources failed during the consent journey', sameOriginFailures);

        console.log(JSON.stringify({
            success: true,
            checkedUrl: `${BASE_URL}/`,
            measurementId: GOOGLE_TAG_ID,
            freshChoiceShown: true,
            tagScriptExecutedInTestBrowser: allowed.tagLoaded,
            collectionRequestsBeforeChoice: preChoiceCollects.length,
            deniedChoicePersisted: true,
            collectionRequestsAfterDeny: deniedCollects.length + deniedReloadCollects.length,
            grantedChoicePersisted: true,
            approvedArrivalQueued: true,
            approvedCollectionRequestCount: allowedCollects.length,
            approvedCollectionResponseStatuses: allowedResponses.map(item => item.status),
            collectionTransportObserved: allowedCollects.length > 0,
            gameTagScriptCount: game.tagScriptCount,
            gameGoogleRequestCount: gameGoogleRequests.length,
            sameOriginFailureCount: sameOriginFailures.length,
            note: 'This was a consent verification visit, not evidence of a player, play, conversion, retention, enjoyment or growth.'
        }, null, 2));
    } finally {
        session?.close();
        chrome.kill('SIGKILL');
        chrome.unref();
        await delay(300);
        fs.rmSync(profileDirectory, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
});
