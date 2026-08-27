const spaceSignalCore = require('../../netlify/lib/space-signal-core.cjs');

const { handler, _internal } = spaceSignalCore;

describe('public Space Signal function', () => {
    afterEach(() => {
        _internal.setRuntime({
            fetch: (...args) => globalThis.fetch(...args),
            now: () => new Date(),
            env: () => process.env
        });
    });

    test('returns only the safe APOD title, date and source link', async () => {
        const fetchMock = jest.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                title: '  A <b>Strange</b> Nebula  ',
                date: '2026-08-27',
                media_type: 'image',
                url: 'https://example.com/third-party-image.jpg',
                hdurl: 'https://example.com/third-party-image-hd.jpg',
                explanation: 'This text is deliberately not republished.',
                copyright: 'A third-party photographer'
            })
        }));
        _internal.setRuntime({
            fetch: fetchMock,
            now: () => new Date('2026-08-27T12:00:00Z'),
            env: () => ({ NASA_API_KEY: 'server-only-test-key' })
        });

        const response = await handler({ httpMethod: 'GET' });
        const payload = JSON.parse(response.body);

        expect(response.statusCode).toBe(200);
        expect(payload.status).toBe('live');
        expect(payload.title).toBe('A Strange Nebula');
        expect(payload.signalDate).toBe('2026-08-27');
        expect(payload.source.url).toBe('https://apod.nasa.gov/apod/ap260827.html');
        expect(payload.boundaries.nasaImageRepublished).toBe(false);
        expect(payload.boundaries.nasaEndorsementClaimed).toBe(false);
        expect(response.body).not.toContain('third-party-image');
        expect(response.body).not.toContain('deliberately not republished');
        expect(response.body).not.toContain('third-party photographer');
        expect(response.body).not.toContain('server-only-test-key');
    });

    test('uses a checked observation when NASA is unavailable', async () => {
        _internal.setRuntime({
            fetch: jest.fn(async () => { throw new Error('offline'); }),
            now: () => new Date('2026-08-27T12:00:00Z'),
            env: () => ({})
        });

        const response = await handler({ httpMethod: 'GET' });
        const payload = JSON.parse(response.body);

        expect(response.statusCode).toBe(200);
        expect(payload.status).toBe('saved-observation');
        expect(payload.title).toBe('Apollo 11 Landing Panorama');
        expect(payload.source.url).toBe('https://apod.nasa.gov/apod/ap240720.html');
        expect(payload.servedOn).toBe('2026-08-27');
    });

    test('supports HEAD and rejects state-changing methods', async () => {
        _internal.setRuntime({
            fetch: jest.fn(async () => ({
                ok: true,
                status: 200,
                json: async () => ({ title: 'A Signal', date: '2026-08-27' })
            })),
            now: () => new Date('2026-08-27T12:00:00Z'),
            env: () => ({})
        });

        const head = await handler({ httpMethod: 'HEAD' });
        const post = await handler({ httpMethod: 'POST' });

        expect(head.statusCode).toBe(200);
        expect(head.body).toBe('');
        expect(head.headers['Netlify-CDN-Cache-Control']).toContain('durable');
        expect(post.statusCode).toBe(405);
        expect(post.headers.Allow).toBe('GET, HEAD');
    });
});
