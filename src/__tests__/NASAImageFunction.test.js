const nasaImageCore = require('../../netlify/lib/nasa-image-core.cjs');

const { handler, parseOfficialNasaUrl, _internal } = nasaImageCore;

function headers(values = {}) {
    const normalized = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)])
    );
    return { get: key => normalized[String(key).toLowerCase()] || null };
}

function response({
    status = 200,
    contentType = 'image/jpeg',
    body = Buffer.from('nasa-image'),
    extraHeaders = {}
} = {}) {
    return {
        status,
        ok: status >= 200 && status < 300,
        headers: headers({
            'content-type': contentType,
            'content-length': body.length,
            ...extraHeaders
        }),
        body: null,
        arrayBuffer: async () => body
    };
}

describe('NASA image delivery function', () => {
    let fetchMock;

    beforeEach(() => {
        fetchMock = jest.fn();
        _internal.setRuntime({
            fetch: fetchMock,
            setTimeout,
            clearTimeout
        });
    });

    test('accepts only HTTPS URLs on official NASA hosts', () => {
        expect(parseOfficialNasaUrl('https://apod.nasa.gov/image/example.jpg').href)
            .toBe('https://apod.nasa.gov/image/example.jpg');
        expect(parseOfficialNasaUrl('https://images-assets.nasa.gov/image/example.jpg'))
            .not.toBeNull();
        expect(parseOfficialNasaUrl('http://apod.nasa.gov/image/example.jpg')).toBeNull();
        expect(parseOfficialNasaUrl('https://nasa.gov.example.com/image.jpg')).toBeNull();
        expect(parseOfficialNasaUrl('https://user@nasa.gov/image.jpg')).toBeNull();
    });

    test('returns a cacheable same-origin image for a valid NASA source', async () => {
        fetchMock.mockResolvedValue(response());
        const result = await handler({
            httpMethod: 'GET',
            queryStringParameters: {
                url: 'https://apod.nasa.gov/apod/image/example.jpg'
            }
        });

        expect(result.statusCode).toBe(200);
        expect(result.headers['Content-Type']).toBe('image/jpeg');
        expect(result.headers['X-Mythical-NASA-Image']).toBe('source');
        expect(result.headers['Netlify-CDN-Cache-Control']).toContain('max-age=86400');
        expect(Buffer.from(result.body, 'base64').toString()).toBe('nasa-image');
        expect(fetchMock).toHaveBeenCalledWith(
            'https://apod.nasa.gov/apod/image/example.jpg',
            expect.objectContaining({ redirect: 'manual' })
        );
    });

    test('returns a successful labelled fallback when NASA is unavailable', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));
        const result = await handler({
            httpMethod: 'GET',
            queryStringParameters: {
                url: 'https://apod.nasa.gov/apod/image/example.jpg'
            }
        });

        expect(result.statusCode).toBe(200);
        expect(result.headers['Content-Type']).toContain('image/svg+xml');
        expect(result.headers['X-Mythical-NASA-Image']).toBe('fallback');
        expect(Buffer.from(result.body, 'base64').toString())
            .toContain('NASA IMAGE TEMPORARILY UNAVAILABLE');
    });

    test('rejects invalid URLs and non-image upstream responses', async () => {
        const invalid = await handler({
            httpMethod: 'GET',
            queryStringParameters: { url: 'https://example.com/image.jpg' }
        });
        expect(invalid.statusCode).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();

        fetchMock.mockResolvedValue(response({ contentType: 'text/html' }));
        const wrongType = await handler({
            httpMethod: 'GET',
            queryStringParameters: {
                url: 'https://apod.nasa.gov/apod/image/example.jpg'
            }
        });
        expect(wrongType.statusCode).toBe(200);
        expect(wrongType.headers['X-Mythical-NASA-Image']).toBe('fallback');
    });

    test('does not buffer an image whose declared size exceeds the limit', async () => {
        fetchMock.mockResolvedValue(response({
            extraHeaders: { 'content-length': nasaImageCore.MAX_IMAGE_BYTES + 1 }
        }));
        const result = await handler({
            httpMethod: 'GET',
            queryStringParameters: {
                url: 'https://apod.nasa.gov/apod/image/too-large.jpg'
            }
        });

        expect(result.statusCode).toBe(200);
        expect(result.headers['X-Mythical-NASA-Image']).toBe('fallback');
    });

    test('never follows a redirect outside NASA', async () => {
        fetchMock.mockResolvedValue(response({
            status: 302,
            extraHeaders: { location: 'https://example.com/not-nasa.jpg' }
        }));
        const result = await handler({
            httpMethod: 'GET',
            queryStringParameters: {
                url: 'https://apod.nasa.gov/apod/image/example.jpg'
            }
        });

        expect(result.statusCode).toBe(200);
        expect(result.headers['X-Mythical-NASA-Image']).toBe('fallback');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
