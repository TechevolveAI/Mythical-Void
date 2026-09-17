const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const { EventEmitter } = require('events');

const source = fs.readFileSync(path.join(__dirname, '../scenes/GameScene.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ClassDeclaration' && node.id.name === 'GameScene');

function method(name, dependencies) {
    const node = declaration.body.body.find(member => member.key?.name === name);
    if (!node) throw new Error(`Missing GameScene.${name}`);
    return new Function(...Object.keys(dependencies), `return ({${source.slice(node.start, node.end)}}).${name};`)(...Object.values(dependencies));
}

describe('final repair to ending continuation', () => {
    let scene, recovery, gameWindow, timers, dependencies;
    beforeEach(() => {
        recovery = { status: 'ending' };
        timers = [];
        gameWindow = {
            GameState: {},
            AchievementSystem: { recordEvent: jest.fn() },
            setTimeout: jest.fn(callback => { timers.push(callback); return timers.length; }),
            clearTimeout: jest.fn()
        };
        dependencies = {
            window: gameWindow,
            getCampaignFinaleRecovery: () => recovery,
            console: { warn: jest.fn() }
        };
        scene = {
            continueFinaleAfterRepair: false,
            _isShuttingDown: false,
            events: new EventEmitter(),
            time: { delayedCall: jest.fn((delay, callback) => timers.push(callback)) },
            scene: { start: jest.fn() }
        };
        scene.scheduleCompletionHandoff = method('scheduleCompletionHandoff', dependencies);
        scene.cancelCompletionHandoffs = method('cancelCompletionHandoffs', dependencies);
        scene.finishFinaleAfterCommandRepair = method('finishFinaleAfterCommandRepair', dependencies);
    });

    test('recovers a lost scene handoff from durable completion state', () => {
        expect(scene.finishFinaleAfterCommandRepair()).toBe(true);
        expect(scene.time.delayedCall).not.toHaveBeenCalled();
        expect(gameWindow.setTimeout).toHaveBeenCalledWith(expect.any(Function), 180);
        timers[0]();
        expect(scene.scene.start).toHaveBeenCalledWith('VictoryScene');
    });

    test.each([null, { status: 'repair' }])('does not bypass missing repair or replay a finished ending: %j', state => {
        recovery = state;
        scene.continueFinaleAfterRepair = true;
        expect(scene.finishFinaleAfterCommandRepair()).toBe(false);
        expect(timers).toHaveLength(0);
        expect(gameWindow.AchievementSystem.recordEvent).not.toHaveBeenCalled();
    });

    test('accepts duplicate taps only once', () => {
        expect(scene.finishFinaleAfterCommandRepair()).toBe(true);
        expect(scene.finishFinaleAfterCommandRepair()).toBe(false);
        expect(timers).toHaveLength(1);
        expect(gameWindow.AchievementSystem.recordEvent).toHaveBeenCalledTimes(1);
    });

    test('an optional achievement failure cannot block the ending', () => {
        gameWindow.AchievementSystem.recordEvent.mockImplementation(() => { throw new Error('optional UI unavailable'); });
        expect(scene.finishFinaleAfterCommandRepair()).toBe(true);
        timers[0]();
        expect(scene.scene.start).toHaveBeenCalledWith('VictoryScene');
    });

    test('shutdown or changed progress cancels a queued transition', () => {
        scene.finishFinaleAfterCommandRepair();
        scene._isShuttingDown = true;
        timers[0]();
        expect(scene.scene.start).not.toHaveBeenCalled();
        scene._isShuttingDown = false;
        recovery = null;
        timers[0]();
        expect(scene.scene.start).not.toHaveBeenCalled();
    });

    test('restores the pending handoff on entry and clears stale handoffs after the epilogue', () => {
        const restore = method('restoreFinaleContinuation', dependencies);
        recovery = { status: 'repair' };
        expect(restore.call(scene)).toEqual(recovery);
        expect(scene.continueFinaleAfterRepair).toBe(true);
        recovery = null;
        expect(restore.call(scene)).toBeNull();
        expect(scene.continueFinaleAfterRepair).toBe(false);
    });

    test('replacing a handoff cancels its old callback without changing the simulation clock', () => {
        const oldAction = jest.fn(), nextAction = jest.fn();
        scene.scheduleCompletionHandoff('repair', 900, oldAction);
        scene.scheduleCompletionHandoff('repair', 900, nextAction);
        expect(gameWindow.clearTimeout).toHaveBeenCalledWith(1);
        timers[0]();
        timers[1]();
        timers[1]();
        expect(oldAction).not.toHaveBeenCalled();
        expect(nextAction).toHaveBeenCalledTimes(1);
        expect(scene.time.delayedCall).not.toHaveBeenCalled();
    });

    test('scene cleanup cancels all handoffs and stale callbacks cannot escape it', () => {
        const action = jest.fn();
        scene.scheduleCompletionHandoff('repair', 900, action);
        scene.scheduleCompletionHandoff('finale', 180, action);
        scene.cancelCompletionHandoffs();
        expect(gameWindow.clearTimeout).toHaveBeenCalledWith(1);
        expect(gameWindow.clearTimeout).toHaveBeenCalledWith(2);
        timers.forEach(callback => callback());
        expect(action).not.toHaveBeenCalled();
        expect(scene._completionHandoffTimers.size).toBe(0);
    });

    test('a handoff never runs for an inactive scene', () => {
        const action = jest.fn();
        scene.scheduleCompletionHandoff('repair', 900, action);
        scene.scene.isActive = () => false;
        timers[0]();
        expect(action).not.toHaveBeenCalled();
    });

    test.each(['pause', 'sleep'])('retains a due finale across temporary %s and resumes exactly once', state => {
        let paused = true;
        scene.scene.isActive = () => !paused;
        scene.scene.isPaused = () => state === 'pause' && paused;
        scene.scene.isSleeping = () => state === 'sleep' && paused;
        scene.finishFinaleAfterCommandRepair();
        timers[0]();
        expect(scene.scene.start).not.toHaveBeenCalled();
        expect(scene._completionHandoffTimers.size).toBe(1);
        paused = false;
        scene.events.emit(state === 'pause' ? 'resume' : 'wake');
        scene.events.emit('resume');
        scene.events.emit('wake');
        expect(scene.scene.start).toHaveBeenCalledTimes(1);
        expect(scene.scene.start).toHaveBeenCalledWith('VictoryScene');
        expect(scene.events.listenerCount('resume')).toBe(0);
        expect(scene.events.listenerCount('wake')).toBe(0);
    });

    test('shutdown cancels a due paused handoff including its resume listeners', () => {
        scene.scene.isPaused = () => true;
        scene.finishFinaleAfterCommandRepair();
        timers[0]();
        scene.cancelCompletionHandoffs();
        scene.scene.isPaused = () => false;
        scene.events.emit('resume');
        expect(scene.scene.start).not.toHaveBeenCalled();
        expect(scene.events.listenerCount('resume')).toBe(0);
        expect(scene.events.listenerCount('wake')).toBe(0);
    });
});

describe('ending presentation after a refresh', () => {
    const victorySource = fs.readFileSync(path.join(__dirname, '../scenes/VictoryScene.js'), 'utf8');
    const victoryClass = parse(victorySource, { sourceType: 'module' }).program.body
        .find(node => node.type === 'ExportDefaultDeclaration').declaration;
    const create = victoryClass.body.body.find(member => member.key?.name === 'create');

    test.each([false, true])('keeps the first celebration, resumes already-seen celebration=%s', restored => {
        const start = new Function('window', 'SceneTransitionHelper', 'devLog', `return ({${victorySource.slice(create.start, create.end)}}).create;`)(
            { GameState: { get: () => restored } },
            { stopActiveScenes: jest.fn(), bringToTop: jest.fn() },
            jest.fn()
        );
        const scene = {
            scale: { width: 390, height: 844 },
            loadGameStats: jest.fn(), createBackground: jest.fn(),
            showChoiceScene: jest.fn(), startVictorySequence: jest.fn()
        };
        start.call(scene);
        expect(scene.showChoiceScene).toHaveBeenCalledTimes(restored ? 1 : 0);
        expect(scene.startVictorySequence).toHaveBeenCalledTimes(restored ? 0 : 1);
    });
});

describe('final Guardian result handoff', () => {
    const levelSource = fs.readFileSync(path.join(__dirname, '../scenes/levels/FinalVoidLevel.js'), 'utf8');
    const levelClass = parse(levelSource, { sourceType: 'module' }).program.body
        .find(node => node.type === 'ClassDeclaration' && node.id.name === 'FinalVoidLevel');
    const node = levelClass.body.body.find(member => member.key?.name === 'showBossVictory');
    const showVictory = new Function('window', `return ({${levelSource.slice(node.start, node.end)}}).showBossVictory;`)({});

    test.each([true, false])('repair action needs no animation clock; new resident=%s', residentOpen => {
        const texts = [];
        const scene = {
            getLevelModalLayout: () => ({ width: 390, contentWidth: 350, y: value => value, font: value => value }),
            completeLevelProgression: jest.fn(), residentReleaseOpen: residentOpen,
            getBossPowerupRewardCopy: () => 'Reward', getVillageCompletionCopy: () => '',
            showLevelComplete: jest.fn(), time: { delayedCall: jest.fn() },
            tweens: { add: jest.fn(), killTweensOf: jest.fn() },
            add: { text: () => {
                const text = { destroy: jest.fn() };
                ['setOrigin', 'setScrollFactor', 'setDepth', 'setAlpha'].forEach(name => { text[name] = () => text; });
                texts.push(text);
                return text;
            } }
        };
        showVictory.call(scene);
        expect(scene.time.delayedCall).not.toHaveBeenCalled();
        expect(scene.showLevelComplete).toHaveBeenCalledTimes(residentOpen ? 0 : 1);
        if (residentOpen) {
            scene.pendingResidentReleaseContinuation();
            scene.pendingResidentReleaseContinuation();
        }
        expect(scene.showLevelComplete).toHaveBeenCalledTimes(1);
        for (const text of texts) {
            expect(scene.tweens.killTweensOf).toHaveBeenCalledWith(text);
            expect(text.destroy).toHaveBeenCalledTimes(1);
        }
    });
});
