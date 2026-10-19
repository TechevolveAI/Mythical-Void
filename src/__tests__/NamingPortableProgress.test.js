const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');

const vm = require('node:vm');
const { parse } = require('@babel/parser');
const { namingRosterFixture, clone } = require('./support/namingRosterFixture.cjs');
const before = readPinnedSource('f312ae46:src/systems/GameState.js');
const declaration = parse(before, { sourceType: 'script' }).program.body.find(node => node.type === 'ClassDeclaration');
const node = declaration.body.body.find(method => method.key?.name === 'addCreatureToCollection');
const loadOldAdd = () => vm.runInNewContext(`({${before.slice(node.start, node.end)}}).addCreatureToCollection`, { console, Date, Math });

describe('ordinary collection preserves existing non-family progress', () => {
    const owned = [];
    const create = (seed, options) => { const f = namingRosterFixture(seed, options); owned.push(f); return f; };
    const seed = state => {
        state.set('creature.bond.experience', 77);
        state.set('creature.powerHistory', [{ id: 'fictional-power-reveal' }]);
        state.set('creature.agencyHistory', [{ id: 'fictional-creature-help' }]);
    };
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(1700000000777);
        localStorage.clear(); document.body.replaceChildren();
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        for (const key of ['CloudSave', 'AchievementSystem', 'AudioManager', 'BirthEventSystem']) delete window[key];
    });
    afterEach(() => {
        owned.splice(0).forEach(f => f.close()); jest.restoreAllMocks();
        jest.clearAllTimers(); jest.useRealTimers();
        for (const key of ['GameState', 'CloudSave', 'AchievementSystem', 'AudioManager', 'BirthEventSystem']) delete window[key];
        document.body.replaceChildren();
    });

    test.each(['bond', 'powerHistory', 'agencyHistory'])('actual hatch-to-naming save retains existing %s in both selected slots', field => {
        const f = create(seed), value = clone(f.state.get(`creature.${field}`));
        f.scene.finalizeName();
        const saved = JSON.parse(f.raw());
        expect(saved.creature[field]).toEqual(value);
        expect(saved.creatures[0][field]).toEqual(value);
        expect(saved.creature.genes).toEqual(f.genes); expect(saved.creature.dna).toEqual(f.dna);
    });

    test('new progress values are owned copies rather than aliases to the former active slot', () => {
        const f = create(seed), previous = f.state.get('creature');
        const result = f.state.addCreatureToCollection();
        expect(result.success).toBe(true);
        previous.bond.experience = 1;
        previous.powerHistory.push({ id: 'fictional-later-power' });
        previous.agencyHistory.length = 0;
        expect(result.creature.bond.experience).toBe(77);
        expect(result.creature.powerHistory).toHaveLength(1);
        expect(result.creature.agencyHistory).toHaveLength(1);
        expect(f.state.get('creature.bond.experience')).toBe(77);
    });

    test('legacy absence does not add invented progress values to the collection record', () => {
        const f = create();
        for (const field of ['bond', 'powerHistory', 'agencyHistory']) delete f.state.state.creature[field];
        const result = f.state.addCreatureToCollection();
        expect(result.success).toBe(true);
        for (const field of ['bond', 'powerHistory', 'agencyHistory']) expect(Object.hasOwn(result.creature, field)).toBe(false);
    });

    test.each(['bond', 'powerHistory', 'agencyHistory'])('an existing null %s value is retained without invented defaults', field => {
        const f = create(state => state.set(`creature.${field}`, null));
        const result = f.state.addCreatureToCollection();
        expect(result.success).toBe(true);
        expect(Object.hasOwn(result.creature, field)).toBe(true);
        expect(result.creature[field]).toBeNull();
        expect(f.state.get(`creature.${field}`)).toBeNull();
    });

    test.each([false, true])('inventory=%s naming, save and reconstruction retain progress without overwriting another creature', inventory => {
        const f = create(seed, { inventory });
        const previous = clone(f.state.get('creatures'));
        const values = Object.fromEntries(['bond', 'powerHistory', 'agencyHistory']
            .map(field => [field, clone(f.state.get(`creature.${field}`))]));
        f.scene.finalizeName();
        const restored = new f.state.constructor(); f.states.push(restored);
        window.GameState = restored;
        expect(restored.load()).toBe(true);
        const activeIndex = restored.get('activeCreatureIndex');
        expect(activeIndex).toBe(inventory ? 1 : 0);
        for (const [field, value] of Object.entries(values)) {
            expect(restored.get(`creature.${field}`)).toEqual(value);
            expect(restored.get('creatures')[activeIndex][field]).toEqual(value);
        }
        expect(restored.get('creature.genes')).toEqual(f.genes);
        expect(restored.get('creature.dna')).toEqual(f.dna);
        expect(restored.get('creature.experience')).toBe(50);
        expect(restored.get('creature.lifecycle.stage')).toBe('baby');
        expect(restored.get('creatures').slice(0, previous.length)).toEqual(previous);
    });

    test('explicit supplied records never inherit progress from a different active creature', () => {
        const f = create(seed);
        const supplied = { id: 'fictional-supplied-creature', name: 'Fictional supplied creature',
            genes: { id: 'fictional-supplied-genes' }, lifecycle: { stage: 'baby' },
            parentIds: ['fictional-existing-parent-a', 'fictional-existing-parent-b'], generation: 3 };
        const suppliedBefore = JSON.stringify(supplied);
        const result = f.state.addCreatureToCollection(supplied);
        expect(result.success).toBe(true); expect(result.creature).toBe(supplied);
        expect(JSON.stringify(supplied)).toBe(suppliedBefore);
        for (const field of ['bond', 'powerHistory', 'agencyHistory']) expect(Object.hasOwn(supplied, field)).toBe(false);
    });

    test.each(['full', 'duplicate'])('%s result retains its original refusal and does not clone or alter progress', mode => {
        const f = create(seed);
        const existing = { id: 'fictional-existing-record', name: 'Fictional earlier creature',
            genes: mode === 'duplicate' ? clone(f.genes) : { id: 'fictional-other-genes' } };
        f.state.set('creatures', [existing]);
        if (mode === 'full') f.state.set('maxCreatures', 1);
        const beforeState = JSON.stringify(f.state.state);
        const copy = jest.spyOn(f.state, 'clonePortableValue');
        const result = f.state.addCreatureToCollection();
        expect(result).toMatchObject({ success: false, reason: mode });
        expect(Boolean(result)).toBe(true);
        expect(JSON.stringify(f.state.state)).toBe(beforeState);
        expect(copy).not.toHaveBeenCalled();
    });

    test.each(['added', 'full', 'duplicate', 'supplied'])('%s allocation, clock, events and projected state retain the parent contract', mode => {
        const execute = old => {
            const f = create(seed);
            if (mode === 'full' || mode === 'duplicate') {
                f.state.set('creatures', [{ id: 'fictional-existing-parity-record', name: 'Fictional prior creature',
                    genes: mode === 'duplicate' ? clone(f.genes) : { id: 'fictional-other-parity-genes' } }]);
                if (mode === 'full') f.state.set('maxCreatures', 1);
            }
            const supplied = mode === 'supplied'
                ? { id: 'fictional-supplied-parity-record', name: 'Fictional supplied creature',
                    genes: { id: 'fictional-supplied-parity-genes' }, generation: 3,
                    parentIds: ['fictional-parent-a', 'fictional-parent-b'] }
                : undefined;
            const events = [], emit = f.state.emit.bind(f.state);
            f.state.emit = (event, data) => { events.push({ event, data }); emit(event, data); };
            const trace = [];
            const random = jest.spyOn(Math, 'random').mockImplementation(() => { trace.push('random'); return 0.375; });
            const clock = jest.spyOn(Date, 'now').mockImplementation(() => { trace.push('clock'); return 1700000000777; });
            const result = old ? loadOldAdd().call(f.state, supplied) : f.state.addCreatureToCollection(supplied);
            const counts = { random: random.mock.calls.length, clock: clock.mock.calls.length };
            random.mockRestore(); clock.mockRestore();
            return { state: clone(f.state.state), result: clone(result), events: clone(events), counts, trace };
        };
        const old = execute(true), current = execute(false);
        const strip = value => {
            const result = clone(value);
            const record = item => {
                if (!item || typeof item !== 'object') return;
                for (const field of ['bond', 'powerHistory', 'agencyHistory', 'care', 'mood', 'traits', 'colors']) delete item[field];
            };
            const records = items => { if (Array.isArray(items)) items.forEach(record); };
            record(result.state.creature); records(result.state.creatures); record(result.result.creature);
            for (const item of result.events) {
                record(item.data?.creature); record(item.data?.previousCreature); record(item.data?.newCreature);
                if (item.event === 'stateChanged' && item.data.path === 'creature') {
                    record(item.data.oldValue); record(item.data.newValue);
                }
                if (item.event === 'stateChanged' && item.data.path === 'creatures') {
                    records(item.data.oldValue); records(item.data.newValue);
                }
                if (item.event === 'changed:creature') record(item.data);
                if (item.event === 'changed:creatures') records(item.data);
            }
            return result;
        };
        expect(current.counts).toEqual(old.counts);
        expect(current.result.creature?.id).toBe(old.result.creature?.id);
        if (mode === 'added') expect(strip(current)).toEqual(strip(old));
        else expect(current).toEqual(old);
    });
});
