const GameStateManager = require('../systems/GameState.js');
const loadMediaService = require('./support/loadMediaService.cjs');

describe('verified story-media publication', () => {
    const portrait = { identityKey: 'synthetic-media-creature:baby', stage: 'baby',
        assetRef: 'portrait-job-v1:00000000-0000-4000-8000-000000000077' };
    const film = { assetRef: 'video-job-v1:00000000-0000-4000-8000-000000000088',
        status: 'succeeded', videoUrl: 'https://example.test/synthetic-private-film.mp4' };
    let state, service;
    beforeEach(() => {
        localStorage.clear(); delete window.CloudSave;
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        state = new GameStateManager(); window.GameState = state;
        expect(state.save()).toBe(true);
        const { CompanionMediaService } = loadMediaService('CompanionMediaService', () => {
            throw Error('SYNTHETIC_MEDIA_REQUEST_DENIED');
        }, window);
        service = new CompanionMediaService();
    });
    afterEach(() => {
        state.stopAutoSave(); service.unsubscribeCampaignReset?.(); jest.restoreAllMocks(); localStorage.clear();
        for (const key of ['GameState', 'CloudSave', 'CompanionMediaService', 'APIConfig', 'LivingPortraitService']) delete window[key];
    });
    const bytes = () => localStorage.getItem(state.saveKey);
    const durableMedia = () => JSON.parse(bytes()).story.companionMedia;

    test('normal receipt notifications see the same already-verified memory and disk metadata', () => {
        const story = state.get('story'), session = service.getMediaSession(), observations = [];
        const beacon = story.projectBeacon, creature = state.get('creature');
        state.on('changed:story.companionMedia', () => {
            observations.push({ live: JSON.stringify(state.get('story.companionMedia')),
                durable: JSON.stringify(durableMedia()) });
        });
        expect(service.recordAppearance('first_forest_arrival', portrait, 'generated_video')).toBeTruthy();
        expect(observations).toHaveLength(1);
        expect(observations[0].live).toBe(observations[0].durable);
        expect(state.get('story')).toBe(story); expect(session.isCurrent()).toBe(true);
        expect(story.projectBeacon).toBe(beacon); expect(state.get('creature')).toBe(creature);
    });

    test.each(['throw', 'ignore'])('a storage %s does not expose or adopt uncommitted ready-video metadata', mode => {
        const before = JSON.stringify(state.state), raw = bytes(), emit = jest.spyOn(state, 'emit');
        const write = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === state.saveKey) {
                if (mode === 'throw') throw Error('synthetic media storage refusal');
                return;
            }
            return write.call(this, key, value);
        });
        expect(service.saveVideoRecord('first_forest_arrival', portrait, film)).toBeNull();
        expect(JSON.stringify(state.state)).toBe(before); expect(bytes()).toBe(raw);
        expect(emit).not.toHaveBeenCalledWith('changed:story.companionMedia', expect.anything(), expect.anything());
        expect(emit).not.toHaveBeenCalledWith('companionVideoStatus', expect.anything());
    });

    test('a re-entrant save followed by a hold cannot split a verified viewing receipt between memory and disk', () => {
        state.on('changed:story.companionMedia', () => {
            state.save(); state.holdSaveAdmission({ code: 'synthetic_observer_hold' });
        });
        const emit = jest.spyOn(state, 'emit');
        expect(service.recordAppearance('first_forest_arrival', portrait, 'generated_video')).toBe(false);
        expect(JSON.stringify(state.get('story.companionMedia'))).toBe(JSON.stringify(durableMedia()));
        expect(Object.values(durableMedia().appearances)[0].renderMode).toBe('generated_video');
        expect(emit).not.toHaveBeenCalledWith('companionMediaAppearance', expect.anything());
    });

    test('held optional media cannot alter either progress copy or dispatch a change notification', () => {
        state.holdSaveAdmission({ code: 'synthetic_preexisting_hold' });
        const before = JSON.stringify(state.state), raw = bytes(), emit = jest.spyOn(state, 'emit');
        expect(service.recordAppearance('first_forest_arrival', portrait, 'generated_video')).toBe(false);
        expect(JSON.stringify(state.state)).toBe(before); expect(bytes()).toBe(raw);
        expect(emit).not.toHaveBeenCalled();
    });

    test('failed recovery-copy creation leaves the complete canonical source untouched', () => {
        const before = JSON.stringify(state.state), raw = bytes(), story = state.get('story'), emit = jest.spyOn(state, 'emit');
        jest.spyOn(state, 'createLocalSaveBackup').mockReturnValue(false);
        expect(service.saveVideoRecord('first_forest_arrival', portrait, film)).toBeNull();
        expect(state.get('story')).toBe(story); expect(JSON.stringify(state.state)).toBe(before); expect(bytes()).toBe(raw);
        expect(emit).not.toHaveBeenCalledWith('changed:story.companionMedia', expect.anything(), expect.anything());
    });

    test('a backup callback may save newer progress without an old media publication replacing it', () => {
        const backup = state.createLocalSaveBackup.bind(state);
        let successor, durable;
        jest.spyOn(state, 'createLocalSaveBackup').mockImplementationOnce((...args) => {
            const copied = backup(...args);
            state.set('creature.experience', 123); expect(state.save()).toBe(true);
            successor = JSON.stringify(state.state); durable = bytes(); return copied;
        });
        const emit = jest.spyOn(state, 'emit');
        expect(service.saveVideoRecord('first_forest_arrival', portrait, film)).toBeNull();
        expect(JSON.stringify(state.state)).toBe(successor); expect(bytes()).toBe(durable);
        expect(state.getSaveAdmission().status).toBe('ready');
        expect(emit).not.toHaveBeenCalledWith('companionVideoStatus', expect.anything());
    });

    test('corrupt read-back cannot adopt or notify an optional media receipt', () => {
        const before = JSON.stringify(state.state), write = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            return write.call(this, key, key === state.saveKey ? 'synthetic corrupted media write' : value);
        });
        const emit = jest.spyOn(state, 'emit');
        expect(service.recordAppearance('first_forest_arrival', portrait, 'generated_video')).toBe(false);
        expect(JSON.stringify(state.state)).toBe(before); expect(state.getSaveAdmission().status).toBe('held');
        expect(emit).not.toHaveBeenCalledWith('changed:story.companionMedia', expect.anything(), expect.anything());
        expect(emit).not.toHaveBeenCalledWith('companionMediaAppearance', expect.anything());
    });

    test('the verified publisher owns its detached metadata, not a mutable caller object', () => {
        const next = service.createEmptyState();
        expect(state.saveCompanionMedia(next)).toBe(true);
        const before = JSON.stringify(state.state), raw = bytes();
        next.activeIdentityKey = 'synthetic-later-input';
        expect(JSON.stringify(state.state)).toBe(before); expect(bytes()).toBe(raw);
    });

    test('restoring a save retires the previous story tree\'s unpublished result', () => {
        state.holdSaveAdmission({ code: 'synthetic_old_story_hold' });
        service.saveVideoRecord('first_forest_arrival', portrait, film);
        state.releaseSaveAdmission();
        const snapshot = state.createSaveSnapshot();
        expect(state.applyExternalSave(snapshot, { persist: false })).toBe(true);
        expect(service.getVideoRecord('first_forest_arrival', portrait.identityKey)).toBeNull();
        service.captureCampaignGuard(); expect(service.volatileVideos.size).toBe(0);
    });

    test.each(['full guard', 'borrowed writer check'])('a %s from a replaced story cannot publish through the writer directly', kind => {
        const guard = service.captureCampaignGuard(), next = service.createEmptyState();
        next.activeIdentityKey = 'synthetic-retired-story';
        const replacement = { ...state.state, story: { ...state.get('story') } };
        state.state = replacement;
        const before = JSON.stringify(replacement), raw = bytes();
        const isCurrentCampaign = kind === 'full guard' ? guard : guard.forVerifiedStoryWrite;
        expect(state.saveCompanionMedia(next, { isCurrentCampaign })).toBe(false);
        expect(state.state).toBe(replacement); expect(JSON.stringify(state.state)).toBe(before); expect(bytes()).toBe(raw);
    });

    test.each(['held', 'memory', 'cloud write'])('%s generation performs neither authentication nor a video request', async mode => {
        window.LivingPortraitService = { getAccessToken: jest.fn(async () => 'synthetic-media-token') };
        service.requestVideoJson = jest.fn();
        if (mode === 'held') state.holdSaveAdmission({ code: 'synthetic_request_hold' });
        else if (mode === 'memory') state.storageMode = 'memory';
        else state.beginCloudWrite('mutation', state.createSaveSnapshot());
        await expect(service.startGeneratedVideo({ momentId: 'first_forest_arrival', portraitRecord: portrait })).resolves.toBeNull();
        expect(window.LivingPortraitService.getAccessToken).not.toHaveBeenCalled();
        expect(service.requestVideoJson).not.toHaveBeenCalled();
    });

    test('a refused ready result stays out of Watch notices and resumes its existing asset without another POST', async () => {
        window.APIConfig = { isVideoEnabled: () => true };
        window.LivingPortraitService = { getAccessToken: async () => 'synthetic-media-token' };
        service.requestVideoJson = jest.fn(async () => ({ response: { ok: true }, result: film }));
        const refuse = jest.spyOn(state, 'createLocalSaveBackup').mockReturnValue(false);
        await expect(service.prepareGeneratedVideo({ momentId: 'first_forest_arrival', record: portrait })).resolves.toBeNull();
        expect(service.getVideoRecord('first_forest_arrival', portrait.identityKey)?.assetRef).toBe(film.assetRef);
        expect(service.hasUnviewedGeneratedVideo('first_forest_arrival', portrait)).toBe(false);
        expect(service.getUnviewedGeneratedVideos(portrait)).toHaveLength(0);
        refuse.mockRestore();
        await expect(service.prepareGeneratedVideo({ momentId: 'first_forest_arrival', record: portrait })).resolves.toMatchObject(film);
        expect(service.requestVideoJson).toHaveBeenCalledTimes(2);
        expect(service.requestVideoJson.mock.calls[0][1].method).toBe('POST');
        expect(service.requestVideoJson.mock.calls[1][0]).toContain('?assetRef=');
        expect(service.requestVideoJson.mock.calls[1][1].method).toBeUndefined();
        expect(service.getUnviewedGeneratedVideos(portrait)).toHaveLength(1);
        expect(bytes()).not.toContain(film.videoUrl);
    });
});
