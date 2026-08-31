const livePresenceFunction = require('../../netlify/lib/live-presence-core.cjs');

const { handler, _internal } = livePresenceFunction;
const SESSION_ID = '9be131ea-c9fc-4fc5-afb1-2e0c174ef643';

function request(method = 'GET', options = {}) {
    return {
        httpMethod: method,
        headers: {
            host: 'mythicalvoid.com',
            origin: 'https://mythicalvoid.com',
            ...options.headers
        },
        body: options.body
    };
}

function createAdminClient(count = 0, error = null) {
    return {
        rpc: jest.fn().mockResolvedValue({ data: count, error })
    };
}

describe('privacy-safe live game presence function', () => {
    const previousSecret = process.env.SUPABASE_SECRET_KEY;

    beforeEach(() => {
        process.env.SUPABASE_SECRET_KEY = 'test-secret';
        _internal.resetRuntime();
    });

    afterAll(() => {
        if (previousSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
        else process.env.SUPABASE_SECRET_KEY = previousSecret;
        _internal.resetRuntime();
    });

    test.each([
        [0, 'quiet', null],
        [1, 'one', '1'],
        [2, 'two_to_three', '2–3'],
        [3, 'two_to_three', '2–3'],
        [4, 'four_to_six', '4–6'],
        [6, 'four_to_six', '4–6'],
        [7, 'seven_to_ten', '7–10'],
        [11, 'more_than_ten', '10+']
    ])('buckets %s active sessions without inventing a baseline', (count, status, range) => {
        expect(_internal.bucketForCount(count)).toEqual({ key: status, label: range });
    });

    test('reads the current bucket without creating a website session', async () => {
        const adminClient = createAdminClient(3);
        _internal.setRuntime({ createClient: () => adminClient });

        const response = await handler(request('GET', {
            headers: { origin: undefined }
        }));

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            status: 'two_to_three',
            range: '2–3',
            activeWindowSeconds: 90,
            approximate: true
        });
        expect(adminClient.rpc).toHaveBeenCalledWith('touch_live_game_presence', {
            p_session_hash: null,
            p_active_seconds: 90
        });
    });

    test('hashes a valid same-origin game heartbeat before storage', async () => {
        const adminClient = createAdminClient(5);
        _internal.setRuntime({ createClient: () => adminClient });

        const response = await handler(request('POST', {
            body: JSON.stringify({ sessionId: SESSION_ID })
        }));

        expect(response.statusCode).toBe(200);
        const rpcPayload = adminClient.rpc.mock.calls[0][1];
        expect(rpcPayload.p_session_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(rpcPayload.p_session_hash).not.toContain(SESSION_ID);
        expect(JSON.parse(response.body).range).toBe('4–6');
    });

    test('rejects cross-origin, malformed and oversized heartbeats', async () => {
        const createClient = jest.fn();
        _internal.setRuntime({ createClient });

        const crossOrigin = await handler(request('POST', {
            headers: { origin: 'https://example.com' },
            body: JSON.stringify({ sessionId: SESSION_ID })
        }));
        const malformed = await handler(request('POST', {
            body: JSON.stringify({ sessionId: 'not-a-session' })
        }));
        const oversized = await handler(request('POST', {
            body: JSON.stringify({ sessionId: SESSION_ID, padding: 'x'.repeat(220) })
        }));

        expect(crossOrigin.statusCode).toBe(403);
        expect(malformed.statusCode).toBe(400);
        expect(oversized.statusCode).toBe(400);
        expect(createClient).not.toHaveBeenCalled();
    });

    test('fails quietly when the private store is unavailable', async () => {
        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
        _internal.setRuntime({
            createClient: () => createAdminClient(null, { code: 'unavailable' })
        });

        const response = await handler(request('GET'));

        expect(response.statusCode).toBe(503);
        expect(JSON.parse(response.body)).toEqual({ error: 'Live presence unavailable' });
        expect(errorLog).toHaveBeenCalledWith(
            '[Live presence] Storage unavailable',
            'unavailable'
        );
        errorLog.mockRestore();
    });

    test('rejects unsupported methods', async () => {
        const response = await handler(request('PUT'));
        expect(response.statusCode).toBe(405);
    });
});
