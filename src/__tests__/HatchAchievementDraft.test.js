const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');

const { fixture, loadAchievementSystem, progress, clone } = require('./support/achievementDraftFixture.cjs');
const baseline = readPinnedSource('4b6950b2:src/systems/AchievementSystem.js');
const hatch = { hatchId: 'fictional-genes-77', rarity: 'rare', species: 'nebulaSprite' };

describe('service-free hatch achievement preparation', () => {
    const owned = [];
    const create = options => { const f = fixture(options); owned.push(f); return f; };
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(1700000000777);
        localStorage.clear();
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        delete window.CloudSave;
    });
    afterEach(() => {
        owned.splice(0).forEach(f => f.close()); jest.restoreAllMocks();
        jest.clearAllTimers(); jest.useRealTimers(); delete window.GameState;
    });

    const cases = [
        ['first hatch', () => {}, hatch],
        ['recorded hatch', state => {
            state.set('stats.recordedHatchIds', [hatch.hatchId]);
            state.set('stats.creaturesHatched', 4);
            state.set('stats.rareHatched', 2);
            state.set('stats.speciesDiscovered', ['nebulaSprite']);
        }, hatch],
        ['new thresholds', state => {
            state.set('stats.creaturesHatched', 24);
            state.set('stats.rareHatched', 9);
            state.set('stats.speciesDiscovered', ['stellarWyrm', 'crystalDrake']);
        }, hatch],
        ['known species', state => state.set('stats.speciesDiscovered', ['nebulaSprite']), hatch],
        ['legacy unkeyed event', () => {}, { rarity: 'common', species: 'stellarWyrm' }],
        ['empty legacy event', () => {}, {}],
        ['time-based progress', state => {
            state.set('creature.hatchTime', Date.now() - 30 * 86400000);
            state.set('creature.lifecycle.birthDate', Date.now() - 30 * 86400000);
        }, hatch]
    ];

    test.each(cases)('%s matches the pinned current calculation and leaves live state untouched', (label, seed, event) => {
        const old = create({ seed, source: baseline });
        const clock = jest.spyOn(Date, 'now');
        clock.mockClear();
        old.system.recordEvent('creature_hatched', event);
        const oldClockCalls = clock.mock.calls.length;
        const live = create({ seed });
        const before = JSON.stringify(live.state.state), beforeProgress = progress(live.system);
        clock.mockClear();
        const prepared = live.system.prepareHatchEventDraft(live.state.state, event);
        expect(clock.mock.calls.length).toBe(oldClockCalls);
        expect(clone(prepared.state)).toEqual(clone(old.state.state));
        expect(clone(prepared.achievements)).toEqual(progress(old.system));
        expect(clone(prepared.pendingClaims)).toEqual(clone(old.system.pendingClaims));
        expect(clone(prepared.events)).toEqual(clone(old.events));
        expect(prepared.saveRequests).toBe(old.state.save.mock.calls.length);
        expect(JSON.stringify(live.state.state)).toBe(before);
        expect(progress(live.system)).toEqual(beforeProgress);
        expect(live.system.pendingClaims).toHaveLength(0);
        expect(live.state.save).not.toHaveBeenCalled();
        expect(live.events).toHaveLength(0);
    });

    test('ordinary live hatch dispatch retains pinned results, events and nested save requests', () => {
        const old = create({ source: baseline }); old.system.recordEvent('creature_hatched', hatch);
        const live = create(); live.system.recordEvent('creature_hatched', hatch);
        expect(clone(live.state.state)).toEqual(clone(old.state.state));
        expect(progress(live.system)).toEqual(progress(old.system));
        expect(clone(live.events)).toEqual(clone(old.events));
        expect(clone(live.system.pendingClaims)).toEqual(clone(old.system.pendingClaims));
    });

    test.each(['shared', 'detached', 'mixed'])('warm %s hatch progress preserves loaded aliases and exact emission-time payloads', relation => {
        const warm = f => {
            f.system.recordEvent('creature_hatched', hatch);
            f.state.set('stats.creaturesHatched', 24); f.state.set('stats.rareHatched', 9);
            if (relation !== 'shared') for (const definition of Object.values(f.system.definitions)) {
                definition.progress = clone(definition.progress);
                if (relation === 'detached') definition.claimed = clone(definition.claimed);
            }
            f.events.length = 0; f.state.save.mockClear();
        };
        const next = { ...hatch, hatchId: 'synthetic-next-hatch' }, old = create({ source: baseline }); warm(old);
        old.system.recordEvent('creature_hatched', next);
        const f = create(); warm(f); const before = JSON.stringify(f.state.state), cache = progress(f.system), pending = clone(f.system.pendingClaims);
        const result = f.system.prepareHatchEventDraft(f.state.state, next);
        expect(result.state).toEqual(clone(old.state.state)); expect(result.achievements).toEqual(progress(old.system));
        expect(result.pendingClaims).toEqual(clone(old.system.pendingClaims)); expect(result.events).toEqual(clone(old.events));
        expect(result.saveRequests).toBe(old.state.save.mock.calls.length); expect(JSON.stringify(f.state.state)).toBe(before);
        expect(progress(f.system)).toEqual(cache); expect(clone(f.system.pendingClaims)).toEqual(pending);
        expect(f.state.save).not.toHaveBeenCalled(); expect(f.events).toEqual([]);
    });

    test('no-new-unlock calculation retains already unlocked and claimed tiers', () => {
        const f = create();
        for (const definition of Object.values(f.system.definitions)) {
            definition.progress = Object.fromEntries(Object.keys(definition.tiers).map(tier => [tier, {
                unlocked: true, unlockedAt: 77, value: 1
            }]));
            definition.claimed = { BRONZE: { claimedAt: 77 } };
        }
        const before = progress(f.system);
        f.system.pendingClaims.push({ id: 'fictional-existing-claim', tier: 'BRONZE' });
        const result = f.system.prepareHatchEventDraft(f.state.state, hatch);
        expect(result.saveRequests).toBe(0);
        expect(result.events.some(event => event.kind === 'achievement')).toBe(false);
        expect(clone(result.achievements)).toEqual(before);
        expect(clone(result.pendingClaims)).toEqual([{ id: 'fictional-existing-claim', tier: 'BRONZE' }]);
        result.pendingClaims[0].id = 'fictional-changed-draft';
        expect(f.system.pendingClaims[0].id).toBe('fictional-existing-claim');
    });

    test('preparation uses no global state, storage, event sink, reward service or randomness', () => {
        const f = create();
        const { system, sandbox } = loadAchievementSystem(f.state);
        delete sandbox.window;
        sandbox.devLog.mockClear();
        const stateBefore = JSON.stringify(f.state.state);
        const random = jest.spyOn(Math, 'random');
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('forbidden storage read'); });
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('forbidden storage write'); });
        const result = system.prepareHatchEventDraft(f.state.state, hatch);
        expect(result.state.stats.creaturesHatched).toBe(1);
        expect(result.events.some(event => event.kind === 'achievement')).toBe(false);
        expect(JSON.stringify(f.state.state)).toBe(stateBefore);
        expect(f.state.save).not.toHaveBeenCalled(); expect(f.events).toHaveLength(0);
        expect(random).not.toHaveBeenCalled();
        expect(sandbox.devLog).not.toHaveBeenCalled();
    });

    test('an unlock-calculation exception cannot leave partial live progress or pending claims', () => {
        const f = create();
        const definition = Object.values(f.system.definitions)[1];
        definition.getProgress = () => { throw Error('fictional calculation interruption'); };
        const beforeState = JSON.stringify(f.state.state), beforeProgress = progress(f.system);
        expect(() => f.system.prepareHatchEventDraft(f.state.state, hatch)).toThrow('fictional calculation interruption');
        expect(JSON.stringify(f.state.state)).toBe(beforeState); expect(progress(f.system)).toEqual(beforeProgress);
        expect(f.system.pendingClaims).toHaveLength(0); expect(f.events).toHaveLength(0);
        expect(f.state.save).not.toHaveBeenCalled();
    });

    test('returned state, claim metadata and notifications cannot mutate the live catalogue or a second draft', () => {
        const f = create();
        f.state.set('creature.genes', { id: 'fictional-owned-genes', species: 'nebulaSprite' });
        f.state.set('creature.parentIds', ['fictional-parent-a', 'fictional-parent-b']);
        const before = JSON.stringify(f.state.state), beforeProgress = progress(f.system);
        const first = f.system.prepareHatchEventDraft(f.state.state, hatch);
        const second = f.system.prepareHatchEventDraft(f.state.state, hatch);
        const retained = JSON.stringify(second);
        first.state.creature.genes.id = 'fictional-mutated-draft';
        first.state.creature.parentIds.push('fictional-extra-parent');
        const achievementId = Object.keys(first.achievements)[0];
        first.achievements[achievementId].claimed.BRONZE = { claimedAt: 77 };
        first.pendingClaims[0].tierInfo.name = 'fictional-mutated-tier';
        const event = first.events.find(item => item.kind === 'achievement');
        event.data.tierInfo.name = 'fictional-mutated-event';
        expect(JSON.stringify(second)).toBe(retained);
        expect(JSON.stringify(f.state.state)).toBe(before);
        expect(progress(f.system)).toEqual(beforeProgress);
        expect(f.system.tiers.BRONZE.name).toBe('Bronze');
    });

    test('unloaded achievement progress is refused without guessing a replacement progress record', () => {
        const f = create();
        const { system } = loadAchievementSystem(null, { noGlobalState: true });
        const before = JSON.stringify(f.state.state);
        expect(() => system.prepareHatchEventDraft(f.state.state, hatch)).toThrow('Achievement progress has not been loaded');
        expect(JSON.stringify(f.state.state)).toBe(before);
        expect(system.pendingClaims).toHaveLength(0);
        expect(f.events).toHaveLength(0); expect(f.state.save).not.toHaveBeenCalled();
    });

    test.each(['hatchId', 'species'])('a JSON-valued %s event cannot alias returned state back to caller data', field => {
        const f = create();
        f.state.set('creature.genes', { id: 'fictional-genetic-id', species: { label: 'fictional-species' } });
        f.events.length = 0;
        const input = f.state.state;
        const event = { hatchId: input.creature.identityArchive, rarity: 'rare', species: input.creature.genes.species };
        const before = JSON.stringify(input);
        const first = f.system.prepareHatchEventDraft(input, event);
        const second = f.system.prepareHatchEventDraft(input, event);
        const retained = JSON.stringify(second);
        if (field === 'hatchId') first.state.stats.recordedHatchIds.at(-1).creatureId = 'fictional-modified-return';
        else first.state.stats.speciesDiscovered.at(-1).label = 'fictional-modified-return';
        expect(JSON.stringify(input) === before).toBe(true);
        expect(JSON.stringify(second) === retained).toBe(true);
        expect(event.hatchId).toBe(input.creature.identityArchive);
        expect(event.species).toBe(input.creature.genes.species);
        expect(f.events).toHaveLength(0); expect(f.state.save).not.toHaveBeenCalled();
    });
});
