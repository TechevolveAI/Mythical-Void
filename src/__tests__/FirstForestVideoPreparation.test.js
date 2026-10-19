const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const GameStateManager = require('../systems/GameState.js');
const CreaturePortraitSpec = require('../systems/CreaturePortraitSpec.js');

function loadService(name, fetch) {
    const file = path.join(__dirname, '../systems', name + '.js');
    const root = path.resolve(__dirname, '../..');
    const code = execFileSync(process.execPath, ['--require', './scripts/review/deny-baseline-network.cjs',
        '-e', 'process.stdout.write(require(process.argv[1]).transformSync(require("node:fs").readFileSync(0,"utf8"),{format:"cjs",target:"es2022",loader:"js"}).code)',
        require.resolve('esbuild')], { cwd: root, input: fs.readFileSync(file, 'utf8'), encoding: 'utf8',
        env: { PATH: '/usr/bin:/bin:/usr/local/bin', TMPDIR: '/private/tmp', LANG: 'C', NODE_ENV: 'test', CI: '1' },
        timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
    const context = { module: { exports: {} }, window, fetch, console, Image: class {},
        Date, Math, Map, Set, Promise, Object, Array, Number, String, Boolean, Error,
        AbortController, setTimeout, clearTimeout,
        require: name => {
            if (name === './CreatureMediaPrivacy.js') return { getCreatureMediaEligibility: () => ({ eligible: true }) };
            if (name === '../config/companion-video-moments.json') return require('../config/companion-video-moments.json');
            throw Error('SYNTHETIC_MEDIA_IMPORT_DENIED');
        } };
    context.exports = context.module.exports;
    vm.runInNewContext(code, context, { filename: file, timeout: 1000 });
    return context.module.exports;
}

describe('late first-Forest portrait to generated-film preparation', () => {
    const portraitRef = 'portrait-job-v1:00000000-0000-4000-8000-000000000077';
    const videoRef = 'video-job-v1:00000000-0000-4000-8000-000000000088';
    const creature = {
        name: 'Fictional creature', stage: 'baby',
        genes: { id: 'synthetic-first-forest-creature', species: 'stellarWyrm', rarity: 'common',
            traits: { bodyShape: { type: 'balanced' }, features: {} },
            personality: { core: 'curious' }, cosmicAffinity: { element: 'star' } },
        dna: { id: 'synthetic-first-forest-dna', bodyArchetype: 'blob', headArchetype: 'feline',
            hybridTag: 'single-species', elementalAura: 'cosmic' }
    };
    const flush = async () => { for (let index = 0; index < 20; index++) await Promise.resolve(); };
    let state;
    beforeEach(() => {
        jest.useFakeTimers(); localStorage.clear();
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        state = new GameStateManager(); window.GameState = state;
        state.set('creature.genes', creature.genes); state.set('creature.dna', creature.dna);
        state.set('creature.name', creature.name); state.set('creature.lifecycle.stage', 'baby');
        state.set('story.projectBeacon.firstForestCinematicSeen', true);
        state.set('levels.mythicalForest.completed', false);
        expect(state.save()).toBe(true);
        window.CreaturePortraitSpec = CreaturePortraitSpec;
        window.APIConfig = { isEnabled: () => true, isVideoEnabled: () => true };
        window.CloudSave = { currentUser: { id: 'synthetic-media-owner' } };
        window.CreatureMediaClient = { auth: { getSession: async () => ({
            data: { session: { access_token: 'synthetic-media-token' } }, error: null
        }) } };
    });
    afterEach(() => {
        state.stopAutoSave(); jest.clearAllTimers(); jest.useRealTimers();
        for (const name of ['GameState', 'APIConfig', 'CloudSave', 'CreatureMediaClient',
            'CreaturePortraitSpec', 'LivingPortraitService', 'CompanionMediaService']) delete window[name];
        jest.restoreAllMocks(); localStorage.clear();
    });

    test('late portrait queues one existing-contract video job, follows it and exposes the unseen film without a reveal UI', async () => {
        const requests = [];
        const fetch = jest.fn(async (url, options) => {
            requests.push({ url, method: options?.method || 'GET', body: options?.body });
            let result;
            if (url === '/.netlify/functions/generate-ai-art') result = {
                success: true, status: 'succeeded', assetRef: portraitRef,
                imageUrl: 'https://example.test/synthetic-portrait.png', storage: 'supabase-private'
            };
            else if (url === '/.netlify/functions/generate-companion-video') result = {
                status: 'processing', assetRef: videoRef
            };
            else if (url === '/.netlify/functions/generate-companion-video?assetRef=' + encodeURIComponent(videoRef)) result = {
                status: 'succeeded', assetRef: videoRef, videoUrl: 'https://example.test/synthetic-film.mp4'
            };
            else throw Error('SYNTHETIC_MEDIA_REQUEST_DENIED');
            return { ok: true, status: result.status === 'succeeded' ? 200 : 202, json: async () => result };
        });
        const { CompanionMediaService } = loadService('CompanionMediaService', fetch);
        const { LivingPortraitService } = loadService('LivingPortraitService', fetch);
        const media = window.CompanionMediaService = new CompanionMediaService();
        const portraits = window.LivingPortraitService = new LivingPortraitService();
        const record = await portraits.prewarm({ creatureData: creature, referenceImage: 'data:image/png;base64,iVBORw0KGgo=' });
        await flush();
        expect(media.videoJobs.size).toBe(1);
        const repeatedReveal = portraits.prepareFirstForestVideo(record);
        await flush();
        expect(requests.filter(request => request.url === '/.netlify/functions/generate-companion-video')).toHaveLength(1);
        await jest.advanceTimersByTimeAsync(2500);
        await repeatedReveal;
        const ready = media.getUnviewedGeneratedVideos();
        expect(ready).toHaveLength(1);
        expect(ready[0]).toMatchObject({ momentId: 'first_forest_arrival', status: 'succeeded',
            identityKey: record.identityKey, portraitAssetRef: portraitRef, assetRef: videoRef });
        const creation = requests.find(request => request.url === '/.netlify/functions/generate-companion-video');
        expect(JSON.parse(creation.body)).toEqual({ momentId: 'first_forest_arrival', portraitAssetRef: portraitRef });
        expect(requests).toHaveLength(3);
        expect(media.videoJobs.size).toBe(0); expect(media.videoResolutions.size).toBe(0);
        expect(document.querySelector('video')).toBeNull();
        expect(media.recordAppearance('first_forest_arrival', record, 'generated_video')).toBeTruthy();
        await portraits.prepareFirstForestVideo(record);
        expect(media.getUnviewedGeneratedVideos()).toHaveLength(0);
        expect(requests).toHaveLength(3);
    });

    test('a protected save leaves an already-generated portrait from starting optional paid work', async () => {
        const fetch = jest.fn(() => { throw Error('SYNTHETIC_NETWORK_NOT_EXPECTED'); });
        const { CompanionMediaService } = loadService('CompanionMediaService', fetch);
        const { LivingPortraitService } = loadService('LivingPortraitService', fetch);
        window.CompanionMediaService = new CompanionMediaService();
        const portraits = window.LivingPortraitService = new LivingPortraitService();
        const spec = CreaturePortraitSpec.create(creature);
        expect(state.saveCreaturePortrait({ identityKey: spec.identityKey, assetRef: portraitRef, stage: 'baby', status: 'ready' })).toBe(true);
        const record = state.getCreaturePortrait();
        state.holdSaveAdmission({ code: 'synthetic_media_hold' });
        const before = JSON.stringify(state.state), durable = localStorage.getItem(state.saveKey);
        await expect(portraits.prepareFirstForestVideo(record)).resolves.toBeNull();
        expect(fetch).not.toHaveBeenCalled();
        expect(JSON.stringify(state.state)).toBe(before);
        expect(localStorage.getItem(state.saveKey)).toBe(durable);
    });
});
