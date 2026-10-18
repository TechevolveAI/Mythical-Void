/** @jest-environment node */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const evolutionConfig = require('../config/evolution.json');

function fixture() {
    const events = new EventEmitter();
    let creature = { id: 'synthetic-creature-a', lifecycle: { stage: 'adult' } };
    let story = {};
    const gameState = {
        get: key => key === 'creature' ? creature : key === 'creature.id' ? creature.id :
            key === 'story' ? story : undefined,
        on: (name, callback) => { events.on(name, callback); return () => events.off(name, callback); },
        off: (name, callback) => events.off(name, callback),
        emit: (name, payload) => events.emit(name, payload),
        set: jest.fn(), save: jest.fn()
    };
    const audio = {
        playButtonClick: jest.fn(), playEvolutionSmall: jest.fn(),
        playEvolutionMajor: jest.fn(), playEvolutionElder: jest.fn(), playLevelUp: jest.fn()
    };
    const sceneWindow = { GameState: gameState, AudioManager: audio };
    const filename = path.join(__dirname, '../systems/EvolutionCelebration.js');
    const source = fs.readFileSync(filename, 'utf8').replace(/^import .*;$/gm, '')
        .replace(/^export .*;$/gm, '') + '\n;EvolutionCelebrationManager;';
    const Manager = vm.runInNewContext(source, {
        evolutionConfig, window: sceneWindow,
        Phaser: { Display: { Color: { HexStringToColor: () => ({ color: 0xffffff }) } } },
        console: { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
    }, { filename });
    const timers = [], tweens = [], elements = [];
    function element(kind, value) {
        const result = new EventEmitter();
        result.kind = kind; result.text = value; result.active = true;
        const methods = ['setScrollFactor', 'setDepth', 'clear', 'lineStyle', 'strokeCircle',
            'fillStyle', 'fillRect', 'setAlpha', 'fillCircle', 'setPosition', 'beginPath',
            'moveTo', 'lineTo', 'closePath', 'fillPath', 'fillRoundedRect', 'strokeRoundedRect',
            'setOrigin', 'setInteractive'];
        methods.forEach(method => { result[method] = jest.fn(() => {
            if (!result.active) throw new Error(`Drawing on destroyed ${kind}`);
            return result;
        }); });
        result.destroy = jest.fn(() => { result.active = false; result.removeAllListeners(); });
        elements.push(result);
        return result;
    }
    const scene = {
        events: new EventEmitter(), scale: { width: 390, height: 844 },
        add: {
            graphics: jest.fn(() => element('graphics')),
            text: jest.fn((x, y, value) => element('text', value)),
            zone: jest.fn(() => element('zone'))
        },
        time: { delayedCall: jest.fn((delay, callback) => {
            const timer = { callback, removed: false, fired: false };
            timer.handle = setTimeout(() => { timer.fired = true; callback(); }, delay);
            timer.remove = jest.fn(() => { timer.removed = true; clearTimeout(timer.handle); });
            timers.push(timer);
            return timer;
        }) },
        tweens: { add: jest.fn(config => {
            const tween = { config, remove: jest.fn() };
            tweens.push(tween);
            return tween;
        }) },
        cameras: { main: { shake: jest.fn() } }
    };
    return {
        manager: new Manager(), scene, gameState, sceneWindow, events, timers, tweens, elements, audio,
        switchCreature() { creature = { id: 'synthetic-creature-b', lifecycle: { stage: 'baby' } }; events.emit('creatureSwitched'); },
        replaceStory() { story = {}; },
        stopClock() { timers.forEach(timer => timer.remove()); }
    };
}

async function flush() {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
}

describe('evolution celebration ownership', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

    test('scene shutdown settles the celebration even when Phaser removes its timers', async () => {
        const f = fixture();
        let settled = false;
        f.manager.playCelebration(f.scene, 'juvenile', 'adult', {}).then(() => { settled = true; });
        f.scene.events.emit('shutdown');
        f.stopClock();
        await flush();
        expect(settled).toBe(true);
        expect(f.manager.isCelebrating()).toBe(false);
        expect(f.elements.every(element => !element.active)).toBe(true);
        expect(f.audio.playEvolutionMajor).not.toHaveBeenCalled();
    });

    test('force stop settles the old run and cancels its callbacks', async () => {
        const f = fixture();
        let settled = false;
        f.manager.playCelebration(f.scene, 'juvenile', 'adult', {}).then(() => { settled = true; });
        const oldTimer = f.timers[0];
        f.manager.forceStop();
        await flush();
        expect(settled).toBe(true);
        expect(oldTimer.remove).toHaveBeenCalled();
        expect(() => oldTimer.callback()).not.toThrow();
        expect(f.manager.isCelebrating()).toBe(false);
    });

    test.each(['creatureSwitched', 'reset', 'loaded'])('%s cancels a reveal belonging to the previous creature or save', async event => {
        const f = fixture();
        let settled = false;
        f.manager.playCelebration(f.scene, 'juvenile', 'adult', {}).then(() => { settled = true; });
        f.gameState.emit(event);
        await flush();
        expect(settled).toBe(true);
        expect(f.manager.isCelebrating()).toBe(false);
        expect(f.gameState.set).not.toHaveBeenCalled();
        expect(f.gameState.save).not.toHaveBeenCalled();
    });

    test.each([0, 2100, 2300, 4500])('shutdown at %i ms cancels every phase and rejects stale callbacks', async elapsed => {
        const f = fixture();
        let settled = false;
        f.manager.playCelebration(f.scene, 'juvenile', 'adult', {}).then(() => { settled = true; });
        await jest.advanceTimersByTimeAsync(elapsed);
        const oldTimers = [...f.timers];
        const oldTweens = [...f.tweens];
        const created = f.elements.length;
        const sounds = Object.values(f.audio).reduce((count, spy) => count + spy.mock.calls.length, 0);
        f.scene.events.emit('shutdown');
        await flush();
        expect(settled).toBe(true);
        expect(f.manager.isCelebrating()).toBe(false);
        expect(f.elements.every(element => !element.active)).toBe(true);
        oldTimers.filter(timer => !timer.fired).forEach(timer => expect(timer.remove).toHaveBeenCalled());
        oldTweens.forEach(tween => expect(tween.remove).toHaveBeenCalled());
        oldTimers.forEach(timer => expect(() => timer.callback()).not.toThrow());
        oldTweens.forEach(tween => expect(() => tween.config.onComplete?.()).not.toThrow());
        await jest.advanceTimersByTimeAsync(20000);
        expect(f.elements).toHaveLength(created);
        expect(Object.values(f.audio).reduce((count, spy) => count + spy.mock.calls.length, 0)).toBe(sounds);
        expect(f.scene.events.eventNames()).toEqual([]);
        expect(f.events.eventNames()).toEqual([]);
    });

    test.each(['pause', 'sleep', 'destroy'])('%s leaves no pending celebration', async event => {
        const f = fixture();
        const playing = f.manager.playCelebration(f.scene, 'juvenile', 'adult', {});
        f.scene.events.emit(event);
        await flush();
        expect(f.manager.isCelebrating()).toBe(false);
        expect(f.timers.every(timer => timer.removed || timer.fired)).toBe(true);
        await playing;
    });

    test('old finally and callbacks cannot clean up an immediate replacement reveal', async () => {
        const f = fixture();
        const first = f.manager.playCelebration(f.scene, 'juvenile', 'adult', {});
        await jest.advanceTimersByTimeAsync(4500);
        const oldTimers = [...f.timers];
        const oldTweens = [...f.tweens];
        const oldElements = [...f.elements];
        const oldButtonHandler = oldElements.find(element => element.kind === 'zone').listeners('pointerdown')[0];
        f.manager.forceStop();
        const second = f.manager.playCelebration(f.scene, 'adult', 'elder', {});
        const replacement = f.manager.currentRun;
        await first;
        oldTimers.forEach(timer => timer.callback());
        oldTweens.forEach(tween => tween.config.onComplete?.());
        oldButtonHandler();
        await flush();
        expect(f.manager.currentRun).toBe(replacement);
        expect(f.manager.isCelebrating()).toBe(true);
        expect(f.elements.filter(element => !oldElements.includes(element)).every(element => element.active)).toBe(true);
        f.manager.forceStop();
        await second;
        expect(f.manager.isCelebrating()).toBe(false);
    });

    test.each([
        ['baby', 'juvenile', 'playEvolutionSmall'],
        ['juvenile', 'adult', 'playEvolutionMajor'],
        ['adult', 'elder', 'playEvolutionElder']
    ])('normal %s to %s completes on Continue with one fanfare', async (from, to, fanfare) => {
        const f = fixture();
        const playing = f.manager.playCelebration(f.scene, from, to, {});
        await jest.advanceTimersByTimeAsync(4700);
        const button = f.elements.find(element => element.kind === 'zone' && element.active);
        expect(button).toBeDefined();
        button.emit('pointerdown');
        await playing;
        expect(f.manager.isCelebrating()).toBe(false);
        expect(f.audio[fanfare]).toHaveBeenCalledTimes(1);
        expect(f.elements.every(element => !element.active)).toBe(true);
        expect(f.events.eventNames()).toEqual([]);
        expect(f.scene.events.eventNames()).toEqual([]);
        expect(f.gameState.set).not.toHaveBeenCalled();
        expect(f.gameState.save).not.toHaveBeenCalled();
    });

    test('normal auto-dismiss also releases all owned resources', async () => {
        const f = fixture();
        let settled = false;
        f.manager.playCelebration(f.scene, 'juvenile', 'adult', {}).then(() => { settled = true; });
        await jest.advanceTimersByTimeAsync(15000);
        expect(settled).toBe(true);
        expect(f.manager.currentScene).toBeNull();
        expect(f.manager.celebrationElements).toEqual([]);
        expect(f.events.eventNames()).toEqual([]);
        expect(f.scene.events.eventNames()).toEqual([]);
    });

    test('cancellation leaves unrelated scene timers and tweens alone', async () => {
        const f = fixture();
        const unrelatedTimer = f.scene.time.delayedCall(50000, jest.fn());
        const unrelatedTween = f.scene.tweens.add({ targets: {} });
        const playing = f.manager.playCelebration(f.scene, 'juvenile', 'adult', {});
        await jest.advanceTimersByTimeAsync(2300);
        f.manager.forceStop();
        await playing;
        expect(unrelatedTimer.remove).not.toHaveBeenCalled();
        expect(unrelatedTween.remove).not.toHaveBeenCalled();
    });

    test('save replacement without an event is rejected at the next callback', async () => {
        const f = fixture();
        let settled = false;
        f.manager.playCelebration(f.scene, 'juvenile', 'adult', {}).then(() => { settled = true; });
        f.replaceStory();
        await jest.advanceTimersByTimeAsync(450);
        expect(settled).toBe(true);
        expect(f.manager.isCelebrating()).toBe(false);
        expect(f.audio.playEvolutionMajor).not.toHaveBeenCalled();
    });

    test('a new GameState cannot inherit a stale reveal', async () => {
        const f = fixture();
        const old = f.manager.playCelebration(f.scene, 'juvenile', 'adult', {});
        f.sceneWindow.GameState = { get: () => undefined };
        const replacement = f.manager.playCelebration(f.scene, 'baby', 'juvenile', {});
        await old;
        expect(f.manager.isCelebrating()).toBe(true);
        f.manager.forceStop();
        await replacement;
    });

    test('an unavailable transition cannot lock future celebrations', async () => {
        const f = fixture();
        await f.manager.playCelebration(f.scene, 'baby', 'adult', {});
        expect(f.manager.isCelebrating()).toBe(false);
        expect(f.scene.add.graphics).not.toHaveBeenCalled();
        const playing = f.manager.playCelebration(f.scene, 'baby', 'juvenile', {});
        expect(f.manager.isCelebrating()).toBe(true);
        f.manager.forceStop();
        await playing;
    });

    test('cancellation at an async phase handoff cannot start the next fanfare', async () => {
        const f = fixture();
        const runPhase = f.manager.runPhase.bind(f.manager);
        let phases = 0;
        f.manager.runPhase = async (...args) => {
            const result = await runPhase(...args);
            if (++phases === 2) f.manager.forceStop();
            return result;
        };
        const playing = f.manager.playCelebration(f.scene, 'juvenile', 'adult', {});
        await jest.advanceTimersByTimeAsync(2500);
        await playing;
        expect(f.audio.playEvolutionMajor).not.toHaveBeenCalled();
        expect(f.scene.add.zone).not.toHaveBeenCalled();
    });

    test('a synchronous drawing error settles without leaving the singleton occupied', async () => {
        const f = fixture();
        f.scene.add.graphics.mockImplementationOnce(() => { throw new Error('synthetic drawing failure'); });
        await f.manager.playCelebration(f.scene, 'juvenile', 'adult', {});
        expect(f.manager.isCelebrating()).toBe(false);
        expect(f.events.eventNames()).toEqual([]);
        expect(f.scene.events.eventNames()).toEqual([]);
    });

    test('a delayed drawing error cancels the remaining phases', async () => {
        const f = fixture();
        let settled = false;
        f.manager.playCelebration(f.scene, 'juvenile', 'adult', {}).then(() => { settled = true; });
        const glow = f.elements[0];
        glow.clear.mockImplementationOnce(() => { throw new Error('synthetic delayed failure'); });
        await jest.advanceTimersByTimeAsync(500);
        expect(settled).toBe(true);
        expect(f.manager.isCelebrating()).toBe(false);
        expect(f.audio.playEvolutionMajor).not.toHaveBeenCalled();
    });

    test('already-disposed resources cannot prevent cancellation or a future reveal', async () => {
        const f = fixture();
        const playing = f.manager.playCelebration(f.scene, 'juvenile', 'adult', {});
        f.timers[0].remove.mockImplementationOnce(() => { throw new Error('already removed'); });
        f.manager.forceStop();
        await playing;
        expect(f.manager.isCelebrating()).toBe(false);
        expect(f.elements.every(element => !element.active)).toBe(true);
        expect(f.events.eventNames()).toEqual([]);
    });
});
