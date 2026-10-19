const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const { namingRosterFixture, clone } = require('./support/namingRosterFixture.cjs');

const vm = require('node:vm');
const { parse } = require('@babel/parser');
const before = readPinnedSource('6c1ff0ce:src/systems/GameState.js');
const declaration = parse(before, { sourceType: 'script' }).program.body.find(node => node.type === 'ClassDeclaration');
const method = declaration.body.body.find(node => node.key?.name === 'addCreatureToCollection');
const loadBefore = () => vm.runInNewContext(`({${before.slice(method.start, method.end)}}).addCreatureToCollection`,
    { console, Date, Math });
const fields = ['care', 'mood', 'traits', 'colors'];
const values = {
    care: { lastCareTime: 1700000000001, lastOfflineRecoveryTime: 1700000000017, careStreak: 7,
        careHistory: [{ action: 'feed', timestamp: 1700000000001, happinessBefore: 70, happinessAfter: 85 }],
        dailyCare: { feedCount: 2, playCount: 1, petCount: 0, restCount: 0, lastReset: null } },
    mood: { current: 'neutral', lastMoodChange: 1700000000017,
        moodHistory: [{ mood: 'happy', at: 1700000000001 }] },
    traits: [{ id: 'fictional-earned-trait', revealed: true }],
    colors: { body: 0x365b79, head: 0x97d45b, wings: 0x583a95 }
};
const seed = state => { for (const field of fields) state.set(`creature.${field}`, clone(values[field])); };

describe('ordinary naming retains existing non-family care and appearance data', () => {
    let f;
    beforeEach(() => {
        jest.useFakeTimers(); jest.setSystemTime(1700000000777);
        localStorage.clear(); document.body.replaceChildren();
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
        for (const key of ['CloudSave', 'AchievementSystem', 'AudioManager', 'BirthEventSystem']) delete window[key];
    });
    afterEach(() => {
        f?.close(); jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers();
        for (const key of ['GameState', 'CloudSave', 'AchievementSystem', 'AudioManager', 'BirthEventSystem']) delete window[key];
        document.body.replaceChildren();
    });

    test('control: the real hatch initialises positive care and mood timestamps before naming', () => {
        f = namingRosterFixture();
        expect(f.state.get('creature.care')).toMatchObject({
            lastCareTime: 1700000000777, lastOfflineRecoveryTime: 1700000000777, careStreak: 1
        });
        expect(f.state.get('creature.mood.lastMoodChange')).toBe(1700000000777);
    });

    test.each(['care', 'mood'])('actual generated hatch %s survives ordinary naming in both selected slots', field => {
        f = namingRosterFixture();
        const before = clone(f.state.get(`creature.${field}`));
        f.scene.finalizeName();
        const saved = JSON.parse(f.raw());
        expect(saved.creature[field]).toEqual(before);
        expect(saved.creatures[0][field]).toEqual(before);
        expect(saved.creature.genes).toEqual(f.genes); expect(saved.creature.dna).toEqual(f.dna);
    });

    test.each([
        ['traits', [{ id: 'fictional-earned-trait', revealed: true }]],
        ['colors', { body: 0x365b79, head: 0x97d45b, wings: 0x583a95 }]
    ])('existing admitted %s is not replaced by the collection constructor defaults', (field, value) => {
        f = namingRosterFixture(state => state.set(`creature.${field}`, clone(value)));
        expect(f.state.prepareSaveCandidate(f.raw()).state.creature[field]).toEqual(value);
        f.scene.finalizeName();
        const saved = JSON.parse(f.raw());
        expect(saved.creature[field]).toEqual(value);
        expect(saved.creatures[0][field]).toEqual(value);
    });

    test.each([false, true])('inventory=%s saves and reloads exact care, mood and appearance without altering a prior creature', inventory => {
        f = namingRosterFixture(seed, { inventory });
        const previous = clone(f.state.get('creatures'));
        f.scene.finalizeName();
        const restored = new f.state.constructor(); f.states.push(restored); window.GameState = restored;
        expect(restored.load()).toBe(true);
        const index = restored.get('activeCreatureIndex'); expect(index).toBe(inventory ? 1 : 0);
        for (const field of fields) {
            expect(restored.get(`creature.${field}`)).toEqual(values[field]);
            expect(restored.get('creatures')[index][field]).toEqual(values[field]);
        }
        expect(restored.get('creatures').slice(0, previous.length)).toEqual(previous);
        expect(restored.get('creature.genes')).toEqual(f.genes); expect(restored.get('creature.dna')).toEqual(f.dna);
        expect(restored.get('creature.experience')).toBe(50); expect(restored.get('creature.lifecycle.stage')).toBe('baby');
    });

    test.each(fields)('%s is detached from the former active record and caller data', field => {
        f = namingRosterFixture(seed);
        const prior = f.state.get('creature'), input = prior[field];
        const result = f.state.addCreatureToCollection();
        expect(result.success).toBe(true); expect(result.creature[field]).toEqual(values[field]);
        expect(result.creature[field]).not.toBe(input);
        if (Array.isArray(input)) input.push({ id: 'fictional-later-trait' });
        else input.fictionalLaterValue = 77;
        expect(result.creature[field]).toEqual(values[field]);
        expect(f.state.get(`creature.${field}`)).toEqual(values[field]);
    });

    test.each(fields)('existing null %s remains null in the ordinary record without invented defaults', field => {
        f = namingRosterFixture(state => state.set(`creature.${field}`, null));
        const result = f.state.addCreatureToCollection();
        expect(result.success).toBe(true); expect(Object.hasOwn(result.creature, field)).toBe(true);
        expect(result.creature[field]).toBeNull();
    });

    test('absent values stay absent in the ordinary record', () => {
        f = namingRosterFixture();
        for (const field of fields) delete f.state.state.creature[field];
        const result = f.state.addCreatureToCollection();
        expect(result.success).toBe(true);
        for (const field of fields) expect(Object.hasOwn(result.creature, field)).toBe(false);
    });

    test.each(['care', 'mood'])('a null %s capsule is retained as data, not claimed to be safe for naming consumers', field => {
        f = namingRosterFixture(state => state.set(`creature.${field}`, null));
        const memory = JSON.stringify(f.state.state), raw = f.raw();
        const add = jest.spyOn(f.state, 'addCreatureToCollection'), random = jest.spyOn(Math, 'random');
        f.scene.finalizeName();
        expect(add).not.toHaveBeenCalled(); expect(random).not.toHaveBeenCalled();
        expect(f.state.getSaveAdmission()).toMatchObject({ status: 'held', reason: 'save_unreadable' });
        expect(JSON.stringify(f.state.state)).toBe(memory); expect(f.raw()).toBe(raw);
        expect(f.scene.canProceed).toBe(true); expect(f.scene.inputActive).toBe(true);
        expect(f.input.isConnected).toBe(true); expect(f.button.isConnected).toBe(true);
        expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
        if (field === 'care') expect(() => f.state.updateHappinessFromTime()).toThrow();
    });

    test.each(['care', 'mood'])('an absent %s stays protected before existing consumers rather than inventing data', field => {
        f = namingRosterFixture(); delete f.state.state.creature[field];
        const memory = JSON.stringify(f.state.state), raw = f.raw();
        f.scene.finalizeName();
        expect(f.state.getSaveAdmission().status).toBe('held');
        expect(JSON.stringify(f.state.state)).toBe(memory); expect(f.raw()).toBe(raw);
        expect(f.scene.canProceed).toBe(true); expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
        if (field === 'care') expect(() => f.state.initializeCareSystem()).toThrow();
    });

    test.each([['care', []], ['care', 'fictional legacy care'], ['mood', []], ['mood', 'fictional legacy mood']])(
        'an unsupported %s capsule shape stays intact before collection allocation', (field, value) => {
            f = namingRosterFixture(state => state.set(`creature.${field}`, clone(value)));
            const memory = JSON.stringify(f.state.state), raw = f.raw();
            const add = jest.spyOn(f.state, 'addCreatureToCollection');
            f.scene.finalizeName();
            expect(add).not.toHaveBeenCalled(); expect(f.state.getSaveAdmission().status).toBe('held');
            expect(JSON.stringify(f.state.state)).toBe(memory); expect(f.raw()).toBe(raw);
            expect(f.scene.canProceed).toBe(true); expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
        }
    );

    test('a protection callback cannot lock or continue naming against a replacement manager', () => {
        f = namingRosterFixture(state => state.set('creature.care', null));
        let next, nextRaw, nextState;
        const off = f.state.on('saveAdmissionChanged', admission => {
            if (admission.status !== 'held') return;
            off(); next = f.replaceManager(); next.set('player.cosmicCoins', 77); expect(next.save()).toBe(true);
            nextRaw = f.raw(); nextState = JSON.stringify(next.state);
        });
        f.scene.finalizeName();
        expect(next).toBeDefined(); expect(window.GameState).toBe(next);
        expect(next.getSaveAdmission().status).toBe('ready'); expect(JSON.stringify(next.state)).toBe(nextState);
        expect(f.raw()).toBe(nextRaw); expect(f.scene.showLivingPortraitHandoff).not.toHaveBeenCalled();
        expect(f.scene.canProceed).toBe(true);
    });

    test('the actual care consumer retains the existing daily feed allowance after naming', () => {
        f = namingRosterFixture(state => {
            seed(state); state.set('creature.care.dailyCare.lastReset', Date.now());
            state.set('creature.stats.happiness', 40);
        });
        f.scene.finalizeName();
        const priorHistory = clone(f.state.get('creature.care.careHistory'));
        expect(f.state.get('creature.care.dailyCare.feedCount')).toBe(2);
        expect(f.state.performCareAction('feed')).toBe(true);
        expect(f.state.get('creature.care.dailyCare.feedCount')).toBe(3);
        expect(f.state.get('creature.stats.happiness')).toBe(55);
        expect(f.state.get('creature.care.careHistory').slice(0, priorHistory.length)).toEqual(priorHistory);
        const once = JSON.stringify(f.state.state);
        expect(f.state.performCareAction('feed')).toBe(false); expect(JSON.stringify(f.state.state)).toBe(once);
    });

    test('ordinary care timestamps retain the actual recovery baseline without a second award at the same time', () => {
        const now = 1700000000777;
        f = namingRosterFixture(state => {
            seed(state);
            state.set('creature.care.lastCareTime', now);
            state.set('creature.care.lastOfflineRecoveryTime', now);
            state.set('creature.stats.energy', 20); state.set('creature.stats.happiness', 40);
        });
        f.scene.finalizeName();
        const before = clone(f.state.get('creature.care'));
        expect(before.lastCareTime).toBe(now); expect(before.lastOfflineRecoveryTime).toBe(now);
        f.state.initializeCareSystem(); expect(f.state.get('creature.care')).toEqual(before);
        const recovered = jest.fn(); f.state.on('creatureOfflineRecoveryApplied', recovered);
        jest.setSystemTime(now + 4 * 60 * 60 * 1000);
        f.state.updateHappinessFromTime();
        expect(f.state.get('creature.stats')).toMatchObject({ energy: 44, happiness: 41 });
        expect(f.state.get('creature.care')).toEqual({ ...before, lastOfflineRecoveryTime: Date.now() });
        const once = JSON.stringify(f.state.state); f.state.updateHappinessFromTime();
        expect(JSON.stringify(f.state.state)).toBe(once); expect(recovered).toHaveBeenCalledTimes(1);
        expect(f.state.save()).toBe(true);
        const restored = new f.state.constructor(); f.states.push(restored); window.GameState = restored;
        expect(restored.load()).toBe(true);
        const restoredBefore = JSON.stringify(restored.state); restored.updateHappinessFromTime();
        expect(JSON.stringify(restored.state)).toBe(restoredBefore);
    });

    test('supplied creature data never inherits care or appearance from another active creature', () => {
        f = namingRosterFixture(seed);
        const supplied = { id: 'fictional-supplied-child', name: 'Fictional supplied child',
            genes: { id: 'fictional-supplied-child-genes' }, lifecycle: { stage: 'baby' },
            parentIds: ['fictional-parent-a', 'fictional-parent-b'], generation: 3 };
        const initial = JSON.stringify(supplied), result = f.state.addCreatureToCollection(supplied);
        expect(result.success).toBe(true); expect(result.creature).toBe(supplied);
        expect(JSON.stringify(supplied)).toBe(initial);
        for (const field of fields) expect(Object.hasOwn(supplied, field)).toBe(false);
    });

    test.each(['full', 'duplicate'])('%s refuses before copying and retains all original data', mode => {
        f = namingRosterFixture(seed);
        f.state.set('creatures', [{ id: 'fictional-prior-record',
            genes: mode === 'duplicate' ? clone(f.genes) : { id: 'fictional-other-genes' } }]);
        if (mode === 'full') f.state.set('maxCreatures', 1);
        const initial = JSON.stringify(f.state.state), copy = jest.spyOn(f.state, 'clonePortableValue');
        expect(f.state.addCreatureToCollection()).toMatchObject({ success: false, reason: mode });
        expect(copy).not.toHaveBeenCalled(); expect(JSON.stringify(f.state.state)).toBe(initial);
    });

    test.each(['added', 'full', 'duplicate', 'supplied'])(
        '%s retains parent allocation, clock/RNG order, events and all unaffected projected fields', mode => {
            const execute = old => {
                f?.close(); localStorage.clear(); f = namingRosterFixture(seed);
                if (mode === 'full' || mode === 'duplicate') {
                    f.state.set('creatures', [{ id: 'fictional-comparison-prior',
                        genes: mode === 'duplicate' ? clone(f.genes) : { id: 'fictional-comparison-other-genes' } }]);
                    if (mode === 'full') f.state.set('maxCreatures', 1);
                }
                const supplied = mode === 'supplied' ? { id: 'fictional-comparison-supplied',
                    name: 'Fictional supplied child', genes: { id: 'fictional-comparison-supplied-genes' } } : undefined;
                const events = [], emit = f.state.emit.bind(f.state), trace = [];
                f.state.emit = (event, data) => { events.push({ event, data }); return emit(event, data); };
                const clock = jest.spyOn(Date, 'now').mockImplementation(() => { trace.push('clock'); return 1700000000777; });
                const random = jest.spyOn(Math, 'random').mockImplementation(() => { trace.push('random'); return 0.375; });
                const result = (old ? loadBefore() : f.state.addCreatureToCollection).call(f.state, supplied);
                const record = { state: clone(f.state.state), result: clone(result), events: clone(events), trace };
                clock.mockRestore(); random.mockRestore(); return record;
            };
            const old = execute(true), current = execute(false);
            if (mode !== 'added') { expect(current).toEqual(old); return; }
            for (const field of fields) {
                expect(current.state.creature[field]).toEqual(values[field]);
                expect(current.result.creature[field]).toEqual(values[field]);
            }
            const normalise = record => {
                const output = clone(record);
                const strip = creature => { if (creature) for (const field of fields) delete creature[field]; };
                const stripMany = creatures => { if (Array.isArray(creatures)) creatures.forEach(strip); };
                strip(output.state.creature); stripMany(output.state.creatures); strip(output.result.creature);
                for (const { event, data } of output.events) {
                    strip(data?.creature); strip(data?.previousCreature); strip(data?.newCreature);
                    if (event === 'stateChanged' && data.path === 'creature') { strip(data.oldValue); strip(data.newValue); }
                    if (event === 'stateChanged' && data.path === 'creatures') { stripMany(data.oldValue); stripMany(data.newValue); }
                    if (event === 'changed:creature') strip(data);
                    if (event === 'changed:creatures') stripMany(data);
                }
                return output;
            };
            expect(normalise(current)).toEqual(normalise(old));
        }
    );
});
