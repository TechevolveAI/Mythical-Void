const { fixture } = require('./support/soulNamingFixture.cjs');
const { loadAchievementSystem } = require('./support/achievementDraftFixture.cjs');

describe('initial naming uses achievements from the admitted save, not a previous campaign', () => {
    let f;
    const claim = marker => ({ progress: { BRONZE: { unlocked: true, unlockedAt: 1700000000000, value: 1 } },
        claimed: { BRONZE: { claimedAt: marker, rewards: { coins: 25 } } } });
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(1700000000777);
        localStorage.clear(); document.body.replaceChildren();
        for (const key of ['CloudSave', 'AchievementSystem', 'QuestManager', 'AudioManager', 'BirthEventSystem']) delete window[key];
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        f = fixture();
    });
    afterEach(() => {
        f.close(); jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers();
        for (const key of ['GameState', 'CloudSave', 'AchievementSystem', 'QuestManager', 'AudioManager', 'BirthEventSystem']) delete window[key];
        document.body.replaceChildren();
    });
    const load = (initialize = true) => {
        const { system } = loadAchievementSystem(f.state, { initialize, sceneWindow: window });
        window.AchievementSystem = system; return system;
    };
    const admit = (achievements, method = 'apply') => {
        const snapshot = JSON.parse(JSON.stringify(f.state.createSaveSnapshot())); snapshot.achievements = achievements;
        if (method === 'load') { localStorage.setItem(f.state.saveKey, JSON.stringify(snapshot)); expect(f.state.load()).toBe(true); }
        else expect(f.state.applyExternalSave(snapshot, { source: 'synthetic-cloud', persist: true })).toBe(true);
    };

    test.each([false, true])('control: coherent source, initially warm=%s, preserves current claimed progress', warm => {
        f.state.set('achievements', { caring_owner: claim(77) }); expect(f.state.save()).toBe(true);
        const system = load(warm), emitter = system.events;
        f.scene.finalizeName();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        expect(JSON.parse(f.raw()).achievements.caring_owner.claimed).toEqual(claim(77).claimed);
        expect(system.definitions.caring_owner.claimed).toEqual(claim(77).claimed);
        if (warm) expect(system.events).toBe(emitter);
    });

    test.each(['apply', 'load'])('warm empty source cannot overwrite newly admitted claims through %s', method => {
        const system = load(), emitter = system.events;
        admit({ caring_owner: claim(88) }, method);
        f.scene.finalizeName();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        expect(JSON.parse(f.raw()).achievements.caring_owner.claimed).toEqual(claim(88).claimed);
        expect(system.definitions.caring_owner.claimed).toEqual(claim(88).claimed);
        expect(system.events).toBe(emitter);
    });

    test('old claimed progress cannot be imported into a newly admitted empty source', () => {
        f.state.set('achievements', { caring_owner: claim(77) }); expect(f.state.save()).toBe(true);
        const system = load(); admit({});
        f.scene.finalizeName();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        expect(JSON.parse(f.raw()).achievements.caring_owner.claimed).toEqual({});
        expect(system.definitions.caring_owner.claimed).toEqual({});
    });

    test('pending claims from the old source cannot remain when the newly admitted save already claimed them', () => {
        const system = load();
        system.recordEvent('creature_hatched', { hatchId: 'fictional-old-hatch', rarity: 'rare', species: 'nebulaSprite' });
        expect(system.pendingClaims.length).toBeGreaterThan(0);
        const incoming = JSON.parse(JSON.stringify(f.state.get('achievements')));
        const old = system.pendingClaims.map(item => ({ id: item.id, tier: item.tier }));
        for (const item of old) incoming[item.id].claimed[item.tier] = { claimedAt: 88, rewards: {} };
        admit(incoming); f.scene.finalizeName();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        for (const item of old) {
            expect(JSON.parse(f.raw()).achievements[item.id].claimed[item.tier]).toEqual({ claimedAt: 88, rewards: {} });
            expect(system.pendingClaims.some(pending => pending.id === item.id && pending.tier === item.tier)).toBe(false);
        }
    });

    test('coherent same-source warm pending claims stay with their source without reloading or re-awarding', () => {
        const system = load();
        system.recordEvent('creature_hatched', { hatchId: 'fictional-prior-hatch', rarity: 'rare', species: 'nebulaSprite' });
        const pending = JSON.parse(JSON.stringify(system.pendingClaims)), read = jest.spyOn(system, 'loadProgress');
        expect(pending.length).toBeGreaterThan(0); f.scene.finalizeName();
        expect(read).not.toHaveBeenCalled(); expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        for (const item of pending) expect(system.pendingClaims).toContainEqual(item);
        expect(system.hasHatchProgressSource(f.state)).toBe(true);
    });

    test('a source-unknown already-warm replacement is refused rather than treated as an empty loaded service', () => {
        const system = load(); system.loadedGameState = null;
        const raw = f.raw(), memory = JSON.stringify(f.state.state), read = jest.spyOn(system, 'loadProgress');
        f.scene.finalizeName();
        expect(read).not.toHaveBeenCalled(); expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
        expect(f.raw()).toBe(raw); expect(JSON.stringify(f.state.state)).toBe(memory);
    });

    test.each(['canonical', 'cache', 'unknown-key'])('ambiguous same-epoch %s discrepancy stays untouched', kind => {
        const system = load();
        if (kind === 'canonical') f.state.set('achievements', { caring_owner: claim(88) });
        if (kind === 'cache') system.definitions.caring_owner.claimed = claim(77).claimed;
        if (kind === 'unknown-key') f.state.set('achievements', { fictional_future_achievement: claim(88) });
        expect(f.state.save()).toBe(true);
        const raw = f.raw(), memory = JSON.stringify(f.state.state), pending = JSON.stringify(system.pendingClaims);
        const read = jest.spyOn(system, 'loadProgress'), random = jest.spyOn(Math, 'random');
        f.scene.finalizeName();
        expect(read).not.toHaveBeenCalled(); expect(random).not.toHaveBeenCalled();
        expect(f.raw()).toBe(raw); expect(JSON.stringify(f.state.state)).toBe(memory);
        expect(JSON.stringify(system.pendingClaims)).toBe(pending);
        expect(f.scene.canProceed).toBe(true); expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
    });

    test('an already-prepared refusal cannot reload to a newly admitted source', () => {
        const system = load(), set = Storage.prototype.setItem; let refuse = true;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (refuse && key === f.state.saveKey) throw Error('fictional primary refusal');
            return set.call(this, key, value);
        });
        f.scene.finalizeName(); const attempt = f.scene.namingAttempt; expect(attempt.phase).toBe('prepared');
        refuse = false; admit({ caring_owner: claim(88) });
        const raw = f.raw(), memory = JSON.stringify(f.state.state), read = jest.spyOn(system, 'loadProgress');
        f.scene.retryNamingSave();
        expect(read).not.toHaveBeenCalled(); expect(f.scene.namingAttempt).toBe(attempt);
        expect(f.raw()).toBe(raw); expect(JSON.stringify(f.state.state)).toBe(memory);
    });

    test.each(['manager', 'game-state'])('a %s replacement during canonical loading cannot publish old work', kind => {
        const system = load(); admit({ caring_owner: claim(88) });
        const get = f.state.get.bind(f.state); let fired = false, next;
        jest.spyOn(f.state, 'get').mockImplementation(key => {
            const value = get(key);
            if (key === 'achievements' && !fired) {
                fired = true;
                if (kind === 'manager') { window.AchievementSystem = { initialized: true }; next = f.state; }
                else next = f.replaceManager();
            }
            return value;
        });
        const raw = f.raw(); f.scene.finalizeName();
        expect(fired).toBe(true); expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
        expect(f.raw()).toBe(raw); expect(next.get('creature.named')).not.toBe(true);
    });

    test('the original warm service can explicitly load a newly admitted GameState instance without replacing its emitter', () => {
        const system = load(), emitter = system.events;
        const snapshot = JSON.parse(JSON.stringify(f.state.createSaveSnapshot())); snapshot.achievements = { caring_owner: claim(88) };
        const next = f.replaceManager(); expect(next.applyExternalSave(snapshot, { source: 'synthetic-cloud', persist: true })).toBe(true);
        f.scene.finalizeName();
        expect(f.scene.showLivingPortraitHandoff).toHaveBeenCalledTimes(1);
        expect(system.loadedGameState).toBe(next); expect(system.events).toBe(emitter);
        expect(JSON.parse(f.raw()).achievements.caring_owner.claimed).toEqual(claim(88).claimed);
    });

    test('failure in the new volatile fingerprint publication protects an adopted result without replay', () => {
        const system = load();
        const off = f.state.on('saveBackupCreated', () => {
            off(); Object.defineProperty(system, 'loadedAchievementsBytes', { writable: false });
        });
        f.scene.finalizeName();
        expect(f.state.getSaveAdmission().status).toBe('held');
        expect(JSON.parse(f.raw()).creature.named).toBe(true);
        const raw = f.raw(), read = jest.spyOn(system, 'loadProgress');
        f.scene.retryNamingSave(); expect(read).not.toHaveBeenCalled(); expect(f.raw()).toBe(raw);
        expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
    });
});
