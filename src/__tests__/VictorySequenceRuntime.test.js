const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadVictoryScene(sceneWindow) {
    const filePath = path.join(__dirname, '../scenes/VictoryScene.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/^import .*$/gm, '')
        .replace('export default class VictoryScene', 'class VictoryScene')
        .concat('\nmodule.exports = VictoryScene;\n');

    class PhaserScene {
        constructor(config) {
            this.scene = { key: config?.key };
        }
    }

    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow,
        Phaser: { Scene: PhaserScene },
        devLog: jest.fn(),
        SceneTransitionHelper: {},
        Date,
        Math,
        Object,
        Array,
        Number,
        String,
        Boolean,
        Set
    };

    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState() {
    const state = {
        story: {
            projectBeacon: {
                uplinkRestored: false,
                uplinkRestoredAt: null,
                endingChoice: null,
                endingChoiceDate: null,
                endingEpilogueSeen: false,
                endingEpilogueCompletedAt: null
            }
        }
    };

    return {
        state,
        get: jest.fn((propertyPath) => {
            return propertyPath.split('.').reduce(
                (value, key) => value?.[key],
                state
            );
        }),
        set: jest.fn((propertyPath, value) => {
            const keys = propertyPath.split('.');
            const finalKey = keys.pop();
            const target = keys.reduce((current, key) => {
                current[key] = current[key] || {};
                return current[key];
            }, state);
            target[finalKey] = value;
        }),
        save: jest.fn()
    };
}

describe('VictoryScene runtime sequence', () => {
    test('runs restoration and reflection before presenting the choice', () => {
        const VictoryScene = loadVictoryScene({});
        const scene = new VictoryScene();
        const scheduled = new Map();

        scene.showAssemblyPhase = jest.fn();
        scene.createSkipControl = jest.fn();
        scene.showBeaconPhase = jest.fn();
        scene.showReflectionPhase = jest.fn();
        scene.showCreditsPhase = jest.fn();
        scene.showCompletePhase = jest.fn();
        scene.time = {
            delayedCall: jest.fn((delay, callback) => {
                scheduled.set(delay, callback);
            })
        };

        scene.startVictorySequence(1280, 720);

        expect(scene.showAssemblyPhase).toHaveBeenCalledWith(1280, 720);
        expect([...scheduled.keys()]).toEqual([5000, 10000, 18000, 35000]);

        scheduled.get(5000)();
        expect(scene.phase).toBe('beacon');
        expect(scene.showBeaconPhase).toHaveBeenCalledWith(1280, 720);

        scheduled.get(10000)();
        expect(scene.phase).toBe('reflection');
        expect(scene.showReflectionPhase).toHaveBeenCalledWith(1280, 720);

        scheduled.get(18000)();
        expect(scene.phase).toBe('credits');
        expect(scene.showCreditsPhase).toHaveBeenCalledWith(1280, 720);

        scheduled.get(35000)();
        expect(scene.phase).toBe('complete');
        expect(scene.showCompletePhase).toHaveBeenCalledWith(1280, 720);
    });

    test('records restoration without making the ending choice', () => {
        const gameState = createGameState();
        const achievementSystem = {
            recordEvent: jest.fn()
        };
        const VictoryScene = loadVictoryScene({
            GameState: gameState,
            AchievementSystem: achievementSystem
        });
        const scene = new VictoryScene();

        expect(scene.recordCampaignRestoration()).toBe(true);

        const restoredAt = gameState.get(
            'story.projectBeacon.uplinkRestoredAt'
        );
        expect(gameState.get('story.projectBeacon.uplinkRestored')).toBe(true);
        expect(restoredAt).toEqual(expect.any(String));
        expect(gameState.get('story.projectBeacon.endingChoice')).toBeNull();
        expect(achievementSystem.recordEvent).toHaveBeenCalledWith(
            'campaign_completed',
            { restoredAt }
        );
        expect(gameState.save).toHaveBeenCalledTimes(1);

        scene.recordCampaignRestoration();
        expect(
            gameState.get('story.projectBeacon.uplinkRestoredAt')
        ).toBe(restoredAt);
    });

    test('keeps finale previews isolated from campaign and ending saves', () => {
        const gameState = createGameState();
        const achievementSystem = {
            recordEvent: jest.fn()
        };
        const VictoryScene = loadVictoryScene({
            GameState: gameState,
            AchievementSystem: achievementSystem
        });
        const scene = new VictoryScene();
        scene.init({ testMode: true });

        expect(scene.recordCampaignRestoration()).toBe(true);
        expect(scene.recordEndingChoice('earth')).toBe(true);
        expect(gameState.get('story.projectBeacon.uplinkRestored')).toBe(false);
        expect(gameState.get('story.projectBeacon.endingChoice')).toBeNull();
        expect(gameState.set).not.toHaveBeenCalled();
        expect(gameState.save).not.toHaveBeenCalled();
        expect(achievementSystem.recordEvent).not.toHaveBeenCalled();
    });

    test('commits one ending once and does not silently replace it', () => {
        const gameState = createGameState();
        const VictoryScene = loadVictoryScene({ GameState: gameState });
        const scene = new VictoryScene();

        expect(scene.recordEndingChoice('earth')).toBe(true);
        const chosenAt = gameState.get('story.projectBeacon.endingChoiceDate');
        expect(gameState.get('story.projectBeacon.endingChoice')).toBe('earth');
        expect(chosenAt).toEqual(expect.any(String));
        expect(gameState.get('story.projectBeacon.endingEpilogueSeen')).toBe(false);
        expect(gameState.save).toHaveBeenCalledTimes(1);

        expect(scene.recordEndingChoice('earth')).toBe(true);
        expect(scene.recordEndingChoice('void')).toBe(false);
        expect(gameState.get('story.projectBeacon.endingChoice')).toBe('earth');
        expect(gameState.get('story.projectBeacon.endingChoiceDate')).toBe(chosenAt);
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });

    test('marks only the selected epilogue complete and preserves its timestamp', () => {
        const gameState = createGameState();
        const VictoryScene = loadVictoryScene({ GameState: gameState });
        const scene = new VictoryScene();

        scene.recordEndingChoice('void');
        expect(scene.completeEndingEpilogue('earth')).toBe(false);
        expect(scene.completeEndingEpilogue('void')).toBe(true);

        const completedAt = gameState.get(
            'story.projectBeacon.endingEpilogueCompletedAt'
        );
        expect(gameState.get('story.projectBeacon.endingEpilogueSeen')).toBe(true);
        expect(completedAt).toEqual(expect.any(String));

        expect(scene.completeEndingEpilogue('void')).toBe(true);
        expect(
            gameState.get('story.projectBeacon.endingEpilogueCompletedAt')
        ).toBe(completedAt);
    });
});
