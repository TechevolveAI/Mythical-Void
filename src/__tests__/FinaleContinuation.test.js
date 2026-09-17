const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');

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
            AchievementSystem: { recordEvent: jest.fn() }
        };
        dependencies = {
            window: gameWindow,
            getCampaignFinaleRecovery: () => recovery,
            console: { warn: jest.fn() }
        };
        scene = {
            continueFinaleAfterRepair: false,
            _isShuttingDown: false,
            time: { delayedCall: jest.fn((delay, callback) => timers.push(callback)) },
            scene: { start: jest.fn() }
        };
        scene.finishFinaleAfterCommandRepair = method('finishFinaleAfterCommandRepair', dependencies);
    });

    test('recovers a lost scene handoff from durable completion state', () => {
        expect(scene.finishFinaleAfterCommandRepair()).toBe(true);
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
