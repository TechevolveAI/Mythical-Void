'use strict';

const FALLBACK_DISCOVERY = Object.freeze({
    observationDate: '2024-07-20',
    title: 'Apollo 11 Landing Panorama',
    sourceUrl: 'https://apod.nasa.gov/apod/ap240720.html'
});

const runtime = {
    fetch: (...args) => globalThis.fetch(...args),
    now: () => new Date(),
    env: () => process.env
};

function setRuntime(overrides = {}) {
    Object.assign(runtime, overrides);
}

function cleanTitle(value) {
    return String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 140);
}

function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function sourceUrlForDate(value) {
    const compact = String(value || '').replace(/-/g, '');
    return /^\d{8}$/.test(compact)
        ? `https://apod.nasa.gov/apod/ap${compact.slice(2)}.html`
        : 'https://apod.nasa.gov/apod/astropix.html';
}

function visualSeed(value) {
    let hash = 2166136261;
    for (const character of String(value || '')) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function buildDiscovery({ title, observationDate, sourceUrl, live }) {
    const safeTitle = cleanTitle(title) || FALLBACK_DISCOVERY.title;
    const safeDate = validDate(observationDate) ? observationDate : FALLBACK_DISCOVERY.observationDate;
    const safeSource = /^https:\/\/apod\.nasa\.gov\/apod\//.test(String(sourceUrl || ''))
        ? sourceUrl
        : sourceUrlForDate(safeDate);

    return {
        schemaVersion: 1,
        status: live ? 'live' : 'saved-observation',
        observationDate: safeDate,
        title: safeTitle,
        observationCode: `APOD-${safeDate.replace(/-/g, '')}`,
        visualSeed: visualSeed(`${safeDate}:${safeTitle}`),
        source: {
            label: 'NASA Astronomy Picture of the Day',
            url: safeSource
        },
        scientistMission: [
            'OBSERVE — Find one shape, colour, edge or change.',
            'INFER — What could have caused it?',
            'CHECK — What other evidence would test your idea?'
        ],
        imaginedQuestion: 'If that pattern were normal in another dimension, what kind of creature could sense it—and how would it move?',
        boundaries: {
            sourceIsReal: true,
            mythicalQuestionIsFiction: true,
            nasaImageRepublished: false,
            nasaEndorsementClaimed: false,
            note: 'Mythical Void does not reproduce the daily APOD image here. Open the credited NASA source to see the observation and its full rights information.'
        }
    };
}

async function fetchTodayDiscovery() {
    const env = runtime.env() || {};
    const apiKey = env.NASA_API_KEY || env.VITE_NASA_API_KEY || 'DEMO_KEY';
    const controller = typeof AbortController !== 'undefined'
        ? new AbortController()
        : null;
    const timeoutId = setTimeout(() => controller?.abort?.(), 6500);

    try {
        const response = await runtime.fetch(
            `https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(apiKey)}`,
            controller ? { signal: controller.signal } : {}
        );
        if (!response?.ok) throw new Error(`NASA APOD returned ${response?.status || 'no response'}`);
        const data = await response.json();
        const title = cleanTitle(data?.title);
        const observationDate = String(data?.date || '');
        if (!title || !validDate(observationDate)) throw new Error('NASA APOD response was incomplete');

        return buildDiscovery({
            title,
            observationDate,
            sourceUrl: sourceUrlForDate(observationDate),
            live: true
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

function responseHeaders() {
    return {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, must-revalidate',
        'Netlify-CDN-Cache-Control': 'public, durable, max-age=21600, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff'
    };
}

async function handler(event = {}) {
    const method = String(event.httpMethod || 'GET').toUpperCase();
    if (!['GET', 'HEAD'].includes(method)) {
        return {
            statusCode: 405,
            headers: { ...responseHeaders(), Allow: 'GET, HEAD' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    let discovery;
    try {
        discovery = await fetchTodayDiscovery();
    } catch (_error) {
        discovery = buildDiscovery({
            ...FALLBACK_DISCOVERY,
            live: false
        });
    }

    const payload = {
        ...discovery,
        servedOn: runtime.now().toISOString().slice(0, 10)
    };

    return {
        statusCode: 200,
        headers: responseHeaders(),
        body: method === 'HEAD' ? '' : JSON.stringify(payload)
    };
}

module.exports = {
    FALLBACK_DISCOVERY,
    buildDiscovery,
    cleanTitle,
    handler,
    sourceUrlForDate,
    visualSeed,
    _internal: { setRuntime }
};
