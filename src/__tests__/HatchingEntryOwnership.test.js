const { readPinnedSource } = require('./support/pinnedSourceFixture.cjs');
const vm = require('node:vm');

const { parse } = require('@babel/parser');
const { fixture, attach, clone } = require('./support/hatchingStartFixture.cjs');
const priorSource = readPinnedSource('4c14dc81d0a739076e0bc57f2a638ccce8c07afe:src/scenes/HatchingScene.js');
const oldClass = parse(priorSource, { sourceType: 'module' }).program.body.find(item => item.type === 'ClassDeclaration');
const oldMethod = oldClass.body.body.find(item => item.key?.name === 'continueHatchEntry');

describe('hatch entry preserves normal routes and retires stale requests', () => {
    const fixtures = [];
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(1700000000777); localStorage.clear(); });
    afterEach(() => {
        for (const f of fixtures.splice(0)) f.close();
        jest.restoreAllMocks(); document.body.replaceChildren(); jest.useRealTimers();
        delete window.GameState; delete window.CloudSave; delete window.UXEnhancements;
    });
    function create(mode = 'home', initialState) {
        const f = fixture({ initialState, admissionGate: true, seed: state => {
            if (mode !== 'home') state.set('session.gameStarted', true);
            if (!['home', 'first-egg'].includes(mode)) {
                state.set('creature.hatched', true);
                state.set('creature.genes', { id: 'fictional-entry-creature' });
                if (mode !== 'unnamed') { state.set('creature.named', true); state.set('creature.name', 'Fictional Creature'); }
            }
            if (mode === 'living-form') state.set('tutorial.livingFormPending', true);
            if (mode === 'reservation') state.set('creature.hatchTransaction', { schemaVersion: 1,
                status: 'reserved', eggType: 'stellar', eggItemId: 'fictional-egg', inventorySlot: 0,
                reservedAt: 1700000000000, spawnPosition: { x: 0, y: 20 } });
        } });
        fixtures.push(f); attach(f.scene, 'continueHatchEntry');
        f.scene.isEggHatch = ['inventory', 'reservation'].includes(mode);
        f.scene.showHomeScreen = jest.fn(); f.scene.showHatchingScreen = jest.fn();
        return f;
    }
    const routes = f => ({ home: f.scene.showHomeScreen.mock.calls, egg: f.scene.showHatchingScreen.mock.calls,
        start: f.scene.scene.start.mock.calls });
    test.each(['home', 'first-egg', 'unnamed', 'named', 'living-form', 'inventory', 'reservation'])(
        '%s preserves the pinned payload, notifications, no-save behaviour and route arguments', mode => {
            const old = create(mode), initial = clone(old.state.state), notifications = [];
            for (const event of ['stateChanged', 'changed:session.currentScene']) old.state.on(event,
                data => notifications.push({ event, data: clone(data) }));
            const saved = jest.spyOn(old.state, 'save');
            vm.runInNewContext(`({${priorSource.slice(oldMethod.start, oldMethod.end)}}).continueHatchEntry`, {
                getGameState: () => window.GameState, console
            }).call(old.scene);
            const expected = { raw: old.snapshot().raw, memory: old.snapshot().memory,
                notifications: clone(notifications), routes: clone(routes(old)) };
            expect(saved).not.toHaveBeenCalled();
            old.close(); localStorage.clear();
            const current = create(mode, initial), events = [];
            for (const event of ['stateChanged', 'changed:session.currentScene']) current.state.on(event,
                data => events.push({ event, data: clone(data) }));
            const save = jest.spyOn(current.state, 'save'); current.scene.continueHatchEntry();
            expect({ raw: current.snapshot().raw, memory: current.snapshot().memory,
                notifications: events, routes: routes(current) }).toEqual(expected);
            expect(save).not.toHaveBeenCalled(); expect(current.state.getSaveAdmission().status).toBe('ready');
        });
    for (const event of ['stateChanged', 'changed:session.currentScene']) {
        test.each(['new-game', 'saved-progress', 'unsaved-progress', 'raw-successor', 'epoch', 'global-manager',
            'cloud-manager', 'scene', 'reservation', 'lease'])(
            `${event} callback changing %s cancels old routes and remaining notifications`, kind => {
                const f = create('named'), save = jest.spyOn(f.state, 'save');
                let successor, retiredEvents = 0;
                const off = f.state.on(event, () => {
                    off();
                    if (kind === 'reservation') f.state.set('creature.hatchTransaction', { status: 'reserved', eggItemId: 'fictional-new-egg' });
                    else if (kind === 'lease') f.state.cloudWriteLease = { isCurrentCampaign: () => true };
                    else f.replace(kind);
                    successor = f.snapshot();
                    f.state.on('changed:session.currentScene', () => { retiredEvents += 1; });
                });
                f.scene.continueHatchEntry();
                expect(successor).toBeDefined(); expect(routes(f)).toEqual({ home: [], egg: [], start: [] });
                expect(f.snapshot().raw).toBe(successor.raw); expect(f.snapshot().memory).toBe(successor.memory);
                if (kind === 'raw-successor') expect(f.state.getSaveAdmission()).toMatchObject({ status: 'held', reason: 'commit_failed' });
                else expect(f.state.getSaveAdmission()).toEqual(successor.admission);
                expect(retiredEvents).toBe(0);
                if (!['new-game', 'saved-progress', 'global-manager'].includes(kind)) expect(save).not.toHaveBeenCalled();
            });
    }
    test.each(['missing', 'shadowed-legacy'])(
        '%s remains paused with no reset, save, owner refresh, generation or route', kind => {
            const f = create('named');
            f.state.set('creature.genes', kind === 'shadowed-legacy' ? {} : null);
            f.state.set('creature.genetics', kind === 'shadowed-legacy' ? { id: 'fictional-retained-legacy' } : null);
            f.state.set('creatures', [{ id: 'fictional-retained-roster', genes: { id: 'fictional-roster-genes' } }]);
            localStorage.setItem(f.state.saveKey, JSON.stringify(f.state.createSaveSnapshot()));
            f.scene.captureHatchSaveOwner();
            const owner = f.scene.hatchSaveOwner, before = f.snapshot(), save = jest.spyOn(f.state, 'save');
            const capture = jest.spyOn(f.scene, 'captureHatchSaveOwner');
            f.scene.continueHatchEntry(); f.scene.continueHatchEntry();
            expect(f.snapshot().raw).toBe(before.raw); expect(f.snapshot().memory).toBe(before.memory);
            expect(f.scene.hatchSaveOwner).toBe(owner); expect(save).not.toHaveBeenCalled(); expect(capture).not.toHaveBeenCalled();
            expect(routes(f)).toEqual({ home: [], egg: [], start: [] });
            expect(f.state.getSaveAdmission()).toMatchObject({ status: 'held', reason: 'save_unreadable' });
        });
    test('a refused route retries only presentation and never writes or resets progress', () => {
        const f = create('named'), save = jest.spyOn(f.state, 'save'), before = f.snapshot().raw;
        f.scene.scene.start.mockImplementationOnce(() => { throw Error('Fictional route refusal'); });
        f.scene.continueHatchEntry();
        const retry = document.querySelector('[data-mythical-hatch-save] button'); expect(retry).not.toBeNull(); retry.click();
        expect(f.scene.scene.start).toHaveBeenCalledTimes(2); expect(save).not.toHaveBeenCalled();
        expect(f.snapshot().raw).toBe(before);
    });
    test('a throwing retired route cannot display old recovery over its successor', () => {
        const f = create('named'); let successor;
        f.scene.scene.start.mockImplementation(() => {
            f.replace('new-game'); successor = f.snapshot(); throw Error('Fictional retired route');
        });
        const recover = jest.spyOn(f.scene, 'showHatchSaveRecovery');
        f.scene.continueHatchEntry(); expect(successor).toBeDefined(); expect(f.snapshot()).toEqual(successor);
        expect(recover).not.toHaveBeenCalled();
    });
});
