const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const Systems = require('phaser/src/scene/Systems');
const Clock = require('phaser/src/time/Clock');
const SceneStatus = require('phaser/src/scene/const');

function declaration(relativePath) {
    const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
    const body = parse(source, { sourceType: 'module' }).program.body;
    const node = body.map(statement => statement.declaration || statement)
        .find(statement => statement.type === 'ClassDeclaration');
    return { source, node, body };
}

const base = declaration('scenes/PlatformerLevelScene.js');
const methods = Object.fromEntries(['scheduleGuardianTransition', 'cancelGuardianTransition', 'cancelGuardianTransitions']
    .map(name => {
        const node = base.node.body.body.find(method => method.key?.name === name);
        return [name, new Function(`return ({${base.source.slice(node.start, node.end)}}).${name};`)()];
    }));
function load(relativePath) {
    const { source, node, body } = declaration(relativePath);
    const definitions = body.map(statement => statement.declaration || statement)
        .filter(statement => ['ClassDeclaration', 'FunctionDeclaration'].includes(statement.type))
        .map(statement => source.slice(statement.start, statement.end)).join('\n');
    return new Function(`${definitions}; return ${node.id.name};`)();
}
const PreparedFilm = load('systems/PreparedFilm.js');
const PreparedFilmPlayer = load('ui/PreparedFilmPlayer.js');

// Installed Phaser lifecycle and clock, without a Phaser Game, renderer or audio.
// The film has no asset and is never prepared or played; Continue uses the real DOM player.
const fixtures = [];
function fixture() {
    const scene = { ...methods, guardianTransitionGuards: new Map(), pauseMenuActive: false };
    scene.sys = new Systems(scene, { key: 'SyntheticGuardian' });
    scene.events = scene.sys.events = new EventEmitter();
    Object.assign(scene.sys.settings, { status: SceneStatus.RUNNING, active: true, visible: true });
    scene.time = new Clock(scene);
    scene.scene = { pause: () => scene.sys.pause(), resume: () => scene.sys.resume() };
    const clocks = [scene.time], emitters = [scene.events];
    const result = { scene,
        frame(delta = 16) {
            if (!scene.sys.isActive()) return;
            scene.time.preUpdate();
            scene.time.update(scene.time.now + delta, delta);
            scene.events.emit('postupdate', scene.time.now, delta);
        },
        replacementClock() { const clock = new Clock(scene); clocks.push(clock); return clock; },
        replacementEvents() { const events = new EventEmitter(); emitters.push(events); return events; },
        close() {
            scene.cancelGuardianTransitions();
            emitters.forEach(events => events.emit('shutdown'));
            clocks.forEach(clock => clock.destroy());
            emitters.forEach(events => events.removeAllListeners());
        }
    };
    fixtures.push(result);
    return result;
}

function expectNoListeners(events) {
    for (const event of ['resume', 'wake', 'postupdate', 'shutdown', 'destroy']) {
        expect(events.listenerCount(event)).toBe(0);
    }
}

describe('Guardian handoffs survive a temporary scene pause', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        fixtures.splice(0).forEach(value => value.close());
        document.body.replaceChildren();
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    test('control: the native scene clock settles once and cancels the wall fallback', () => {
        const f = fixture(), callback = jest.fn();
        f.scene.scheduleGuardianTransition('arrival', 1000, callback);
        f.frame(1000);
        jest.advanceTimersByTime(5000);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(f.scene.guardianTransitionGuards.size).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
        expectNoListeners(f.scene.events);
    });

    test('control: elapsed fallback settles once if the scene receives no frames', () => {
        const f = fixture(), callback = jest.fn();
        f.scene.scheduleGuardianTransition('arrival', 1000, callback);
        jest.advanceTimersByTime(1600);
        expect(callback).toHaveBeenCalledTimes(1);
        f.frame(5000);
        expect(callback).toHaveBeenCalledTimes(1);
        expectNoListeners(f.scene.events);
    });

    test.each([['pause', 'resume'], ['sleep', 'wake']])(
        'elapsed fallback waits through native %s and continues once on %s', (stop, resume) => {
            const f = fixture(), callback = jest.fn();
            const record = f.scene.scheduleGuardianTransition('arrival', 1000, callback);
            f.frame(200);
            f.scene.sys[stop]();
            jest.advanceTimersByTime(5000);
            expect(callback).not.toHaveBeenCalled();
            expect(record.settled).toBe(false);
            expect(f.scene.guardianTransitionGuards.get('arrival')).toBe(record);
            f.scene.sys[resume]();
            expect(callback).toHaveBeenCalledTimes(1);
            f.frame(5000);
            f.scene.events.emit('resume'); f.scene.events.emit('wake');
            expect(callback).toHaveBeenCalledTimes(1);
            expectNoListeners(f.scene.events);
        }
    );

    test('closing the real film Continue control resumes the pending Guardian handoff', () => {
        const f = fixture(), callback = jest.fn();
        f.scene.scheduleGuardianTransition('arrival', 1000, callback);
        const film = new PreparedFilm(null);
        const player = new PreparedFilmPlayer({ film, scene: f.scene, title: 'Synthetic scene' });
        expect(f.scene.sys.isPaused()).toBe(true);
        jest.advanceTimersByTime(5000);
        expect(callback).not.toHaveBeenCalled();
        player.closeButton.click();
        expect(player.closed).toBe(true);
        expect(film.state).toBe('disposed');
        expect(f.scene.sys.isActive()).toBe(true);
        expect(callback).toHaveBeenCalledTimes(1);
        expectNoListeners(f.scene.events);
    });

    test('a native scene timer cannot resume combat behind the physics-only pause menu', () => {
        const f = fixture(), callback = jest.fn();
        f.scene.scheduleGuardianTransition('arrival', 1000, callback);
        f.scene.pauseMenuActive = true;
        f.frame(1000);
        jest.advanceTimersByTime(5000);
        for (let frame = 0; frame < 20; frame++) f.frame();
        expect(callback).not.toHaveBeenCalled();
        expect(f.scene.events.listenerCount('postupdate')).toBe(1);
        f.scene.pauseMenuActive = false;
        f.frame();
        expect(callback).toHaveBeenCalledTimes(1);
        expectNoListeners(f.scene.events);
    });

    test('a paused clock retains the due handoff until simulation can continue', () => {
        const f = fixture(), callback = jest.fn();
        f.scene.scheduleGuardianTransition('arrival', 1000, callback);
        f.scene.time.paused = true;
        jest.advanceTimersByTime(5000); f.frame();
        expect(callback).not.toHaveBeenCalled();
        f.scene.time.paused = false;
        f.frame();
        expect(callback).toHaveBeenCalledTimes(1);
        expectNoListeners(f.scene.events);
    });

    test.each(['shutdown', 'destroy'])('%s retires a due paused handoff without a late callback', event => {
        const f = fixture(), callback = jest.fn(), events = f.scene.events;
        f.scene.scheduleGuardianTransition('arrival', 1000, callback);
        f.scene.sys.pause(); jest.advanceTimersByTime(5000);
        events.emit(event);
        expect(f.scene.guardianTransitionGuards.size).toBe(0);
        f.scene.sys.resume(); f.frame(5000);
        expect(callback).not.toHaveBeenCalled();
        expectNoListeners(events);
        expect(jest.getTimerCount()).toBe(0);
    });

    test('cancelling a waiting handoff removes every listener and does not cancel its successor', () => {
        const f = fixture(), old = jest.fn(), next = jest.fn();
        f.scene.scheduleGuardianTransition('arrival', 1000, old);
        f.scene.sys.pause(); jest.advanceTimersByTime(5000);
        expect(f.scene.cancelGuardianTransition('arrival')).toBe(true);
        expectNoListeners(f.scene.events);
        f.scene.scheduleGuardianTransition('arrival', 1000, next);
        f.scene.sys.resume();
        expect(next).not.toHaveBeenCalled();
        f.frame(1000);
        expect(next).toHaveBeenCalledTimes(1);
        expect(old).not.toHaveBeenCalled();
        expectNoListeners(f.scene.events);
    });

    test('cancelling all waiting handoffs releases the scene even without another frame', () => {
        const f = fixture(), callback = jest.fn();
        f.scene.scheduleGuardianTransition('arrival', 1000, callback);
        f.scene.scheduleGuardianTransition('pan', 1200, callback);
        f.scene.sys.pause(); jest.advanceTimersByTime(5000);
        f.scene.cancelGuardianTransitions();
        expectNoListeners(f.scene.events);
        expect(f.scene.guardianTransitionGuards.size).toBe(0);
        f.scene.sys.resume();
        expect(callback).not.toHaveBeenCalled();
    });

    test.each(['clock', 'systems', 'events', 'guard map'])(
        'a due old handoff cannot cross a replaced %s', replacement => {
            const f = fixture(), callback = jest.fn(), oldEvents = f.scene.events;
            const oldGuards = f.scene.guardianTransitionGuards;
            f.scene.scheduleGuardianTransition('arrival', 1000, callback);
            f.scene.sys.pause(); jest.advanceTimersByTime(5000);
            if (replacement === 'clock') f.scene.time = f.replacementClock();
            if (replacement === 'systems') {
                const systems = new Systems(f.scene, { key: 'SyntheticReplacement' });
                Object.assign(systems.settings, { status: SceneStatus.RUNNING, active: true });
                systems.events = oldEvents; f.scene.sys = systems;
            }
            if (replacement === 'events') f.scene.events = f.replacementEvents();
            if (replacement === 'guard map') f.scene.guardianTransitionGuards = new Map();
            f.scene.sys.resume(); oldEvents.emit('resume'); f.frame(5000);
            expect(callback).not.toHaveBeenCalled();
            expect(oldGuards.size).toBe(0);
            expectNoListeners(oldEvents);
        }
    );

    test('the callback can schedule a successor under the same key without old cleanup erasing it', () => {
        const f = fixture(), next = jest.fn();
        const first = jest.fn(() => f.scene.scheduleGuardianTransition('arrival', 500, next));
        f.scene.scheduleGuardianTransition('arrival', 1000, first);
        f.frame(1000);
        expect(first).toHaveBeenCalledTimes(1);
        expect(f.scene.guardianTransitionGuards.has('arrival')).toBe(true);
        f.frame(500);
        expect(next).toHaveBeenCalledTimes(1);
        expectNoListeners(f.scene.events);
    });

    test('a required callback error remains visible after its owned resources are released', () => {
        const f = fixture();
        f.scene.scheduleGuardianTransition('arrival', 1000, () => { throw Error('SYNTHETIC_HANDOFF_FAILURE'); });
        expect(() => f.frame(1000)).toThrow('SYNTHETIC_HANDOFF_FAILURE');
        expect(f.scene.guardianTransitionGuards.size).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
        expectNoListeners(f.scene.events);
    });
});
