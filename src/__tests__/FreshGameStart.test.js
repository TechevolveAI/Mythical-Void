const GameStateManager = require('../systems/GameState.js');
const CloudSaveManager = require('../systems/CloudSaveManager.js');
const fs = require('node:fs');
const path = require('node:path');
function skillsFor(state) {
    const source = fs.readFileSync(path.join(__dirname,'../systems/CreatureSkills.js'),'utf8')
        .replace('export default creatureSkills;', '');
    return new Function('window','localStorage',`${source}\nreturn new CreatureSkills();`)({GameState:state},localStorage);
}

describe('confirmed fresh game', () => {
    let state;
    beforeEach(() => {
        localStorage.clear();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        state = new GameStateManager();
        state.set('creature.hatched', true);
        state.set('creature.name', 'Previous creature');
        state.set('creature.genes', {id:'previous'});
        state.set('creatures', [{id:'previous',hatched:true}]);
        state.set('levels.finalVoid.completed', true);
        state.set('story.projectBeacon.trumptopus', {status:'won'});
        state.set('world.antagonistOutcomes.trumptopus', {outcome:'banished'});
        state.set('hubWorld.shipParts.collected', ['command_module']);
        state.set('hubWorld.mapsOwned', ['void_peaks']);
        state.set('player.cosmicCoins', 5000);
        state.set('inventory.items', [{id:'super_blast'}]);
        state.set('session.gameStarted', true);
        state.set('settings.audioMuted', true);
        state.set('safety.parentalControls.enabled', true);
        state.set('safety.guardian.pinHash', 'existing-safety-setting');
        state.save();
    });
    afterEach(() => { state.stopAutoSave(); jest.restoreAllMocks(); });

    test('replaces all gameplay progress and survives a normal reload with safeguards intact', () => {
        expect(state.startFreshGame()).toBe(true);
        expect(state.get('session.gameStarted')).toBe(false);
        const restored = new GameStateManager();
        expect(restored.load()).toBe(true);
        const defaults = restored.prepareSaveCandidate(restored.createSaveSnapshot({state:restored.createInitialState()})).state;
        for (const key of ['creature','creatures','levels','world','hubWorld','inventory','story','unlocks','breedingShrine','stats','combat','tutorial']) {
            // Initial creature time fields are created once, not inherited from the old game.
            if (key === 'creature') continue;
            expect(restored.get(key)).toEqual(defaults[key]);
        }
        expect(restored.get('creature.hatched')).toBe(false);
        expect(restored.get('creature.name')).not.toBe('Previous creature');
        expect(restored.get('creature.genes')).toBeNull();
        expect(restored.get('session.gameStarted')).toBe(false);
        expect(restored.get('settings.audioMuted')).toBe(true);
        expect(restored.get('safety.parentalControls.enabled')).toBe(true);
        expect(restored.get('safety.guardian.pinHash')).toBe('existing-safety-setting');
        expect(restored.get('game.cloudSavePausedForNewGame')).toBe(true);
        expect(restored.getLocalSaveBackups()).toEqual(expect.arrayContaining([expect.objectContaining({reason:'before_new_game'})]));
        restored.stopAutoSave();
    });

    test('failed durable replacement leaves the current game and primary save untouched', () => {
        const before = JSON.stringify(state.state);
        const saved = localStorage.getItem(state.saveKey);
        const write = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype,'setItem').mockImplementation(function(key,value) {
            if (key === state.saveKey) throw new Error('storage unavailable');
            return write.call(this,key,value);
        });
        expect(() => state.startFreshGame()).toThrow();
        expect(JSON.stringify(state.state)).toBe(before);
        expect(localStorage.getItem(state.saveKey)).toBe(saved);
    });

    test('temporary-only play does not pretend a fresh save survived a reload', () => {
        state.storageMode = 'memory';
        expect(() => state.startFreshGame()).toThrow('could not be saved');
        expect(state.get('creature.name')).toBe('Previous creature');
    });

    test('new skill progress cannot inherit the separate legacy cache while existing games retain it', () => {
        localStorage.setItem('creatureSkills',JSON.stringify({skillLevels:{radiant_pulse:9},skillXP:{radiant_pulse:999}}));
        const existing = skillsFor(state);existing.init();
        expect(existing.skillLevels.radiant_pulse).toBe(9);
        state.startFreshGame();
        const fresh = skillsFor(state);fresh.init();
        expect(fresh.skillLevels).toEqual({});expect(fresh.skillXP).toEqual({});
        fresh.skillLevels.radiant_pulse=2;fresh.saveSkillProgress();
        const restored = new GameStateManager();expect(restored.load()).toBe(true);
        const next = skillsFor(restored);next.init();
        expect(next.skillLevels).toEqual({radiant_pulse:2});
        expect(next.skillXP).toEqual({});
    });

    test('an old fetch stays invalid after the new-game pause is cleared', async () => {
        const cloud = new CloudSaveManager({ gameState: state, client: {}, storage: localStorage });
        cloud.ensureSession = jest.fn(async () => ({ id: 'synthetic-owner' }));
        let reply;
        cloud.fetchRemoteSave = jest.fn(() => new Promise(resolve => { reply = resolve; }));
        const restore = jest.spyOn(cloud, 'restoreRemoteSave');
        const pending = cloud.synchronizeSnapshot(state.createSaveSnapshot());
        await Promise.resolve();
        state.startFreshGame();
        state.set('game.cloudSavePausedForNewGame', false);
        reply({ revision: 99, game_state: { savedAt: Date.now() + 10000 } });
        await pending;
        expect(restore).not.toHaveBeenCalled();
        expect(cloud.remoteRevision).toBe(0);
        expect(state.get('creature.hatched')).toBe(false);
        cloud.destroy();
    });

    test('an old upload waiting for authentication cannot send after restart and re-enable', async () => {
        const rpc = jest.fn();
        const cloud = new CloudSaveManager({ gameState: state, client: { rpc }, storage: localStorage });
        let authenticate;
        cloud.ensureSession = jest.fn(() => new Promise(resolve => { authenticate = resolve; }));
        const pending = cloud.upload(state.createSaveSnapshot());
        state.startFreshGame();
        state.set('game.cloudSavePausedForNewGame', false);
        authenticate({ id: 'synthetic-owner' });
        await pending;
        expect(rpc).not.toHaveBeenCalled();
        cloud.destroy();
    });

    test('an already-sent upload blocks New Game and cannot acknowledge a retired client', async () => {
        let reply;
        const rpc = jest.fn(() => new Promise(resolve => { reply = resolve; }));
        const cloud = new CloudSaveManager({ gameState: state, client: { rpc }, storage: localStorage });
        cloud.ensureSession = jest.fn(async () => ({ id: 'synthetic-owner' }));
        const pending = cloud.upload(state.createSaveSnapshot());
        await Promise.resolve();
        expect(rpc).toHaveBeenCalledTimes(1);
        expect(() => state.startFreshGame()).toThrow();
        const raw = localStorage.getItem(state.saveKey);
        cloud.destroy();
        reply({ data: { revision: 99 }, error: null });
        await pending;
        expect(cloud.remoteRevision).toBe(0);
        expect(cloud.lastSyncedAt).toBeNull();
        expect(cloud.lastSyncDirection).toBeNull();
        expect(cloud.remoteWriteUncertain).toBe(true);
        expect(localStorage.getItem(state.saveKey)).toBe(raw);
        expect(new GameStateManager().load()).toBe(false);
        cloud.destroy();
    });

    test('a queued old upload is cleared when the game resets', () => {
        localStorage.setItem('mythical_void_cloud_save_enabled', 'true');
        const cloud = new CloudSaveManager({ gameState: state, client: {}, storage: localStorage });
        cloud.queueUpload(state.createSaveSnapshot());
        expect(cloud.pendingSave).not.toBeNull();
        state.startFreshGame();
        expect(cloud.pendingSave).toBeNull();
        expect(cloud.syncTimer).toBeNull();
        cloud.destroy();
    });

    test('a mutation waiting for the lock never dispatches into a restarted game', async () => {
        localStorage.setItem('mythical_void_cloud_save_enabled', 'true');
        const cloud = new CloudSaveManager({ gameState: state, client: {}, storage: localStorage });
        let enterLock;
        cloud.withSyncLock = callback => new Promise(resolve => { enterLock = () => resolve(callback()); });
        const callback = jest.fn();
        const pending = cloud.performServerMutation(callback);
        state.startFreshGame();
        state.set('game.cloudSavePausedForNewGame', false);
        enterLock();
        await expect(pending).rejects.toMatchObject({ code: 'cloud_campaign_changed' });
        expect(callback).not.toHaveBeenCalled();
        cloud.destroy();
    });

    test.each(['success', 'failure'])('a late mutation %s cannot bypass the restart hold or replace the current queue', async outcome => {
        localStorage.setItem('mythical_void_cloud_save_enabled', 'true');
        const cloud = new CloudSaveManager({ gameState: state, client: {}, storage: localStorage });
        cloud.ensureSession = jest.fn(async () => ({ id: 'synthetic-owner' }));
        cloud.pendingSave = state.createSaveSnapshot();
        const apply = jest.spyOn(state, 'applyCloudWriteResult');
        let reply, reject;
        const pending = cloud.performServerMutation(() => new Promise((resolve, fail) => { reply = resolve; reject = fail; }));
        await Promise.resolve();
        expect(() => state.startFreshGame()).toThrow();
        cloud.destroy();
        state.set('player.cosmicCoins', 77);
        const newSave = state.createSaveSnapshot();
        cloud.pendingSave = newSave;
        if (outcome === 'success') reply({ revision: 10, gameState: {} });
        else reject(new Error('old-operation-failed'));
        await expect(pending).rejects.toMatchObject({ code: 'cloud_campaign_changed' });
        expect(apply).not.toHaveBeenCalled();
        expect(cloud.pendingSave).toBe(newSave);
        expect(cloud.status).toBe('save_protected');
        expect(cloud.remoteRevision).toBe(0);
        expect(cloud.remoteWriteUncertain).toBe(true);
        expect(new GameStateManager().load()).toBe(false);
        cloud.destroy();
    });

    test('stale receipt reconciliation cannot report a new game as synced', async () => {
        localStorage.setItem('mythical_void_cloud_save_enabled', 'true');
        const cloud = new CloudSaveManager({ gameState: state, client: {}, storage: localStorage });
        state.set('breedingShrine.reconciliationQueue', [{ operationId: 'synthetic-old-operation' }]);
        let reply;
        const priorAuthority = globalThis.FusionAuthority;
        globalThis.FusionAuthority = { reconcileOfflineReceipt: jest.fn(() => new Promise(resolve => { reply = resolve; })) };
        try {
            const pending = cloud.reconcileFusionReceipts();
            state.startFreshGame();
            state.set('game.cloudSavePausedForNewGame', false);
            cloud.status = 'new-game-status';
            reply({});
            await expect(pending).rejects.toMatchObject({ code: 'cloud_campaign_changed' });
            expect(cloud.status).toBe('new-game-status');
            expect(cloud.lastSyncedAt).toBeNull();
        } finally { globalThis.FusionAuthority = priorAuthority; cloud.destroy(); }
    });

    test('an enabled old cloud save cannot overwrite the new egg, including a late response', async () => {
        localStorage.setItem('mythical_void_cloud_save_enabled', 'true');
        localStorage.setItem('mythical_void_age_group', 'age_18_plus');
        const cloud = new CloudSaveManager({gameState:state,client:{},storage:localStorage});
        cloud.ensureSession = jest.fn(async () => ({id:'fixture'}));
        let reply;
        cloud.fetchRemoteSave = jest.fn(() => new Promise(resolve => { reply = resolve; }));
        const pending = cloud.synchronizeSnapshot(state.createSaveSnapshot());
        await Promise.resolve();
        state.startFreshGame();
        reply({revision:2,game_state:{savedAt:Date.now()+10000,creature:{hatched:true,name:'Old cloud creature'}}});
        await pending;
        expect(cloud.isEnabled()).toBe(false);
        expect(await cloud.restoreRemoteSave({creature:{hatched:true}})).toBe(false);
        expect(state.get('creature.hatched')).toBe(false);
        cloud.ensureSession.mockClear();
        await cloud.initialize();
        expect(cloud.ensureSession).not.toHaveBeenCalled();
        await expect(cloud.enable({consentConfirmed:false})).rejects.toThrow('consent');
        expect(state.get('game.cloudSavePausedForNewGame')).toBe(true);
    });
});
