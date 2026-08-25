const {
    ErrorHandler,
    PrivacyObservabilityTransport,
    OBSERVABILITY_STORAGE_KEY
} = require('../systems/ErrorHandler.js');

function okResponse() {
    return Promise.resolve({ ok: true });
}

describe('privacy-conscious runtime observability', () => {
    let consoleError;
    let consoleWarn;

    beforeEach(() => {
        localStorage.clear();
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
        consoleWarn.mockRestore();
        jest.restoreAllMocks();
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    test('sends only allowlisted dimensions and never raw error content', async () => {
        const send = jest.fn(okResponse);
        const handler = new ErrorHandler();
        handler.maxMessagesPerSession = 0;
        handler.observability = new PrivacyObservabilityTransport({
            storage: localStorage,
            fetch: send,
            now: () => Date.parse('2026-08-11T12:00:00.000Z')
        });

        handler.handleError({
            type: 'network',
            message: 'Failed to fetch save for Nova at child@example.com',
            stack: 'coordinates=53.3498,-6.2603',
            source: 'https://example.test/play?creature=Nova',
            scene: 'GameScene',
            error: { saveData: { creatureName: 'Nova' } },
            severity: 'error'
        });
        await handler.observability.flush();

        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toBe('/.netlify/functions/observability-events');
        const body = send.mock.calls[0][1].body;
        const payload = JSON.parse(body);
        expect(payload.events[0]).toMatchObject({
            category: 'persistence',
            code: 'cloud_sync_failed',
            scene: 'GameScene',
            recovery: 'local_fallback',
            connectivity: expect.stringMatching(/^(online|offline|unknown)$/),
            viewport_class: expect.stringMatching(/^(compact|medium|wide|unknown)$/)
        });
        expect(body).not.toContain('Nova');
        expect(body).not.toContain('child@example.com');
        expect(body).not.toContain('53.3498');
        expect(body).not.toContain('saveData');
        expect(handler.getErrorStats().recent[0]).toEqual(expect.objectContaining({
            code: 'cloud_sync_failed',
            scene: 'GameScene'
        }));
        expect(JSON.stringify(handler.getErrorStats())).not.toContain('Nova');
    });

    test('retains a bounded sanitized queue until remote delivery succeeds', async () => {
        jest.useFakeTimers();
        const send = jest.fn()
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce({ ok: true });
        const transport = new PrivacyObservabilityTransport({
            storage: localStorage,
            fetch: send,
            now: () => Date.parse('2026-08-11T12:00:00.000Z')
        });

        transport.capture({
            category: 'persistence',
            code: 'local_save_failed',
            severity: 'warning',
            scene: 'GameScene',
            phase: 'save',
            recovery: 'retry_scheduled'
        });
        await transport.flush();

        const stored = JSON.parse(localStorage.getItem(OBSERVABILITY_STORAGE_KEY));
        expect(stored).toHaveLength(1);
        expect(Object.keys(stored[0]).sort()).toEqual([
            'category',
            'code',
            'connectivity',
            'event_id',
            'occurred_at',
            'phase',
            'recovery',
            'scene',
            'schema_version',
            'severity',
            'user_visible',
            'viewport_class'
        ]);

        await transport.flush();
        expect(localStorage.getItem(OBSERVABILITY_STORAGE_KEY)).toBeNull();
    });

    test('disables optional delivery after a permanent missing-endpoint response', async () => {
        jest.useFakeTimers();
        const send = jest.fn().mockResolvedValue({ ok: false, status: 404 });
        const transport = new PrivacyObservabilityTransport({
            storage: localStorage,
            fetch: send
        });

        transport.capture({
            category: 'runtime',
            code: 'runtime_uncaught',
            severity: 'error',
            scene: 'GameScene',
            phase: 'runtime',
            recovery: 'reload_offered'
        });
        await transport.flush();

        expect(transport.deliveryDisabled).toBe(true);
        expect(transport.queue).toHaveLength(0);
        expect(transport.retryTimer).toBeNull();
        expect(transport.capture({
            category: 'runtime',
            code: 'runtime_uncaught',
            severity: 'error'
        })).toBe(false);
        expect(send).toHaveBeenCalledTimes(1);
    });

    test('cancels queued delivery retries when the transport is destroyed', async () => {
        jest.useFakeTimers();
        const send = jest.fn().mockResolvedValue({ ok: false });
        const transport = new PrivacyObservabilityTransport({
            storage: localStorage,
            fetch: send
        });

        transport.initialize();
        transport.capture({
            category: 'runtime',
            code: 'runtime_uncaught',
            severity: 'error',
            scene: 'GameScene',
            phase: 'runtime',
            recovery: 'reload_offered'
        });
        await transport.flush();

        expect(transport.retryTimer).not.toBeNull();
        transport.destroy();
        expect(transport.retryTimer).toBeNull();

        jest.advanceTimersByTime(10000);
        expect(send).toHaveBeenCalledTimes(1);
    });

    test('removes global browser listeners when the handler is destroyed', () => {
        const add = jest.spyOn(window, 'addEventListener');
        const remove = jest.spyOn(window, 'removeEventListener');
        const handler = new ErrorHandler();

        handler.setupGlobalHandlers();
        const runtimeListener = add.mock.calls.find(([type]) => type === 'error')[1];
        const rejectionListener = add.mock.calls.find(
            ([type]) => type === 'unhandledrejection'
        )[1];
        handler.destroy();

        expect(remove).toHaveBeenCalledWith('error', runtimeListener);
        expect(remove).toHaveBeenCalledWith('unhandledrejection', rejectionListener);
    });

    test('does not suppress generic network failures', async () => {
        const send = jest.fn(okResponse);
        const handler = new ErrorHandler();
        handler.maxMessagesPerSession = 0;
        handler.observability = new PrivacyObservabilityTransport({
            storage: localStorage,
            fetch: send
        });

        handler.handleError({
            type: 'promise',
            message: 'TypeError: Failed to fetch',
            severity: 'warning'
        });
        await handler.observability.flush();

        const payload = JSON.parse(send.mock.calls[0][1].body);
        expect(payload.events[0].code).toBe('network_request_failed');
    });

    test('reports objective no-active-scene and cloud failure states once', () => {
        const handler = new ErrorHandler();
        const capture = jest.spyOn(handler, 'captureOperationalEvent').mockReturnValue(true);
        const now = jest.spyOn(Date, 'now').mockReturnValue(100000);
        handler.lastHealthySceneAt = 87000;

        handler.checkSceneHealth({
            loop: { running: true },
            scene: { getScenes: () => [] }
        });
        handler.checkSceneHealth({
            loop: { running: true },
            scene: { getScenes: () => [] }
        });

        window.CloudSave = {
            getStatus: () => ({ status: 'error' })
        };
        handler.checkCloudSaveHealth();
        handler.checkCloudSaveHealth();

        expect(capture).toHaveBeenCalledWith(expect.objectContaining({
            code: 'scene_no_active',
            category: 'stuck_flow'
        }));
        expect(capture).toHaveBeenCalledWith(expect.objectContaining({
            code: 'cloud_sync_failed',
            recovery: 'local_fallback'
        }));
        expect(capture.mock.calls.filter(([event]) => event.code === 'scene_no_active')).toHaveLength(1);
        expect(capture.mock.calls.filter(([event]) => event.code === 'cloud_sync_failed')).toHaveLength(1);

        delete window.CloudSave;
        now.mockRestore();
    });

    test('maps unrecognized scene keys to unknown', async () => {
        const send = jest.fn(okResponse);
        const transport = new PrivacyObservabilityTransport({
            storage: localStorage,
            fetch: send
        });

        transport.capture({
            category: 'scene_transition',
            code: 'scene_error',
            severity: 'error',
            scene: 'Nova secret free text',
            phase: 'transition',
            recovery: 'reload_offered'
        });
        await transport.flush();

        const payload = JSON.parse(send.mock.calls[0][1].body);
        expect(payload.events[0].scene).toBe('unknown');
        expect(JSON.stringify(payload)).not.toContain('Nova secret free text');
    });

    test('discards contaminated durable entries instead of transmitting them', () => {
        localStorage.setItem(OBSERVABILITY_STORAGE_KEY, JSON.stringify([{
            schema_version: 1,
            event_id: '824363b2-d374-4b44-bf7f-1d7a177fa074',
            occurred_at: '2026-08-11T11:59:30.000Z',
            category: 'runtime',
            code: 'runtime_uncaught',
            severity: 'error',
            scene: 'GameScene',
            phase: 'runtime',
            recovery: 'none',
            connectivity: 'online',
            viewport_class: 'compact',
            user_visible: false,
            creatureName: 'Nova'
        }]));
        const send = jest.fn(okResponse);
        const transport = new PrivacyObservabilityTransport({
            storage: localStorage,
            fetch: send
        });

        transport.initialize();

        expect(transport.queue).toEqual([]);
        expect(localStorage.getItem(OBSERVABILITY_STORAGE_KEY)).toBeNull();
        expect(send).not.toHaveBeenCalled();
    });
});
