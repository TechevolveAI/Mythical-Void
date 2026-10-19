const { fixture, factsFor, clone } = require('./support/levelCompletionFixture.cjs');

describe('complete prepared data and fixed caches through the actual local writer', () => {
    let owned;
    const create = options => { const f = fixture(options); owned.push(f); return f; };
    beforeEach(() => { owned = []; });
    afterEach(() => { owned.forEach(f => f.close()); });
    const observe = f => ({ root: f.state.state, memory: JSON.stringify(f.state.state), raw: f.storage.getItem(f.state.saveKey),
        inventory: f.selected.InventoryManager?.inventory, thought: f.selected.ThoughtBubbleSystem?.context,
        active: f.selected.QuestManager?.activeQuests, completed: f.selected.QuestManager?.completedQuests,
        notifications: clone(f.notifications), persistence: clone(f.persistenceEvents) });

    // This test composition is not the active scene controller: actor/input/UI
    // lifetime qualification and presentation remain separate work.
    function prepare(f, level = 0, facts = {}) {
        const state = f.state, original = state.state, admission = state.saveAdmission, selectedWindow = f.context.window;
        const selected = Object.entries(f.selected), cloud = selectedWindow.CloudSave;
        const epoch = state.getSaveAdmission().epoch, cloudEpoch = cloud?.campaignEpoch, cloudUser = cloud?.currentUser?.id;
        const raw = f.storage.getItem(state.saveKey), reader = state.captureSaveAdmissionOwner({ raw });
        const memoryOwner = state.captureSaveAdmissionOwner();
        const inventory = f.selected.InventoryManager, achievements = f.selected.AchievementSystem, quests = f.selected.QuestManager;
        const economy = f.selected.EconomyManager;
        const thought = f.selected.ThoughtBubbleSystem;
        const publications = [quests?.captureNamingProgressPublication(state), achievements?.captureHatchProgressPublication(),
            thought?.captureCompletionContextPublication(state), inventory?.captureCompletionCachePublication(state)].filter(Boolean);
        const plan = f.calculate(factsFor(level, facts)); expect(plan.status).toBe('calculated');
        const draft = f.api.prepareCompletionPublicationDraft(plan, { inventory, achievements });
        if (quests) publications[0].prepare(draft.state);
        if (achievements) publications[1].prepare({ state: draft.state, ...draft.projections.achievements });
        if (thought) publications[2].prepare(draft.state, draft.projections.thoughtContext);
        if (inventory) publications[3].prepare(draft.state, draft.projections);
        const guard = f.api.captureCompletionPacketGuard(draft, { inventory, achievements });
        const core = () => f.context.window === selectedWindow && selectedWindow.GameState === state && selectedWindow.CloudSave === cloud &&
            cloud?.campaignEpoch === cloudEpoch && cloud?.currentUser?.id === cloudUser &&
            state.saveAdmission === admission && state.getSaveAdmission().epoch === epoch;
        const current = () => core() && selected.every(([key, value]) => f.context.window[key] === value) &&
            guard.isCurrent() && publications.every(publication => publication.isCurrent()) &&
            (state.state === original ? memoryOwner.isCurrent() : state.state === draft.state);
        // Before adoption every original source must still qualify. Afterwards
        // a service/publication fault is NOT a different campaign: the writer's
        // original new-root reader can protect it without holding a successor.
        const campaign = () => core() && (state.state === original ? current() : state.state === draft.state);
        let phase = 'prepared', durable;
        let writerCalls = 0;
        const commit = () => {
            if (phase === 'committed') return { success: Boolean(current() && durable()) };
            if (phase !== 'prepared' || !current()) { phase = 'protected'; return { success: false }; }
            if (!reader.isCurrent()) { phase = 'protected'; reader.hold({ code: 'commit_failed' }, 'local'); return { success: false }; }
            writerCalls++;
            const result = state.commitHatchSaveDraft(draft.state, {
                draftGuard: guard,
                isCurrentCampaign: campaign,
                isCurrentResult: (live, stored, serialized) => live === draft.state &&
                    JSON.stringify(state.createSaveSnapshot({ state: live })) === serialized && JSON.stringify(stored) === serialized,
                onPublished: () => {
                    for (const publication of publications) {
                        if (!current()) throw Error('COMPLETION_PUBLICATION_SOURCE_RETIRED');
                        publication.publish();
                    }
                    if (!current()) throw Error('COMPLETION_PUBLICATION_SOURCE_RETIRED');
                },
                notifications: draft.notifications,
                onNotification: packet => {
                    if (!current() || !publications.every(publication => publication.isPublished())) throw Error('COMPLETION_NOTIFICATION_SOURCE_RETIRED');
                    if (packet.kind === 'state') state.emit(packet.event, packet.data);
                    else if (packet.kind === 'inventory') inventory.events.emit(packet.event, packet.data);
                    else if (packet.kind === 'economy') economy.events.emit(packet.event, packet.data);
                    else if (packet.kind === 'achievement') achievements.events.emit(packet.event, packet.data);
                    else throw Error('UNKNOWN_COMPLETION_EVENT');
                    if (!current()) throw Error('COMPLETION_NOTIFICATION_SOURCE_RETIRED');
                }
            });
            if (result.success) { phase = 'committed'; durable = result.isCurrent; }
            else if (!current() || !reader.isCurrent()) phase = 'protected';
            return result;
        };
        return { plan, draft, guard, publications, current, reader, commit, get phase() { return phase; }, get writerCalls() { return writerCalls; } };
    }

    test.each([0, 1, 2, 3, 4, 5])('level %s: caches precede every ordinary notification, with one verified save', level => {
        const f = create({ level }), before = observe(f), attempt = prepare(f, level);
        expect(observe(f)).toEqual(before); expect(attempt.publications.every(pub => !pub.isPublished())).toBe(true);
        const checks = [];
        f.state.on('stateChanged', () => checks.push({ inventory: f.selected.InventoryManager.inventory === f.state.get('inventory.items'),
            thought: f.selected.ThoughtBubbleSystem.context === f.state.get('thoughtContext'),
            active: f.selected.QuestManager.activeQuests === f.state.get('quests.active'),
            completed: f.selected.QuestManager.completedQuests === f.state.get('quests.completed'),
            achievements: f.selected.AchievementSystem.hasHatchProgressSource(f.state) }));
        const result = attempt.commit();
        expect(result.success).toBe(true); expect(result.isCurrent()).toBe(true); expect(attempt.current()).toBe(true);
        expect(checks.length).toBeGreaterThan(0); expect(checks.every(check => Object.values(check).every(Boolean))).toBe(true);
        expect(attempt.publications.every(pub => pub.isPublished())).toBe(true); expect(f.calls).toEqual([]);
        expect(f.notifications).toEqual(attempt.plan.notifications);
        expect(f.persistenceEvents.filter(packet => packet.event === 'saved')).toHaveLength(1);
        expect(f.persistenceEvents.filter(packet => packet.event === 'saveBackupCreated')).toHaveLength(1);
        expect(f.state.state).toBe(attempt.draft.state); expect(JSON.parse(f.storage.getItem(f.state.saveKey)).levels[factsFor(level).levelId].completed).toBe(true);
        expect(attempt.commit().success).toBe(true); expect(attempt.writerCalls).toBe(1);
        expect(f.selected.InventoryManager.captureRewardCalculationSource().status).toBe('captured');
        expect(f.selected.ThoughtBubbleSystem.captureCompletionContextSource().status).toBe('captured');
    });

    test('the actual Forest-after-Guardian packet publishes one coherent save and complete achievement queue', () => {
        const f = create(), before = observe(f), attempt = prepare(f, 0, { guardianRestoredAfter: true });
        expect(observe(f)).toEqual(before); expect(attempt.commit().success).toBe(true);
        expect(f.state.get('combat.bossesDefeated')).toBe(1);
        expect(f.selected.AchievementSystem.pendingClaims.some(value => value.id === 'boss_slayer' && value.tier === 'BRONZE')).toBe(true);
        expect(f.selected.AchievementSystem.hasHatchProgressSource(f.state)).toBe(true);
        expect(f.notifications).toEqual(attempt.plan.notifications);
        expect(f.persistenceEvents.filter(packet => packet.event === 'saved')).toHaveLength(1); expect(f.calls).toEqual([]);
        expect(attempt.commit().success).toBe(true); expect(attempt.writerCalls).toBe(1); expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test('Forest-after-Guardian refusal retains exactly one calculation across an elapsed-time retry', () => {
        const f = create(), calculate = jest.spyOn(f, 'calculate'), before = observe(f);
        const attempt = prepare(f, 0, { guardianRestoredAfter: true }), set = f.storage.setItem; let refuse = true;
        f.storage.setItem = (key, value) => {
            if (key === f.state.saveKey && refuse) throw Error('SYNTHETIC_REFUSAL'); return set(key, value);
        };
        f.advanceClock(100); expect(attempt.commit().success).toBe(false); expect(attempt.phase).toBe('prepared');
        expect(f.state.state).toBe(before.root); expect(f.storage.getItem(f.state.saveKey)).toBe(before.raw);
        expect(f.state.get('combat.bossesDefeated')).toBe(0);
        f.advanceClock(1000); refuse = false; expect(attempt.commit().success).toBe(true);
        expect(calculate).toHaveBeenCalledTimes(1); expect(f.state.get('combat.bossesDefeated')).toBe(1);
        expect(f.selected.AchievementSystem.pendingClaims.filter(value => value.id === 'boss_slayer' && value.tier === 'BRONZE')).toHaveLength(1);
        expect(f.state.get('player.playTime')).toBe(1100); expect(attempt.commit().success).toBe(true);
        expect(attempt.writerCalls).toBe(2); expect(f.state.get('combat.bossesDefeated')).toBe(1);
    });

    test('a successor admitted by the appended Guardian observer receives no later old notification', () => {
        const f = create(), attempt = prepare(f, 0, { guardianRestoredAfter: true }); let successor;
        const off = f.state.on('changed:combat.bossesDefeated', () => {
            off(); const incoming = f.state.createInitialState(); incoming.player.cosmicCoins = 77;
            expect(f.state.applyExternalSave(incoming, { source: 'synthetic-guardian-successor' })).toBe(true);
            successor = { root: f.state.state, raw: f.storage.getItem(f.state.saveKey), data: JSON.stringify(f.state.state), admission: f.state.saveAdmission };
        });
        expect(attempt.commit().success).toBe(false); expect(attempt.phase).toBe('protected'); expect(successor).toBeDefined();
        expect(f.state.state).toBe(successor.root); expect(JSON.stringify(f.state.state)).toBe(successor.data);
        expect(f.storage.getItem(f.state.saveKey)).toBe(successor.raw); expect(f.state.saveAdmission).toBe(successor.admission);
        expect(attempt.commit().success).toBe(false); expect(attempt.writerCalls).toBe(1);
    });

    test.each(['absent', 'retained-root'])('zero slots with %s retains a proved empty cache after verified adoption', kind => {
        const f = create({ beforeServices: ({ state }) => { if (kind === 'retained-root') state.set('inventory', { retained: [false, 0] }); },
            seed: ({ api }) => { api.inventory.maxSlots = 0; } });
        const before = observe(f), attempt = prepare(f); expect(observe(f)).toEqual(before);
        expect(attempt.commit().success).toBe(true); expect(attempt.draft.projections.inventoryMode).toBe('original-empty');
        expect(f.state.get('inventory.items')).toBeUndefined(); expect(f.selected.InventoryManager.inventory).toEqual([]);
        expect(f.state.get('inventory.pendingBossRewards')).toHaveLength(1);
        const source = f.selected.InventoryManager.captureRewardCalculationSource();
        expect(source.status).toBe('captured'); expect(source.scope).toBe('memory-owner-and-original-empty-cache');
        if (kind === 'retained-root') expect(f.state.get('inventory.retained')).toEqual([false, 0]);
        f.state.state.inventory.items = [];
        expect(attempt.publications[3].isCurrent()).toBe(false);
        expect(f.selected.InventoryManager.captureRewardCalculationSource().status).toBe('unqualified');
    });

    test('actual item/config/canonical notification aliases are prepared before writing', () => {
        const f = create({ level: 1 }), before = observe(f), attempt = prepare(f, 1), seen = {};
        f.selected.InventoryManager.events.on('itemAdded', data => { seen.item = data.item; });
        f.selected.InventoryManager.events.on('shipPartCollected', data => { seen.part = data.partInfo; });
        f.selected.AchievementSystem.events.on('achievement:unlocked', data => {
            expect(data.tierInfo).toBe(f.selected.AchievementSystem.tiers[data.tier]);
            expect(data.rewards).toBe(f.selected.AchievementSystem.definitions[data.id].tiers[data.tier].rewards);
        });
        f.state.on('changed:inventory.items', items => { expect(items).toBe(f.selected.InventoryManager.inventory); });
        f.state.on('changed:thoughtContext', context => { expect(context).toBe(f.selected.ThoughtBubbleSystem.context); });
        expect(observe(f)).toEqual(before); expect(attempt.commit().success).toBe(true);
        expect(seen.item).toBe(f.selected.InventoryManager.inventory.find(item => item.id === seen.item.id));
        expect(seen.part).toBe(f.selected.InventoryManager.SHIP_PART_DEFINITIONS.crystal_core);
        expect(Object.isFrozen(f.selected.InventoryManager.inventory)).toBe(false); expect(Object.isFrozen(seen.item)).toBe(false);
    });

    test('warm shared Inventory and Thought oldValue/newValue keep their actual canonical relationship', () => {
        const f = create({ level: 1 }), attempt = prepare(f, 1), seen = [];
        f.state.on('stateChanged', data => {
            if (!['inventory.items', 'thoughtContext'].includes(data.path)) return;
            expect(data.oldValue).toBe(data.newValue); expect(data.newValue).toBe(f.state.get(data.path)); seen.push(data.path);
        });
        expect(attempt.commit().success).toBe(true); expect(seen).toEqual(['thoughtContext', 'inventory.items']);
    });

    test('equal-valued separate Thought oldValue stays separate, never inferred as a canonical alias', () => {
        const f = create({ seed: ({ selected }) => {
            selected.ThoughtBubbleSystem.recordSuccess('mythical_forest_1');
            selected.ThoughtBubbleSystem.loadContextFromGameState();
        } });
        const attempt = prepare(f), packet = attempt.draft.notifications.find(value => value.event === 'stateChanged' && value.data.path === 'thoughtContext');
        expect(packet.data.oldValue).toEqual(packet.data.newValue); expect(packet.data.oldValue).not.toBe(packet.data.newValue);
        expect(packet.data.newValue).toBe(attempt.draft.state.thoughtContext);
        expect(attempt.commit().success).toBe(true); expect(packet.data.newValue).toBe(f.selected.ThoughtBubbleSystem.context);
        expect(packet.data.oldValue).not.toBe(f.selected.ThoughtBubbleSystem.context);
    });

    test('the combined sequence uses those exact prepared notification packets', () => {
        const f = create(), attempt = prepare(f), timeline = attempt.draft.timeline.filter(entry => entry.type === 'notification');
        expect(timeline).toHaveLength(attempt.draft.notifications.length);
        timeline.forEach((entry, index) => expect(entry.packet).toBe(attempt.draft.notifications[index]));
        expect(timeline.find(entry => entry.packet.event === 'itemAdded').packet.data.item).toBe(attempt.draft.projections.inventoryItems[0]);
        expect(attempt.commit().success).toBe(true);
    });

    const futureChanges = [
        ['item-edit', draft => { draft.state.inventory.items[0].quantity = 77; }],
        ['items-replaced', draft => { draft.state.inventory.items = clone(draft.state.inventory.items); }],
        ['item-replaced', draft => { draft.state.inventory.items[0] = clone(draft.state.inventory.items[0]); }],
        ['private-cache-edit', draft => { draft.projections.inventoryItems.push({ id: 'synthetic-unowned', quantity: 1 }); }],
        ['private-cache-replaced', draft => { draft.projections.inventoryItems = []; }],
        ['private-presence-change', draft => { draft.projections.inventoryPresence.items = true; }],
        ['sealed-cache', draft => { Object.seal(draft.projections.inventoryItems); }],
        ['frozen-cache', draft => { Object.freeze(draft.projections.inventoryItems); }],
        ['frozen-item', draft => { Object.freeze(draft.projections.inventoryItems[0]); }],
        ['frozen-inventory', draft => { Object.freeze(draft.state.inventory); }],
        ['sealed-parts', draft => { Object.seal(draft.state.hubWorld.shipParts); }],
        ['parts-replaced', draft => { draft.state.hubWorld.shipParts = clone(draft.state.hubWorld.shipParts); }],
        ['collected-replaced', draft => { draft.state.hubWorld.shipParts.collected = clone(draft.state.hubWorld.shipParts.collected); }],
        ['frozen-root', draft => { Object.freeze(draft.state); }]
    ];
    for (const point of ['preflight', 'backup']) test.each(futureChanges)('prepared future %s change at ' + point + ' is refused before primary dispatch', (kind, mutate) => {
        const f = create({ seed: ({ api }) => { if (kind.startsWith('private-')) api.inventory.maxSlots = 0; } });
        const before = observe(f), attempt = prepare(f), set = f.storage.setItem; let primaryCalls = 0;
        f.storage.setItem = (key, value) => { if (key === f.state.saveKey) primaryCalls++; return set(key, value); };
        if (point === 'preflight') mutate(attempt.draft);
        else {
            const off = f.state.on('saveBackupCreated', () => { off(); mutate(attempt.draft); });
        }
        expect(attempt.commit().success).toBe(false); expect(primaryCalls).toBe(0); expect(attempt.phase).toBe('protected');
        expect(f.state.state).toBe(before.root); expect(JSON.stringify(f.state.state)).toBe(before.memory);
        expect(f.storage.getItem(f.state.saveKey)).toBe(before.raw); expect(f.selected.InventoryManager.inventory).toBe(before.inventory);
        expect(f.selected.ThoughtBubbleSystem.context).toBe(before.thought);
        expect(f.notifications.filter(packet => !['saveError', 'saveAdmissionChanged'].includes(packet.event))).toEqual([]);
        expect(attempt.commit().success).toBe(false);
        expect(attempt.writerCalls).toBe(point === 'preflight' ? 0 : 1);
    });

    test('unchanged definite refusal retains one packet and publishes nothing before successful retry', () => {
        const f = create({ level: 3 }), before = observe(f), attempt = prepare(f, 3), set = f.storage.setItem;
        let refused = true, primaryCalls = 0;
        f.storage.setItem = (key, value) => { if (key === f.state.saveKey) { primaryCalls++; if (refused) throw Error('SYNTHETIC_REFUSAL'); } return set(key, value); };
        expect(attempt.commit().success).toBe(false); expect(attempt.phase).toBe('prepared'); expect(attempt.reader.isCurrent()).toBe(true);
        expect(f.state.state).toBe(before.root); expect(f.selected.InventoryManager.inventory).toBe(before.inventory);
        expect(f.selected.ThoughtBubbleSystem.context).toBe(before.thought); expect(f.storage.getItem(f.state.saveKey)).toBe(before.raw);
        expect(f.notifications.every(packet => packet.event === 'saveError')).toBe(true);
        expect(f.persistenceEvents.some(packet => packet.event === 'saved')).toBe(false);
        refused = false;
        expect(attempt.commit().success).toBe(true); expect(attempt.phase).toBe('committed'); expect(primaryCalls).toBe(2);
        expect(f.notifications.filter(packet => packet.event !== 'saveError')).toEqual(attempt.plan.notifications);
        const committed = f.storage.getItem(f.state.saveKey); expect(attempt.commit().success).toBe(true);
        expect(primaryCalls).toBe(2); expect(f.storage.getItem(f.state.saveKey)).toBe(committed);
    });

    test('committed primary write with lost acknowledgement is verified, never rewarded twice', () => {
        const f = create({ level: 3 }), attempt = prepare(f, 3), set = f.storage.setItem;
        let primaryCalls = 0;
        f.storage.setItem = (key, value) => { const result = set(key, value); if (key === f.state.saveKey) { primaryCalls++; throw Error('SYNTHETIC_LOST_ACK'); } return result; };
        expect(attempt.commit().success).toBe(true); expect(attempt.commit().success).toBe(true);
        expect(primaryCalls).toBe(1); expect(f.notifications).toEqual(attempt.plan.notifications);
        expect(f.state.get('player.cosmicCoins')).toBe(attempt.plan.state.player.cosmicCoins);
    });

    test.each(['raw', 'memory', 'capacity', 'selected-service'])('%s successor before commit cannot be recaptured or overwritten', kind => {
        const f = create({ level: 3 }), attempt = prepare(f, 3);
        if (kind === 'raw') f.storage.setItem(f.state.saveKey, '{synthetic-successor');
        if (kind === 'memory') f.state.state = clone(f.state.state);
        if (kind === 'capacity') f.selected.InventoryManager.maxSlots++;
        if (kind === 'selected-service') f.selected.InventoryManager = { inventory: [] };
        const before = observe(f); expect(attempt.commit().success).toBe(false); expect(attempt.phase).toBe('protected');
        expect(f.state.state).toBe(before.root); expect(f.storage.getItem(f.state.saveKey)).toBe(before.raw);
        expect(attempt.commit().success).toBe(false); expect(attempt.writerCalls).toBe(0);
    });

    test.each(['backup', 'ordinary-event', 'saved'])('%s observer admitting a successor never receives another old mutation', point => {
        const f = create({ level: 3 }), attempt = prepare(f, 3); let successor;
        const event = { backup: 'saveBackupCreated', 'ordinary-event': 'changed:levels.voidPeaks.completed', saved: 'saved' }[point];
        const off = f.state.on(event, () => {
            off(); const incoming = f.state.createInitialState(); incoming.player.cosmicCoins = 77;
            expect(f.state.applyExternalSave(incoming, { source: 'synthetic-successor' })).toBe(true);
            successor = { root: f.state.state, raw: f.storage.getItem(f.state.saveKey), memory: JSON.stringify(f.state.state), admission: f.state.getSaveAdmission() };
        });
        expect(attempt.commit().success).toBe(false); expect(successor).toBeDefined(); expect(attempt.phase).toBe('protected');
        expect(f.state.state).toBe(successor.root); expect(JSON.stringify(f.state.state)).toBe(successor.memory);
        expect(f.storage.getItem(f.state.saveKey)).toBe(successor.raw); expect(f.state.getSaveAdmission()).toEqual(successor.admission);
        const calls = attempt.writerCalls; expect(attempt.commit().success).toBe(false); expect(attempt.writerCalls).toBe(calls);
    });

    test.each(['replace-service', 'assign-then-throw'])('partial cache publication %s retains durable data and cannot replay', kind => {
        let armed = false; const successor = { inventory: [{ id: 'synthetic-untouched' }] };
        const f = create({ level: 3, seed: ({ selected, api }) => {
            selected.InventoryManager = new Proxy(api.inventory, { set(target, key, value) {
                Reflect.set(target, key, value);
                if (armed && key === 'inventory') {
                    if (kind === 'replace-service') selected.InventoryManager = successor;
                    else throw Error('SYNTHETIC_PUBLICATION_INTERRUPTED');
                }
                return true;
            } });
        } });
        const attempt = prepare(f, 3); armed = true;
        expect(attempt.commit().success).toBe(false); expect(attempt.phase).toBe('protected');
        expect(JSON.parse(f.storage.getItem(f.state.saveKey)).levels.voidPeaks.completed).toBe(true);
        expect(f.state.state).toBe(attempt.draft.state);
        expect(f.state.getSaveAdmission().status).toBe('held');
        expect(f.notifications.filter(packet => packet.event !== 'saveAdmissionChanged')).toEqual([]);
        expect(successor.inventory).toEqual([{ id: 'synthetic-untouched' }]);
        expect(attempt.commit().success).toBe(false); expect(attempt.writerCalls).toBe(1);
    });

    test.each(['freeze-progress', 'seal-progress', 'replace-nested-progress', 'replace-claim-entry', 'freeze-claims'])(
        'published private achievement %s change retires before any later notification', kind => {
            const f = create(), attempt = prepare(f); let changed = false, delivered = 0;
            f.state.on('stateChanged', () => {
                delivered++;
                if (changed) return;
                changed = true;
                const manager = f.selected.AchievementSystem;
                const entry = Object.values(manager.definitions).find(value => Object.values(value.progress).some(field => field && typeof field === 'object'));
                if (kind === 'freeze-progress') Object.freeze(entry.progress);
                if (kind === 'seal-progress') Object.seal(entry.progress);
                if (kind === 'replace-nested-progress') {
                    const key = Object.keys(entry.progress).find(key => entry.progress[key] && typeof entry.progress[key] === 'object');
                    entry.progress[key] = clone(entry.progress[key]);
                }
                if (kind === 'replace-claim-entry') {
                    expect(manager.pendingClaims.length).toBeGreaterThan(0); manager.pendingClaims[0] = clone(manager.pendingClaims[0]);
                }
                if (kind === 'freeze-claims') Object.freeze(manager.pendingClaims);
            });
            expect(attempt.commit().success).toBe(false); expect(changed).toBe(true); expect(delivered).toBe(1);
            expect(attempt.publications[1].isCurrent()).toBe(false); expect(attempt.phase).toBe('protected');
            expect(f.state.getSaveAdmission().status).toBe('held');
            expect(JSON.parse(f.storage.getItem(f.state.saveKey)).levels.mythicalForest.completed).toBe(true);
            expect(attempt.commit().success).toBe(false); expect(attempt.writerCalls).toBe(1);
        });

    test('frozen or mismatched cache projections cannot publish, including before adoption', () => {
        const f = create(), plan = f.calculate(factsFor(0)), before = observe(f);
        const publication = f.selected.InventoryManager.captureCompletionCachePublication(f.state);
        expect(() => publication.prepare(plan.state, plan.projections)).toThrow('INVENTORY_PUBLICATION_NOT_PREPARED');
        const draft = f.api.prepareCompletionPublicationDraft(plan, { inventory: f.selected.InventoryManager, achievements: f.selected.AchievementSystem });
        const separated = { ...draft.projections, inventoryItems: clone(draft.projections.inventoryItems) };
        expect(() => publication.prepare(draft.state, separated)).toThrow('INVENTORY_PUBLICATION_NOT_PREPARED');
        publication.prepare(draft.state, draft.projections);
        expect(() => publication.publish()).toThrow('INVENTORY_PUBLICATION_RETIRED'); expect(observe(f)).toEqual(before);
    });

    test.each(['sealed-array', 'frozen-item', 'frozen-inventory', 'frozen-parts'])('%s is not an ordinary mutable post-save cache', kind => {
        const f = create(), before = observe(f), plan = f.calculate(factsFor(0));
        const draft = f.api.prepareCompletionPublicationDraft(plan, { inventory: f.selected.InventoryManager, achievements: f.selected.AchievementSystem });
        const publication = f.selected.InventoryManager.captureCompletionCachePublication(f.state);
        if (kind === 'sealed-array') Object.seal(draft.projections.inventoryItems);
        if (kind === 'frozen-item') Object.freeze(draft.projections.inventoryItems[0]);
        if (kind === 'frozen-inventory') Object.freeze(draft.state.inventory);
        if (kind === 'frozen-parts') Object.freeze(draft.state.hubWorld.shipParts);
        expect(() => publication.prepare(draft.state, draft.projections)).toThrow('INVENTORY_PUBLICATION_NOT_PREPARED');
        expect(observe(f)).toEqual(before);
    });

    test('projection preparation refuses mismatched semantic targets without falling back to live data', () => {
        const f = create({ level: 1 }), plan = f.calculate(factsFor(1)), before = observe(f);
        const changed = clone(plan); changed.notifications.find(packet => packet.kind === 'inventory' && packet.event === 'itemAdded').data.item.quantity = 77;
        expect(() => f.api.prepareCompletionPublicationDraft(changed, { inventory: f.selected.InventoryManager,
            achievements: f.selected.AchievementSystem })).toThrow('COMPLETION_EVENT_TARGET_CHANGED');
        expect(() => f.api.prepareCompletionPublicationDraft(plan)).toThrow('COMPLETION_INVENTORY_SINK_UNAVAILABLE');
        expect(observe(f)).toEqual(before);
    });
});
