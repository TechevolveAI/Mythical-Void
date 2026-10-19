const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const { fixture, factsFor, clone, epoch } = require('./support/levelCompletionFixture.cjs');
const pinnedMethod = (file, name) => {
    const source = readPinnedSource(`c26b567f:${file}`);
    const cls = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
    const method = cls.body.body.find(node => node.key?.name === name);
    return `({${source.slice(method.start, method.end)}}).${name}`;
};
const showBossVictory = pinnedMethod('src/scenes/levels/MythicalForestLevel.js', 'showBossVictory');
const oldRecordEvent = pinnedMethod('src/systems/AchievementSystem.js', 'recordEvent');

describe('Forest complete business packet preserves its actual post-completion Guardian event', () => {
    let owned;
    const create = options => { const f = fixture(options); owned.push(f); return f; };
    beforeEach(() => { owned = []; });
    afterEach(() => owned.forEach(f => f.close()));
    function runOld(f, facts) {
        const scene = new f.api.Completion(facts, f.effects);
        scene.starFragmentsCollected = facts.rewardBonusCount;
        scene.syncCampaignObjectiveDisplay = () => {};
        scene.showRegionalVictorySummary = jest.fn();
        expect(vm.runInContext(showBossVictory, f.context).call(scene)).toBe(true);
        expect(scene.showRegionalVictorySummary).toHaveBeenCalledTimes(1);
        return scene.levelCompletionResult;
    }
    function verify({ seed, beforeServices, mode = 'installed', facts = {} } = {}) {
        const old = create({ seed, beforeServices, mode }), f = create({ seed, beforeServices, mode });
        const input = factsFor(0, facts), before = f.snapshot(), raw = f.storage.getItem(f.state.saveKey);
        const plan = f.calculate({ ...input, guardianRestoredAfter: true });
        expect(plan.status).toBe('calculated'); const expected = runOld(old, input);
        expect(plan.result).toEqual(clone(expected)); expect(plan.state).toEqual(old.snapshot());
        expect(plan.notifications).toEqual(old.notifications); expect(plan.effects).toEqual(old.effects);
        expect(plan.legacySaveRequests).toHaveLength(old.calls.filter(value => value.save).length);
        if (mode !== 'fallbacks') {
            const progress = manager => Object.fromEntries(Object.entries(manager.definitions).map(([id, value]) => [id,
                { progress: clone(value.progress), claimed: clone(value.claimed) }]));
            expect(plan.projections.achievements.achievements).toEqual(progress(old.selected.AchievementSystem));
            expect(plan.projections.achievements.pendingClaims).toEqual(clone(old.selected.AchievementSystem.pendingClaims));
            expect(f.participants.achievements.isCurrent()).toBe(true);
        }
        expect(f.snapshot()).toEqual(before); expect(f.storage.getItem(f.state.saveKey)).toBe(raw);
        expect(f.calls).toEqual([]); expect(f.notifications).toEqual([]); expect(f.effects).toEqual([]); expect(f.persistenceEvents).toEqual([]);
        const bond = plan.notifications.findIndex(packet => packet.event === 'changed:creature.bond');
        const guardian = plan.notifications.findIndex(packet => packet.event === 'changed:combat.bossesDefeated');
        if (mode !== 'fallbacks') expect(guardian).toBeGreaterThan(bond);
        return { f, old, plan, before };
    }

    test('first actual Forest completion includes the Guardian tier after its shared rewards and growth', () => {
        const { plan } = verify();
        expect(plan.state.combat.bossesDefeated).toBe(1);
        expect(plan.projections.achievements.pendingClaims.some(value => value.id === 'boss_slayer' && value.tier === 'BRONZE')).toBe(true);
        expect(plan.legacySaveRequests.at(-1)).toBe('guardian-achievements');
    });
    test.each([1, 2, 8, 9])('previous Guardian count %s retains the live tier thresholds', count => {
        const { plan } = verify({ seed: ({ state }) => state.set('combat.bossesDefeated', count) });
        expect(plan.state.combat.bossesDefeated).toBe(count + 1);
    });
    test.each(['shared', 'separate', 'mixed'])('warm %s progress keeps the actual emission-time alias rules', relation => {
        verify({ seed: ({ selected }) => {
            const manager = selected.AchievementSystem;
            manager.recordEvent('guardian_restored', { bossId: 'synthetic-prior' });
            if (relation !== 'shared') for (const entry of Object.values(manager.definitions)) {
                entry.progress = clone(entry.progress);
                if (relation === 'separate') entry.claimed = clone(entry.claimed);
            }
        } });
    });
    test('a legitimate replay retains one new battle count and coins/bond, without another campaign completion', () => {
        const { plan, before } = verify({ seed: ({ selected, complete }) => {
            complete(factsFor(0, { time: 2000 })); selected.AchievementSystem.recordEvent('guardian_restored', {});
        } });
        expect(plan.result.firstCompletion).toBe(false); expect(plan.state.stats.levelsCompleted).toBe(before.stats.levelsCompleted);
        expect(plan.state.combat.bossesDefeated).toBe(before.combat.bossesDefeated + 1);
        expect(plan.state.creature.bond.experience).toBe(before.creature.bond.experience + 10); expect(plan.result.coinsAwarded).toBeGreaterThan(0);
    });
    test('zero Inventory slots still retain the guaranteed reward in the inbox', () => {
        const { plan } = verify({ seed: ({ selected }) => { selected.InventoryManager.maxSlots = 0; } });
        expect(plan.projections.inventoryMode).toBe('original-empty'); expect(plan.state.inventory.pendingBossRewards).toHaveLength(1);
    });
    test('absent services retain the actual optional no-Guardian-event behaviour', () => { verify({ mode: 'fallbacks' }); });
    test.each([{ time: 0 }, { time: 300000, noDamage: false }, { rewardBonusCount: 3 }])('actual outcome facts %j retain all event results', facts => { verify({ facts }); });
    test('the complete graph retains unknown supported data, creature lineage and media references', () => {
        const { plan, before } = verify({ seed: ({ state }) => { state.state.syntheticRetained = { zero: 0, disabled: false, data: ['synthetic-retained'] }; } });
        expect(plan.state.syntheticRetained).toEqual(before.syntheticRetained); expect(plan.state.creatures).toEqual(before.creatures);
        expect(plan.state.activeCreatureIndex).toBe(before.activeCreatureIndex);
    });

    test.each(['guardian_restored', 'boss_defeated'])('live %s extraction still matches the actual pinned dispatcher', name => {
        const old = create(), current = create();
        old.context.getGameState = () => old.state;
        vm.runInContext(oldRecordEvent, old.context).call(old.selected.AchievementSystem, name, {});
        current.selected.AchievementSystem.recordEvent(name, {});
        expect(current.snapshot()).toEqual(old.snapshot()); expect(current.notifications).toEqual(old.notifications);
        expect(clone(current.selected.AchievementSystem.pendingClaims)).toEqual(clone(old.selected.AchievementSystem.pendingClaims));
        expect(current.calls).toEqual(old.calls);
    });

    test.each(['cloned-proof', 'foreign-proof', 'changed-state', 'changed-source', 'invalid-count'])('%s cannot continue or rebase a detached achievement calculation', kind => {
        const f = create(), source = f.participants.achievements;
        const data = { levelId: 'mythicalForest', noDamage: true, time: 1000, speedrunThreshold: 240000 };
        let previous = f.api.calculateCompletionAchievementDraft(source, f.state.state, data, epoch);
        expect(previous.status).toBe('calculated'); let state = clone(previous.state);
        if (kind === 'cloned-proof') previous = clone(previous);
        if (kind === 'foreign-proof') {
            const other = create(); previous = other.api.calculateCompletionAchievementDraft(other.participants.achievements, other.state.state, data, epoch);
        }
        if (kind === 'changed-state') state.achievements = {};
        if (kind === 'changed-source') f.selected.AchievementSystem = {};
        if (kind === 'invalid-count') state.combat.bossesDefeated = '2';
        const before = f.snapshot(), raw = f.storage.getItem(f.state.saveKey);
        expect(f.api.continueCompletionGuardianDraft(source, previous, state, epoch).status).toBe('unqualified');
        expect(f.snapshot()).toEqual(before); expect(f.storage.getItem(f.state.saveKey)).toBe(raw); expect(f.calls).toEqual([]);
    });
    test('the Forest-after hook cannot silently reorder another level or use an untyped truthy flag', () => {
        const f = create(), before = f.snapshot();
        expect(f.calculate(factsFor(1, { guardianRestoredAfter: true })).status).toBe('unqualified');
        expect(f.calculate(factsFor(0, { guardianRestoredAfter: 1 })).status).toBe('unqualified');
        expect(f.snapshot()).toEqual(before); expect(f.calls).toEqual([]);
    });
});
