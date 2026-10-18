const { fixture, factsFor, levels, clone, epoch } = require('./support/levelCompletionFixture.cjs');

describe('complete detached reward/progression packet versus the actual existing helper', () => {
    let owned;
    const create = options => { const f = fixture(options); owned.push(f); return f; };
    beforeEach(() => { owned = []; });
    afterEach(() => { owned.forEach(f => f.close()); jest.restoreAllMocks(); });
    const verify = ({ level = 0, mode = 'installed', seed, beforeServices, initialiseEconomy = true, facts = {} } = {}) => {
        const options = { level, mode, seed, beforeServices, initialiseEconomy }, data = factsFor(level, facts);
        const old = create(options), staged = create(options), before = staged.snapshot(), raw = staged.storage.getItem(staged.state.saveKey);
        const result = staged.calculate(data);
        if (result.status !== 'calculated') throw Error(JSON.stringify({ level: levels[level][0], mode, result,
            sources: Object.fromEntries(['inventory', 'achievements', 'thought'].map(key => [key, staged.participants[key]?.status || 'absent'])) }));
        const expected = old.complete(data);
        expect(result.result).toEqual(clone(expected)); expect(result.state).toEqual(old.snapshot());
        expect(result.notifications).toEqual(old.notifications); expect(result.effects).toEqual(old.effects);
        expect(result.legacySaveRequests).toHaveLength(old.calls.filter(call => call.save).length);
        expect(old.persistenceEvents.filter(packet => packet.event === 'saved')).toHaveLength(result.legacySaveRequests.length);
        expect(old.persistenceEvents.filter(packet => packet.event === 'saveBackupCreated')).toHaveLength(result.legacySaveRequests.length);
        expect(staged.snapshot()).toEqual(before); expect(staged.storage.getItem(staged.state.saveKey)).toBe(raw);
        expect(staged.calls).toEqual([]); expect(staged.effects).toEqual([]); expect(staged.notifications).toEqual([]); expect(staged.persistenceEvents).toEqual([]);
        expect(Object.isFrozen(result.state)).toBe(true); expect(Object.isFrozen(staged.state.state)).toBe(false);
        if (mode !== 'fallbacks') {
            expect(result.projections.inventoryPresence).toEqual({ root: Object.hasOwn(result.state, 'inventory'), items: Object.hasOwn(result.state.inventory || {}, 'items') });
            if (result.projections.inventoryPresence.items) {
                expect(result.projections.inventoryItems).toBe(result.state.inventory.items); expect(result.projections.inventoryMode).toBe('canonical');
            } else {
                expect(result.projections.inventoryItems).toEqual([]); expect(Object.isFrozen(result.projections.inventoryItems)).toBe(true);
                expect(result.projections.inventoryMode).toBe('original-empty');
            }
            expect(result.projections.thoughtContext).toBe(result.state.thoughtContext);
            expect(result.projections.quests).toBe(result.state.quests);
        }
        return { old, staged, result, before };
    };

    for (let level = 0; level < levels.length; level++) {
        test(levels[level][0] + ': all actual installed services agree on data/events/rewards', () => { verify({ level }); });
        test(levels[level][0] + ': existing absent-service fallbacks agree', () => { verify({ level, mode: 'fallbacks' }); });
        test(levels[level][0] + ': uninitialised Economy retains its fallback and no coin sound', () => { verify({ level, initialiseEconomy: false }); });
        test(levels[level][0] + ': legitimate replay keeps coins/bond but not duplicate campaign progression', () => {
            const { result, before } = verify({ level, seed: ({ complete }) => complete(factsFor(level, { time: 2000 })) });
            expect(result.result.firstCompletion).toBe(false); expect(result.result.shipPartAwarded).toBe(false);
            expect(result.state.stats.levelsCompleted).toBe(before.stats.levelsCompleted);
            expect(result.state.creature.bond.experience).toBe(before.creature.bond.experience + 10);
            expect(result.result.coinsAwarded).toBeGreaterThan(0); expect(result.state.levels[levels[level][0]].bestTime).toBe(1000);
        });
    }

    test.each([0, 2])('originally introduced and earned Guardian support records its actual expedition (%s interventions)', guardianInterventions => {
        const { result } = verify({ level: 3, facts: { guardianInterventions }, seed: ({ state, api }) => {
            const options = { save: false, occurredAt: new Date(epoch).toISOString() };
            expect(api.guardians.interactWithGuardianResident(state, 'elder_treant', options).reason).toBe('guardian_first_meeting');
            expect(api.guardians.interactWithGuardianResident(state, 'elder_treant', options).reason).toBe('guardian_task_accepted');
            expect(api.guardians.recordGuardianActivity(state, 'gardenVisits', options).changed).toBe(true);
            expect(api.guardians.interactWithGuardianResident(state, 'elder_treant', options).reason).toBe('guardian_task_completed');
        } });
        expect(result.result.guardianExpedition).toEqual({ guardianId: 'elder_treant', levelId: 'voidPeaks', noDamage: true, interventionCount: guardianInterventions });
        expect(result.state.world.guardianResidents.pendingExpeditionDebrief.guardianId).toBe('elder_treant');
    });

    test('known resident v3 and append-only restoration history retain exactly the existing reader semantics', () => {
        const { result, before } = verify({ level: 0 });
        expect(before.world.rescuedResidents.schemaVersion).toBe(3); expect(result.state.world.rescuedResidents.schemaVersion).toBe(4);
        const returning = verify({ level: 3 });
        expect(returning.before.world.currentEcology.history.some(entry => entry.vitalityBefore === null)).toBe(true);
        expect(returning.result.state.world.currentEcology.history).toEqual(returning.old.snapshot().world.currentEcology.history);
    });

    test('zero-time fast completion keeps the outer/achievement truthiness distinction', () => { verify({ level: 0, facts: { time: 0 } }); });
    test('damage and slow completion do not acquire clean/speedrun flags', () => { verify({ level: 2, facts: { time: 400000, noDamage: false } }); });
    test('fractional support coins preserve the original flooring and configured report', () => { verify({ level: 3, facts: { residentCoinBonus: 19.75, villageCoinBonus: 20 } }); });
    test('fractional support fallback is not floored', () => { verify({ level: 3, mode: 'fallbacks', facts: { residentCoinBonus: 19.75 } }); });
    test('full canonical Inventory queues the guaranteed reward without taking a slot', () => { verify({ level: 0, seed: ({ api }) => {
        for (let slot = 0; slot < 30; slot++) api.inventory.addItem({ id: `synthetic-item-${slot}`, type: 'food', name: 'Synthetic item', quantity: 1, slot });
    } }); });
    test('full bag with an existing matching stack still accepts its boss reward', () => { verify({ level: 0, seed: ({ api }) => {
        const power = api.getBossPowerupReward('mythicalForest');
        api.inventory.addItem({ ...power, quantity: 2, slot: 0 });
        for (let index = 0; index < 29; index++) api.inventory.addItem({
            id: `synthetic-item-${index}`, type: 'food', name: 'Synthetic item', quantity: 1, slot: index + 1 });
    } }); });
    test('full inbox fallback remains distinct from Inventory queue normalization', () => { verify({ level: 1, mode: 'fallbacks', seed: ({ state }) => {
        state.set('inventory.pendingBossRewards', [{ id: 'synthetic-prior-reward', type: 'powerup', quantity: 1 }]);
    } }); });
    test.each(['absent', 'retained-root'])('fresh zero-slot %s Inventory queues the reward without inventing saved items', kind => {
        const { result, before } = verify({ level: 0,
            beforeServices: ({ state }) => { if (kind === 'retained-root') state.set('inventory', { retained: [false, 0] }); },
            seed: ({ api }) => { api.inventory.maxSlots = 0; } });
        expect(Object.hasOwn(before, 'inventory')).toBe(kind === 'retained-root');
        if (kind === 'retained-root') expect(result.state.inventory.retained).toEqual([false, 0]);
        expect(Object.hasOwn(result.state.inventory, 'items')).toBe(false);
        expect(result.state.inventory.pendingBossRewards).toHaveLength(1); expect(result.projections.inventoryItems).toEqual([]);
        expect(result.result.bossPowerupReward).toMatchObject({ awarded: true, queued: true });
    });
    test('selected creature, ancestry, media and loaded quest data are preserved', () => {
        const { result, before } = verify({ level: 3, seed: ({ state }) => {
            state.state.syntheticRetained = { ids: ['synthetic-fusion-a', 'synthetic-fusion-b'], zero: 0, falseValue: false };
            state.state.creature.bond.experience = 45;
        } });
        expect(result.state.creatures).toEqual(before.creatures); expect(result.state.activeCreatureIndex).toBe(before.activeCreatureIndex);
        expect(result.state.creature.genes).toEqual(before.creature.genes); expect(result.state.quests).toEqual(before.quests);
        expect(result.state.syntheticRetained).toEqual(before.syntheticRetained); expect(result.state.creature.bond.level).toBe(2);
    });

    test('elapsed session accounting remains the real writer responsibility, never a fabricated calculation save', () => {
        const old = create({ level: 2 }), staged = create({ level: 2 }), before = staged.snapshot();
        old.advanceClock(5000); staged.advanceClock(5000);
        const data = factsFor(2, { now: epoch + 5000 }), result = staged.calculate(data), expected = old.complete(data), after = old.snapshot();
        expect(result.status).toBe('calculated'); expect(result.result).toEqual(clone(expected));
        expect(result.notifications).toEqual(old.notifications); expect(result.effects).toEqual(old.effects);
        expect(after.player.playTime).toBe(before.player.playTime + 5000); expect(after.player.lastPlayed).toBe(data.now);
        expect(after.savedAt).toBe(data.now); expect(after.session.sessionStart).toBe(data.now);
        expect(result.state).toEqual({ ...after, savedAt: before.savedAt,
            player: { ...after.player, playTime: before.player.playTime, lastPlayed: before.player.lastPlayed },
            session: { ...after.session, sessionStart: before.session.sessionStart } });
        expect(staged.snapshot()).toEqual(before); expect(staged.calls).toEqual([]); expect(staged.persistenceEvents).toEqual([]);
    });

    test('captured facts replace wall-clock and random work during calculation', () => {
        const f = create({ level: 3 }), before = f.snapshot();
        f.context.Date.now = () => { throw Error('UNEXPECTED_CLOCK_READ'); };
        const originalRandom = f.context.Math.random;
        f.context.Math.random = () => { throw Error('UNEXPECTED_RANDOM_READ'); };
        try { expect(f.calculate(factsFor(3)).status).toBe('calculated'); }
        finally { f.context.Math.random = originalRandom; }
        expect(f.snapshot()).toEqual(before); expect(f.calls).toEqual([]);
    });

    test.each(['world-extra-field', 'history-extra-field', 'future-resident-version', 'string-coins', 'string-bond', 'unknown-source-field'])('%s is unqualified and never silently repaired or discarded', mode => {
        const f = create({ seed: ({ state }) => {
            if (mode === 'world-extra-field') state.state.world.currentEcology.syntheticUnknown = { retained: true };
            if (mode === 'history-extra-field') state.state.world.currentEcology.history = [{ id: 'restoration:mythical_forest', type: 'region_restored',
                subjectId: 'mythical_forest', occurredAt: new Date(epoch).toISOString(), syntheticRetained: true }];
            if (mode === 'future-resident-version') state.state.world.rescuedResidents.schemaVersion = 999;
            if (mode === 'string-coins') state.state.player.cosmicCoins = '77';
            if (mode === 'string-bond') state.state.creature.bond.experience = '45';
            if (mode === 'unknown-source-field') state.state.syntheticUndefined = undefined;
        } });
        const before = JSON.stringify(f.state.state), raw = f.storage.getItem(f.state.saveKey), result = f.calculate(factsFor(0));
        expect(result.status).toBe('unqualified'); expect(JSON.stringify(f.state.state)).toBe(before);
        expect(f.storage.getItem(f.state.saveKey)).toBe(raw); expect(f.calls).toEqual([]); expect(f.notifications).toEqual([]);
    });

    test('all independent captures still own original progress after the complete calculation', () => {
        const f = create({ level: 4 }), result = f.calculate(factsFor(4)); expect(result.status).toBe('calculated');
        for (const key of ['inventory', 'achievements', 'thought']) expect(f.participants[key].isCurrent()).toBe(true);
        expect(f.participants.isCurrent()).toBe(true);
    });

    test.each(['held', 'raw', 'memory'])('%s replacement retires the whole prepared calculation, without rebasing', kind => {
        const f = create({ level: 3 });
        if (kind === 'held') f.state.holdSaveAdmission({ code: 'commit_failed' }, 'synthetic');
        if (kind === 'raw') f.storage.setItem(f.state.saveKey, '{synthetic-successor');
        if (kind === 'memory') f.state.state = clone(f.state.state);
        const before = JSON.stringify(f.state.state), raw = f.storage.getItem(f.state.saveKey);
        expect(f.calculate(factsFor(3))).toEqual({ status: 'unqualified', reason: 'completion_source_changed' });
        expect(JSON.stringify(f.state.state)).toBe(before); expect(f.storage.getItem(f.state.saveKey)).toBe(raw); expect(f.calls).toEqual([]);
    });

    test('invalid facts cannot allocate a new state or use the current clock as a fallback', () => {
        const f = create(), before = f.snapshot();
        for (const changes of [{ levelId: 'synthetic-unknown' }, { now: NaN }, { now: -1 }, { time: Infinity }, { noDamage: undefined }]) {
            expect(f.calculate(factsFor(0, changes)).status).toBe('unqualified');
        }
        expect(f.snapshot()).toEqual(before); expect(f.calls).toEqual([]);
    });
});
