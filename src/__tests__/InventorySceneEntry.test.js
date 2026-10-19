const { fixture, factsFor, clone } = require('./support/levelCompletionFixture.cjs');

describe('Inventory source loading at the actual new Sanctuary entry boundary', () => {
    let owned, scenes;
    beforeEach(() => { owned = []; scenes = []; document.body.innerHTML = ''; });
    afterEach(() => {
        for (const scene of scenes) { scene.events.emit('shutdown'); scene.regionalVictoryPanel?.destroy(); }
        owned.forEach(f => f.close()); jest.restoreAllMocks(); document.body.innerHTML = '';
    });
    const create = options => { const f = fixture(options); owned.push(f); return f; };
    const observe = f => ({ root: f.state.state, memory: JSON.stringify(f.state.state), raw: f.storage.getItem(f.state.saveKey),
        cache: f.selected.InventoryManager.inventory, cacheData: clone(f.selected.InventoryManager.inventory),
        calls: clone(f.calls), notifications: clone(f.notifications), persistence: clone(f.persistenceEvents) });

    test('actual hatch and naming root adoptions can enter Sanctuary and then complete Forest', () => {
        const f = create({ beforeServices: ({ state }) => { state.state = state.createInitialState(); state.set('session.gameStarted', true); } });
        const inventory = f.selected.InventoryManager, bootRoot = f.state.state, bootCache = inventory.inventory;
        const genes = { id: 'synthetic-opening-genes', species: 'nebulaSprite', rarity: 'rare', personality: { core: 'curious' },
            cosmicAffinity: { element: 'nebula' }, traits: { bodyShape: { type: 'slender' }, features: {},
                colorGenome: { primary: 0xB672E8, secondary: 0xEDCE4C, accent: 0x89E3D7 } } };
        expect(f.state.commitCreatureHatch({ genetics: genes, textureName: 'synthetic-baby', descriptiveName: 'Synthetic Sprite' },
            { expectedActiveIdentity: f.state.getHatchActiveIdentity() }).success).toBe(true);
        expect(f.state.state).not.toBe(bootRoot);
        const achievements = f.selected.AchievementSystem, quests = f.selected.QuestManager;
        const achievementPublication = achievements.captureHatchProgressPublication(), questPublication = quests.captureNamingProgressPublication(f.state);
        const named = f.state.prepareCreatureNamingDraft('Synthetic Sprite', { synthetic: true }, achievements, quests);
        achievementPublication.prepare(named.achievements); questPublication.prepare(named.state);
        expect(f.state.commitHatchSaveDraft(named.state, { onPublished: () => { questPublication.publish(); achievementPublication.publish(); },
            notifications: named.notifications, onNotification: packet => {
                if (packet.kind === 'state') f.state.emit(packet.event, packet.data);
                else if (packet.kind === 'achievement') achievements.events.emit(packet.event, packet.data);
                else quests.emit(packet.event, packet.data);
            } }).success).toBe(true);
        expect(inventory.captureRewardCalculationSource().status).toBe('unqualified');
        const before = observe(f);
        expect(f.api.loadInventoryForEntry()).toBe(true);
        expect(observe(f)).toEqual(before); expect(inventory.inventory).toBe(bootCache);
        expect(f.state.get('inventory.items')).toBeUndefined(); expect(inventory.captureRewardCalculationSource().status).toBe('captured');
        // Actual GameScene initialises Thought after the hatch/name handoff.
        f.selected.ThoughtBubbleSystem.initialize(); f.selected.ThoughtBubbleSystem.setBiome('mythical_forest_1');
        f.context.document = document; Object.assign(f.selected, { innerWidth: 390, innerHeight: 844,
            addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window) });
        const scene = new f.api.NativeForest(factsFor(0), f.effects); scenes.push(scene);
        expect(scene.showBossVictory()).toBe(true); expect(f.state.get('combat.bossesDefeated')).toBe(1);
        expect(document.querySelector('[data-testid="expedition-debrief"]')).not.toBeNull();
    });

    test('equal-content canonical items rebind only the volatile cache after a same-admission root copy', () => {
        const f = create({ beforeServices: ({ state }) => state.set('inventory.items', [
            { id: 'synthetic-food', type: 'food', quantity: 2, slot: 0, syntheticRetained: { zero: 0, disabled: false } }
        ]) });
        const inventory = f.selected.InventoryManager, oldCache = inventory.inventory;
        expect(f.state.commitHatchSaveDraft(clone(f.state.state)).success).toBe(true);
        expect(inventory.captureRewardCalculationSource().status).toBe('unqualified');
        const before = observe(f);
        expect(f.api.loadInventoryForEntry()).toBe(true);
        expect(inventory.inventory).toBe(f.state.get('inventory.items')); expect(inventory.inventory).not.toBe(oldCache);
        expect({ ...observe(f), cache: oldCache }).toEqual(before); expect(oldCache).toEqual(before.cacheData);
    });

    test('a different same-admission cache and saved inventory is protected without discarding either side', () => {
        const f = create({ beforeServices: ({ state }) => state.set('inventory.items', [{ id: 'synthetic-old', type: 'food', quantity: 2, slot: 0 }]) });
        const next = clone(f.state.state); next.inventory.items.push({ id: 'synthetic-extra', type: 'food', quantity: 1, slot: 1 });
        expect(f.state.commitHatchSaveDraft(next).success).toBe(true); const before = observe(f);
        expect(f.selected.InventoryManager.loadSourceForSceneEntry(f.state)).toBe(false); expect(observe(f)).toEqual(before);
        expect(f.api.loadInventoryForEntry()).toBe(false); expect(f.state.getSaveAdmission().status).toBe('held');
        expect(f.selected.InventoryManager.inventory).toBe(before.cache); expect(f.state.state.inventory.items).toHaveLength(2);
        expect(f.storage.getItem(f.state.saveKey)).toBe(before.raw);
    });

    test('an admitted new campaign loads its own authoritative items, never the earlier campaign cache', () => {
        const f = create({ beforeServices: ({ state }) => state.set('inventory.items', [{ id: 'synthetic-earlier', type: 'food', quantity: 2, slot: 0 }]) });
        const old = f.selected.InventoryManager.inventory, oldData = clone(old), incoming = f.state.createInitialState();
        incoming.inventory = { items: [{ id: 'synthetic-current', type: 'food', quantity: 1, slot: 0 }], syntheticRetained: false };
        expect(f.state.applyExternalSave(incoming, { source: 'synthetic-new-admission' })).toBe(true);
        const data = JSON.stringify(f.state.state), raw = f.storage.getItem(f.state.saveKey);
        expect(f.api.loadInventoryForEntry()).toBe(true); expect(f.selected.InventoryManager.inventory).toBe(f.state.get('inventory.items'));
        expect(old).toEqual(oldData); expect(JSON.stringify(f.state.state)).toBe(data); expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
    });
    test('a new admitted empty campaign gets a private cache, not an invented saved items field', () => {
        const f = create({ beforeServices: ({ state }) => state.set('inventory.items', [{ id: 'synthetic-earlier', type: 'food', quantity: 2, slot: 0 }]) });
        expect(f.state.applyExternalSave(f.state.createInitialState(), { source: 'synthetic-new-empty' })).toBe(true);
        const raw = f.storage.getItem(f.state.saveKey);
        expect(f.api.loadInventoryForEntry()).toBe(true); expect(f.selected.InventoryManager.inventory).toEqual([]);
        expect(f.state.get('inventory.items')).toBeUndefined(); expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
        expect(f.selected.InventoryManager.captureRewardCalculationSource().status).toBe('captured');
    });

    test('temporary upload is not absence provenance or permission to bypass the actual writer lease', () => {
        let cloud;
        const f = create({ beforeServices: ({ state, selected }) => { cloud = { gameState: state, campaignEpoch: 1, currentUser: { id: 'synthetic-review' } }; selected.CloudSave = cloud; } });
        const inventory = f.selected.InventoryManager, old = inventory.captureRewardCalculationSource();
        expect(old.status).toBe('captured');
        const lease = f.state.beginCloudWrite('upload', f.state.createSaveSnapshot(), () => true); cloud.activeCloudWrite = lease;
        expect(old.isCurrent()).toBe(false);
        const during = inventory.captureRewardCalculationSource(); expect(during.status).toBe('captured');
        expect(f.state.commitHatchSaveDraft(clone(f.state.state)).success).toBe(false);
        f.state.finishCloudWrite(lease); cloud.activeCloudWrite = null;
        expect(inventory.captureRewardCalculationSource().status).toBe('captured');
    });

    test('unknown private empty cache cannot be blessed merely because the current save has no items', () => {
        const f = create(); f.selected.InventoryManager.inventory = [];
        const before = observe(f); expect(f.selected.InventoryManager.loadSourceForSceneEntry(f.state)).toBe(false);
        expect(observe(f)).toEqual(before);
    });
    test('an entry load never runs legacy migration, inbox claiming, notifications or persistence', () => {
        const f = create(); expect(f.state.commitHatchSaveDraft(clone(f.state.state)).success).toBe(true);
        const inventory = f.selected.InventoryManager, before = observe(f);
        const migrate = jest.spyOn(inventory, 'migrateLegacyMapItems'), claim = jest.spyOn(inventory, 'claimPendingBossRewards'), save = jest.spyOn(inventory, 'saveInventory');
        // Method replacement is itself an unsupported adapter; no fallback reload.
        expect(inventory.loadSourceForSceneEntry(f.state)).toBe(false);
        expect(migrate).not.toHaveBeenCalled(); expect(claim).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
        expect(observe(f)).toEqual(before);
    });
});
