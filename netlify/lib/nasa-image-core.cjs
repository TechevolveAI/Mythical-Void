'use strict';

const MAX_SOURCE_URL_LENGTH = 2048;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 7000;
const MAX_REDIRECTS = 3;
const ALLOWED_IMAGE_TYPES = new Set([
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp'
]);

const runtime = {
    fetch: (...args) => globalThis.fetch(...args),
    setTimeout,
    clearTimeout
};

function setRuntime(overrides = {}) {
    Object.assign(runtime, overrides);
}

function parseOfficialNasaUrl(value) {
    if (typeof value !== 'string' || value.length < 1 || value.length > MAX_SOURCE_URL_LENGTH) {
        return null;
    }

    try {
        const parsed = new URL(value);
        const hostname = parsed.hostname.toLowerCase();
        const officialHost = hostname === 'nasa.gov' || hostname.endsWith('.nasa.gov');
        if (
            parsed.protocol !== 'https:' ||
            !officialHost ||
            parsed.username ||
            parsed.password ||
            parsed.port
        ) {
            return null;
        }
        parsed.hash = '';
        return parsed;
    } catch (_error) {
        return null;
    }
}

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
        },
        body: JSON.stringify(body)
    };
}

function imageHeaders(contentType, { fallback = false } = {}) {
    return {
        'Content-Type': contentType,
        'Cache-Control': fallback
            ? 'public, max-age=300, must-revalidate'
            : 'public, max-age=86400, stale-while-revalidate=604800',
        'Netlify-CDN-Cache-Control': fallback
            ? 'public, durable, max-age=300'
            : 'public, durable, max-age=86400, stale-while-revalidate=604800',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'X-Content-Type-Options': 'nosniff',
        'X-Mythical-NASA-Image': fallback ? 'fallback' : 'source'
    };
}

function fallbackImage() {
    const svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">',
        '<rect width="960" height="540" fill="#0d1026"/>',
        '<circle cx="190" cy="160" r="92" fill="#1d3154"/>',
        '<path d="M0 410 Q210 330 430 410 T960 385 V540 H0Z" fill="#293650"/>',
        '<g fill="#8fe3cf"><circle cx="690" cy="105" r="5"/><circle cx="760" cy="160" r="3"/><circle cx="830" cy="90" r="4"/></g>',
        '<text x="480" y="260" fill="#ffffff" font-family="Arial, sans-serif" font-size="32" font-weight="700" text-anchor="middle">NASA IMAGE TEMPORARILY UNAVAILABLE</text>',
        '<text x="480" y="308" fill="#8fe3cf" font-family="Arial, sans-serif" font-size="22" text-anchor="middle">The source record and credit remain available below.</text>',
        '</svg>'
    ].join('');
    return Buffer.from(svg, 'utf8');
}

async function fetchWithValidatedRedirects(source, signal) {
    let current = source;
    for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
        const response = await runtime.fetch(current.href, {
            method: 'GET',
            redirect: 'manual',
            signal,
            headers: {
                Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1',
                'User-Agent': 'MythicalVoid/1.0 (+https://mythicalvoid.com/)'
            }
        });

        if (response.status < 300 || response.status >= 400) return response;
        const location = response.headers.get('location');
        const next = location
            ? parseOfficialNasaUrl(new URL(location, current).href)
            : null;
        if (!next || attempt === MAX_REDIRECTS) {
            throw new Error('NASA image redirect was not allowed');
        }
        current = next;
    }
    throw new Error('NASA image redirect limit exceeded');
}

async function readBoundedBody(response) {
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
        throw new Error('NASA image exceeded the size limit');
    }

    if (!response.body?.getReader) {
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > MAX_IMAGE_BYTES) {
            throw new Error('NASA image exceeded the size limit');
        }
        return buffer;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_IMAGE_BYTES) {
            await reader.cancel().catch(() => null);
            throw new Error('NASA image exceeded the size limit');
        }
        chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
}

async function handler(event = {}) {
    const method = String(event.httpMethod || 'GET').toUpperCase();
    if (!['GET', 'HEAD'].includes(method)) {
        const response = json(405, { error: 'Method not allowed' });
        response.headers.Allow = 'GET, HEAD';
        return response;
    }

    const source = parseOfficialNasaUrl(event.queryStringParameters?.url);
    if (!source) return json(400, { error: 'Invalid NASA image URL' });

    const controller = typeof AbortController !== 'undefined'
        ? new AbortController()
        : null;
    const timeoutId = runtime.setTimeout(
        () => controller?.abort?.(),
        UPSTREAM_TIMEOUT_MS
    );

    try {
        const response = await fetchWithValidatedRedirects(source, controller?.signal);
        const contentType = String(response.headers.get('content-type') || '')
            .split(';')[0]
            .trim()
            .toLowerCase();
        if (!response.ok || !ALLOWED_IMAGE_TYPES.has(contentType)) {
            throw new Error('NASA image response was unavailable');
        }
        const body = method === 'HEAD' ? Buffer.alloc(0) : await readBoundedBody(response);
        return {
            statusCode: 200,
            headers: imageHeaders(contentType),
            body: body.toString('base64'),
            isBase64Encoded: true
        };
    } catch (_error) {
        const body = method === 'HEAD' ? Buffer.alloc(0) : fallbackImage();
        return {
            statusCode: 200,
            headers: imageHeaders('image/svg+xml; charset=utf-8', { fallback: true }),
            body: body.toString('base64'),
            isBase64Encoded: true
        };
    } finally {
        runtime.clearTimeout(timeoutId);
    }
}

module.exports = {
    ALLOWED_IMAGE_TYPES,
    MAX_IMAGE_BYTES,
    handler,
    parseOfficialNasaUrl,
    _internal: { setRuntime }
};
