const GameStateManager = require('../systems/GameState.js');
const CreaturePortraitSpec = require('../systems/CreaturePortraitSpec.js');
const CloudSaveManager = require('../systems/CloudSaveManager.js');
const loadMediaService = require('./support/loadMediaService.cjs');

describe('portrait results owned by the current synthetic journey', () => {
    const assetRef = 'portrait-job-v1:00000000-0000-4000-8000-000000000077';
    const imageUrl = 'https://example.test/synthetic-held-portrait.png';
    const creature = { name: 'Fictional creature', stage: 'baby',
        genes: { id: 'synthetic-custody-creature', species: 'stellarWyrm', rarity: 'common' } };
    const spec = CreaturePortraitSpec.create(creature);
    const record = { identityKey: spec.identityKey, stage: 'baby', status: 'ready', assetRef,
        imageUrl, expiresAt: Date.now() + 60000 };
    const response = (status = 'succeeded') => ({ ok: true, status: 200, json: async () => ({
        ...record, success: true, status, jobId: '00000000-0000-4000-8000-000000000077',
        imageUrl: status === 'succeeded' ? imageUrl : null }) });
    const flush = async () => { for (let index = 0; index < 20; index++) await Promise.resolve(); };
    let state, services, cloud, authListeners;
    beforeEach(() => {
        jest.useFakeTimers(); localStorage.clear(); services = []; authListeners = new Set();
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        state = new GameStateManager(); window.GameState = state;
        state.set('creature.genes', creature.genes); state.set('creature.hatched', true);
        state.addCreatureToCollection(); expect(state.save()).toBe(true);
        window.CreaturePortraitSpec = CreaturePortraitSpec;
        window.CreatureMediaClient = { auth: { onAuthStateChange: listener => {
            authListeners.add(listener);
            return { data: { subscription: { unsubscribe: () => authListeners.delete(listener) } } };
        }, getSession: async () => ({
            data: { session: { access_token: 'synthetic-custody-token' } }, error: null }) } };
        cloud = window.CloudSave = new CloudSaveManager({ gameState: state, client: window.CreatureMediaClient, storage: localStorage });
        cloud.currentUser = { id: 'synthetic-custody-owner' };
        window.CompanionMediaService = { prepareGeneratedVideo: jest.fn(),
            captureCampaignGuard: () => () => true, canPublishMedia: () => true,
            getState: () => ({ appearances: {} }), getVideoRecord: () => null };
    });
    afterEach(() => {
        services.forEach(service => service.retireCampaignWork()); cloud.destroy(); state.stopAutoSave();
        jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); localStorage.clear();
        for (const name of ['GameState', 'CloudSave', 'CreatureMediaClient', 'CreaturePortraitSpec',
            'LivingPortraitService', 'CompanionMediaService']) delete window[name];
    });
    const serviceFor = fetch => {
        const { LivingPortraitService } = loadMediaService('LivingPortraitService', fetch, window);
        const service = new LivingPortraitService({ pollDelays: [1] }); services.push(service); return service;
    };
    const bytes = () => localStorage.getItem(state.saveKey);
    const assertNoAnnouncement = emit => {
        expect(emit).not.toHaveBeenCalledWith('creaturePortraitGenerationSucceeded', expect.anything());
        expect(emit).not.toHaveBeenCalledWith('creaturePortraitGenerationFailed', expect.anything());
        expect(window.CompanionMediaService.prepareGeneratedVideo).not.toHaveBeenCalled();
    };

    test('a held ready result retries locally with no second request, then publishes after release', async () => {
        let heldState, heldBytes;
        const fetch = jest.fn(async (url, options) => {
            if (options?.method === 'POST') return response('processing');
            state.holdSaveAdmission({ code: 'synthetic_portrait_hold' });
            heldState = JSON.stringify(state.state); heldBytes = bytes();
            return response();
        });
        const service = serviceFor(fetch), emit = jest.spyOn(state, 'emit');
        const pending = service.generate({ creatureData: creature });
        const rejected = expect(pending).rejects.toMatchObject({ code: 'portrait_save_deferred', retryable: true });
        await jest.advanceTimersByTimeAsync(1); await rejected;
        expect(service.getDiagnostics().status).toBe('deferred');
        expect(service.volatilePortraits.get(spec.identityKey).record.status).toBe('ready');
        expect(JSON.stringify(state.state)).toBe(heldState); expect(bytes()).toBe(heldBytes);
        assertNoAnnouncement(emit);
        await expect(service.generate({ creatureData: creature })).rejects.toMatchObject({ code: 'portrait_save_deferred' });
        expect(fetch).toHaveBeenCalledTimes(2);
        state.releaseSaveAdmission();
        await expect(service.generate({ creatureData: creature })).resolves.toMatchObject(record);
        await flush();
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(state.getCreaturePortrait()).toMatchObject(record);
        expect(state.get('creatures.0.portraits.byStage.baby').assetRef).toBe(assetRef);
        expect(bytes()).not.toContain(imageUrl); expect(service.volatilePortraits.size).toBe(0);
        expect(window.CompanionMediaService.prepareGeneratedVideo).toHaveBeenCalledTimes(1);
    });

    test('refused processing metadata is retained and resumes the same asset with GET, never another POST', async () => {
        let first = true;
        const fetch = jest.fn(async (url, options) => {
            if (first) { first = false; state.holdSaveAdmission({ code: 'synthetic_processing_hold' }); return response('processing'); }
            expect(options?.method).not.toBe('POST');
            expect(url).toBe('/.netlify/functions/generate-ai-art?assetRef=' + encodeURIComponent(assetRef));
            return response();
        });
        const service = serviceFor(fetch), before = JSON.stringify(state.state), durable = bytes();
        await expect(service.generate({ creatureData: creature })).rejects.toMatchObject({ code: 'portrait_save_deferred' });
        expect(JSON.stringify(state.state)).toBe(before); expect(bytes()).toBe(durable);
        expect(service.volatilePortraits.get(spec.identityKey).record.status).toBe('processing');
        state.releaseSaveAdmission();
        await expect(service.generate({ creatureData: creature })).resolves.toMatchObject(record);
        expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('a refused protected-resolution result is not claimed ready and is reusable without GET', async () => {
        const fetch = jest.fn(async () => { state.holdSaveAdmission({ code: 'synthetic_resolve_hold' }); return response(); });
        const service = serviceFor(fetch), before = JSON.stringify(state.state), durable = bytes();
        await expect(service.resolve({ ...record, imageUrl: null })).rejects.toMatchObject({ code: 'portrait_save_deferred' });
        expect(JSON.stringify(state.state)).toBe(before); expect(bytes()).toBe(durable);
        state.releaseSaveAdmission();
        await expect(service.generate({ creatureData: creature })).resolves.toMatchObject(record);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('blocked admission before generation performs no authentication or media request', async () => {
        const fetch = jest.fn(), auth = jest.spyOn(window.CreatureMediaClient.auth, 'getSession');
        const service = serviceFor(fetch); state.holdSaveAdmission({ code: 'synthetic_start_hold' });
        await expect(service.generate({ creatureData: creature })).rejects.toMatchObject({ code: 'portrait_save_deferred' });
        expect(fetch).not.toHaveBeenCalled(); expect(auth).not.toHaveBeenCalled();
    });

    test.each(['reset', 'restore', 'game_owner', 'cloud_owner', 'cloud_user', 'cloud_epoch'])(
        'a late response after %s cannot save, notify or enter the new journey cache', async mode => {
            let complete;
            const fetch = jest.fn(() => new Promise(resolve => { complete = resolve; }));
            const service = serviceFor(fetch), pending = service.generate({ creatureData: creature });
            const rejected = expect(pending).rejects.toMatchObject({ code: 'portrait_context_changed' });
            await flush(); expect(fetch).toHaveBeenCalledTimes(1);
            if (mode === 'reset') state.emit('reset');
            if (mode === 'restore') state.state = JSON.parse(JSON.stringify(state.state));
            if (mode === 'game_owner') window.GameState = Object.create(state);
            if (mode === 'cloud_owner') window.CloudSave = { ...window.CloudSave };
            if (mode === 'cloud_user') window.CloudSave.currentUser = { id: 'synthetic-next-owner' };
            if (mode === 'cloud_epoch') window.CloudSave.campaignEpoch += 1;
            const before = JSON.stringify(state.state), durable = bytes(), emit = jest.spyOn(state, 'emit');
            complete(response()); await rejected;
            expect(JSON.stringify(state.state)).toBe(before); expect(bytes()).toBe(durable);
            assertNoAnnouncement(emit);
            service.captureCampaignContext(); expect(service.volatilePortraits.size).toBe(0);
            expect(service.jobs.size).toBe(0); expect(service.assetResolutions.size).toBe(0);
        });

    test('an earlier job finaliser cannot remove a new job for the same identity after reset', async () => {
        const completions = [];
        const service = serviceFor(jest.fn(() => new Promise(resolve => completions.push(resolve))));
        const old = service.generate({ creatureData: creature });
        const oldRejected = expect(old).rejects.toMatchObject({ code: 'portrait_context_changed' });
        await flush(); state.emit('reset');
        const next = service.generate({ creatureData: creature }); await flush();
        const nextJob = service.getActiveJob();
        completions[0](response()); await oldRejected;
        expect(service.getActiveJob()).toBe(nextJob); expect(service.jobs.size).toBe(1);
        completions[1](response()); await expect(next).resolves.toMatchObject(record);
        expect(service.jobs.size).toBe(0);
    });

    test('an earlier resolution finaliser cannot remove a new resolution for the same asset after reset', async () => {
        const completions = [];
        const fetch = jest.fn(() => new Promise(resolve => completions.push(resolve)));
        const service = serviceFor(fetch);
        const old = service.resolve({ ...record, imageUrl: null });
        const oldRejected = expect(old).rejects.toMatchObject({ code: 'portrait_context_changed' });
        await flush(); state.emit('reset');
        const next = service.resolve({ ...record, imageUrl: null }); await flush();
        completions[0](response()); await oldRejected;
        expect(service.assetResolutions.size).toBe(1);
        expect(service.resolve({ ...record, imageUrl: null })).toBe(next);
        completions[1](response()); await expect(next).resolves.toMatchObject(record);
        expect(fetch).toHaveBeenCalledTimes(2); expect(service.assetResolutions.size).toBe(0);
    });

    test('a reset while authentication is pending prevents a later generation POST', async () => {
        let authenticate;
        window.CreatureMediaClient.auth.getSession = () => new Promise(resolve => { authenticate = resolve; });
        const fetch = jest.fn(), service = serviceFor(fetch);
        const pending = service.generate({ creatureData: creature });
        const rejected = expect(pending).rejects.toMatchObject({ code: 'portrait_context_changed' });
        state.emit('reset'); authenticate({ data: { session: { access_token: 'synthetic-retired-token' } }, error: null });
        await rejected; expect(fetch).not.toHaveBeenCalled();
    });

    test.each(['getSession', 'signInAnonymously'])('explicit sign-out retires pending initial %s without a POST or token', async method => {
        cloud.currentUser = null;
        let authenticate;
        if (method === 'signInAnonymously') window.CreatureMediaClient.auth.getSession = async () => ({ data: { session: null }, error: null });
        window.CreatureMediaClient.auth[method] = () => new Promise(resolve => { authenticate = resolve; });
        const fetch = jest.fn(), service = serviceFor(fetch), context = service.captureCampaignContext();
        const pending = service.getAccessToken(context);
        const rejected = expect(pending).rejects.toMatchObject({ code: 'portrait_context_changed' });
        await flush();
        for (const listener of [...authListeners]) listener('SIGNED_OUT', null);
        authenticate({ data: { session: { access_token: 'synthetic-retired-token',
            user: { id: 'synthetic-retired-session' } } }, error: null });
        await rejected; expect(fetch).not.toHaveBeenCalled(); expect(context.isCurrent()).toBe(false);
        expect(service.volatilePortraits.size).toBe(0); expect(authListeners.size).toBe(1);
    });

    test('the initial anonymous session may bind only the matching authenticated owner before its first POST', async () => {
        cloud.currentUser = null;
        window.CreatureMediaClient.auth.getSession = async () => {
            cloud.currentUser = { id: 'synthetic-initial-session' };
            return { data: { session: { access_token: 'synthetic-initial-token', user: cloud.currentUser } }, error: null };
        };
        const fetch = jest.fn(async () => response()), service = serviceFor(fetch);
        await expect(service.generate({ creatureData: creature })).resolves.toMatchObject(record);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test.each([false, true])('an initial session permits only its own delayed auth notification; mismatch=%s', async mismatch => {
        cloud.currentUser = null;
        const user = { id: 'synthetic-initial-session' };
        window.CreatureMediaClient.auth.getSession = async () => ({ data: {
            session: { access_token: 'synthetic-initial-token', user } }, error: null });
        const fetch = jest.fn(async () => {
            cloud.currentUser = mismatch ? { id: 'synthetic-unrelated-session' } : user;
            return response();
        });
        const service = serviceFor(fetch), pending = service.generate({ creatureData: creature });
        if (mismatch) {
            await expect(pending).rejects.toMatchObject({ code: 'portrait_context_changed' });
            expect(service.volatilePortraits.size).toBe(0);
            expect(state.getCreaturePortrait()).toBeNull();
        } else await expect(pending).resolves.toMatchObject(record);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('a token for another established owner cannot authorise a generation POST', async () => {
        window.CreatureMediaClient.auth.getSession = async () => ({ data: { session: {
            access_token: 'synthetic-mismatched-token', user: { id: 'synthetic-unrelated-session' } } }, error: null });
        const fetch = jest.fn(), service = serviceFor(fetch);
        await expect(service.generate({ creatureData: creature })).rejects.toMatchObject({ code: 'portrait_context_changed' });
        expect(fetch).not.toHaveBeenCalled();
    });

    test('only exact real-manager admission advances preserve custody, not an extra cloud campaign change', () => {
        const service = serviceFor(jest.fn()), context = service.captureCampaignContext();
        service.retainPortrait(record, context);
        state.holdSaveAdmission({ code: 'synthetic_hold' }); state.releaseSaveAdmission();
        expect(cloud.campaignEpoch).toBe(2); expect(context.isCurrent()).toBe(true);
        cloud.campaignEpoch += 1;
        expect(context.isCurrent()).toBe(false);
        service.captureCampaignContext(); expect(service.volatilePortraits.size).toBe(0);
    });

    test('an observed ownership rejection cannot become current again when fields are restored', () => {
        const service = serviceFor(jest.fn()), context = service.captureCampaignContext(), owner = cloud.currentUser;
        cloud.currentUser = { id: 'synthetic-intervening-owner' };
        expect(context.isCurrent()).toBe(false);
        cloud.currentUser = owner;
        expect(context.isCurrent()).toBe(false);
    });

    test('a matching initial auth notification preserves the pending original request', async () => {
        cloud.currentUser = null;
        let authenticate;
        window.CreatureMediaClient.auth.getSession = () => new Promise(resolve => { authenticate = resolve; });
        const fetch = jest.fn(async () => response()), service = serviceFor(fetch);
        const pending = service.generate({ creatureData: creature });
        const session = { access_token: 'synthetic-initial-token', user: { id: 'synthetic-initial-session' } };
        for (const listener of [...authListeners]) listener('SIGNED_IN', session);
        expect(service.getActiveJob()).not.toBeNull();
        authenticate({ data: { session }, error: null });
        await expect(pending).resolves.toMatchObject(record); expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('an explicitly failed retained job can be retried, but not while saving is held', async () => {
        let failed = true;
        const fetch = jest.fn(async (url, options) => {
            if (options?.method === 'POST') return response();
            if (failed) { failed = false; return { ok: false, status: 502, json: async () => ({ code: 'generation_failed' }) }; }
            throw Error('SYNTHETIC_UNEXPECTED_EXTRA_STATUS_REQUEST');
        });
        const service = serviceFor(fetch), context = service.captureCampaignContext();
        service.retainPortrait({ ...record, imageUrl: null, status: 'processing' }, context);
        state.holdSaveAdmission({ code: 'synthetic_retry_hold' });
        await expect(service.generate({ creatureData: creature })).rejects.toMatchObject({ code: 'portrait_save_deferred' });
        expect(fetch).not.toHaveBeenCalled();
        state.releaseSaveAdmission();
        await expect(service.generate({ creatureData: creature })).resolves.toMatchObject(record);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    });

    test('retained references are bounded and cleared on a campaign reset', () => {
        const service = serviceFor(jest.fn()), context = service.captureCampaignContext();
        for (let index = 0; index < 33; index++) service.retainPortrait({ ...record, identityKey: `synthetic-${index}` }, context);
        expect(service.volatilePortraits.size).toBe(32); expect(service.volatilePortraits.has('synthetic-0')).toBe(false);
        state.emit('reset'); expect(service.volatilePortraits.size).toBe(0);
    });
});
