const observabilityFunction = require('../../netlify/lib/observability-events-core.cjs');

const NOW = Date.parse('2026-08-11T12:00:00.000Z');
const VALID_EVENT = Object.freeze({
    schema_version: 1,
    event_id: '824363b2-d374-4b44-bf7f-1d7a177fa074',
    occurred_at: '2026-08-11T11:59:30.000Z',
    category: 'persistence',
    code: 'cloud_sync_failed',
    severity: 'warning',
    scene: 'GameScene',
    phase: 'sync',
    recovery: 'local_fallback',
    connectivity: 'online',
    viewport_class: 'compact',
    user_visible: false,
    deployment_id: 'client_commit_23'
});

function request(body, options = {}) {
    return {
        httpMethod: options.method || 'POST',
        headers: {
            host: 'mythicalvoid.com',
            ...(options.includeOrigin === false
                ? {}
                : { origin: options.origin || 'https://mythicalvoid.com' })
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    };
}

function createAdminClient(error = null) {
    const upsert = jest.fn(async () => ({ error }));
    return {
        from: jest.fn(() => ({ upsert })),
        upsert
    };
}

describe('privacy observability Netlify collector', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-test-key';
        process.env.DEPLOY_ID = 'deploy_23';
        observabilityFunction._internal.setRuntime({ now: () => NOW });
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        observabilityFunction._internal.resetRuntime();
        jest.restoreAllMocks();
    });

    test('accepts an allowlisted batch without any player identifier', async () => {
        const adminClient = createAdminClient();
        observabilityFunction._internal.setRuntime({
            createClient: () => adminClient,
            now: () => NOW
        });

        const response = await observabilityFunction.handler(request({
            events: [VALID_EVENT]
        }));

        expect(response.statusCode).toBe(202);
        expect(JSON.parse(response.body)).toEqual({ accepted: 1 });
        const rows = adminClient.upsert.mock.calls[0][0];
        expect(rows[0]).toEqual(expect.objectContaining({
            id: VALID_EVENT.event_id,
            code: 'cloud_sync_failed',
            deployment_id: 'client_commit_23'
        }));
        expect(JSON.stringify(rows)).not.toMatch(/user_id|session|creature|message|stack|latitude|longitude/i);
    });

    test('prefers the independently rotatable secret key over the legacy fallback', async () => {
        process.env.SUPABASE_SECRET_KEY = 'rotatable-secret-key';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-role-key';
        const adminClient = createAdminClient();
        const createClient = jest.fn(() => adminClient);
        observabilityFunction._internal.setRuntime({ createClient, now: () => NOW });

        const response = await observabilityFunction.handler(request({
            events: [VALID_EVENT]
        }));

        expect(response.statusCode).toBe(202);
        expect(createClient.mock.calls[0][1]).toBe('rotatable-secret-key');
    });

    test('accepts an in-flight legacy event and applies the function fallback marker', async () => {
        const adminClient = createAdminClient();
        observabilityFunction._internal.setRuntime({
            createClient: () => adminClient,
            now: () => NOW
        });
        const legacyEvent = { ...VALID_EVENT };
        delete legacyEvent.deployment_id;

        const response = await observabilityFunction.handler(request({
            events: [legacyEvent]
        }));

        expect(response.statusCode).toBe(202);
        expect(adminClient.upsert.mock.calls[0][0][0].deployment_id).toBe('deploy_23');
    });

    test('rejects missing or cross-origin requests', async () => {
        const createClient = jest.fn();
        observabilityFunction._internal.setRuntime({ createClient, now: () => NOW });

        const missingOrigin = await observabilityFunction.handler(request(
            { events: [VALID_EVENT] },
            { includeOrigin: false }
        ));
        const crossOrigin = await observabilityFunction.handler(request(
            { events: [VALID_EVENT] },
            { origin: 'https://example.test' }
        ));

        expect(missingOrigin.statusCode).toBe(403);
        expect(crossOrigin.statusCode).toBe(403);
        expect(createClient).not.toHaveBeenCalled();
    });

    test('rejects free text, unknown fields, stale timestamps, and arbitrary scenes', async () => {
        const createClient = jest.fn();
        observabilityFunction._internal.setRuntime({ createClient, now: () => NOW });

        const withFreeText = await observabilityFunction.handler(request({
            events: [{ ...VALID_EVENT, creatureName: 'Nova' }]
        }));
        const arbitraryScene = await observabilityFunction.handler(request({
            events: [{ ...VALID_EVENT, scene: 'Nova secret room' }]
        }));
        const arbitraryDeployment = await observabilityFunction.handler(request({
            events: [{ ...VALID_EVENT, deployment_id: 'commit contains spaces' }]
        }));
        const staleTimestamp = await observabilityFunction.handler(request({
            events: [{ ...VALID_EVENT, occurred_at: '2026-08-01T12:00:00.000Z' }]
        }));

        expect(withFreeText.statusCode).toBe(400);
        expect(arbitraryScene.statusCode).toBe(400);
        expect(arbitraryDeployment.statusCode).toBe(400);
        expect(staleTimestamp.statusCode).toBe(400);
        expect(createClient).not.toHaveBeenCalled();
    });

    test('returns a retryable service response without echoing storage details', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        const adminClient = createAdminClient({
            code: 'DATABASE_UNAVAILABLE',
            message: 'row included Nova at child@example.com'
        });
        observabilityFunction._internal.setRuntime({
            createClient: () => adminClient,
            now: () => NOW
        });

        const response = await observabilityFunction.handler(request({
            events: [VALID_EVENT]
        }));

        expect(response.statusCode).toBe(503);
        expect(response.body).not.toContain('Nova');
        expect(response.body).not.toContain('child@example.com');
        expect(consoleError).toHaveBeenCalledWith(
            '[Observability] Storage unavailable',
            'DATABASE_UNAVAILABLE'
        );
    });
});
