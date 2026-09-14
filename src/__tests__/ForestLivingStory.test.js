const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadForestLivingStory() {
    const filePath = path.join(__dirname, '../systems/ForestLivingStory.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .concat(`
            module.exports = {
                FOREST_LIVING_STORY_STATE_PATH,
                FOREST_HELP_MOMENTS,
                getForestHelpMoment,
                getForestLivingStoryState,
                recordForestHelpMoment,
                recordForestRestored
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Set,
        Array,
        Number,
        Math,
        Object
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState(initial = {}) {
    let state = JSON.parse(JSON.stringify(initial));
    return {
        get: jest.fn(() => state),
        set: jest.fn((_path, value) => { state = value; }),
        save: jest.fn(),
        read: () => state
    };
}

describe('Mythical Forest living story state', () => {
    const story = loadForestLivingStory();

    test('defines three plain, distinct creature-led help moments', () => {
        expect(story.FOREST_HELP_MOMENTS).toHaveLength(3);
        expect(story.FOREST_HELP_MOMENTS.map(moment => moment.id)).toEqual([
            'tangled_roots',
            'dark_hollow',
            'hidden_lives'
        ]);
        expect(new Set(
            story.FOREST_HELP_MOMENTS.map(moment => moment.objective)
        ).size).toBe(3);
        story.FOREST_HELP_MOMENTS.forEach(moment => {
            expect(moment.creatureLine.length).toBeLessThanOrEqual(48);
            expect(moment.astronautLine.length).toBeLessThanOrEqual(58);
        });
    });

    test('stores only approved story identifiers and removes duplicates', () => {
        const gameState = createGameState({
            version: 99,
            recoveredMomentIds: [
                'tangled_roots',
                'not_player_text',
                'tangled_roots'
            ],
            forestRestored: false,
            transcript: 'must not survive normalization'
        });

        expect(story.getForestLivingStoryState(gameState)).toEqual({
            version: 1,
            recoveredMomentIds: ['tangled_roots'],
            forestRestored: false
        });
    });

    test('records each help moment idempotently and restores the Forest', () => {
        const gameState = createGameState();

        expect(story.recordForestHelpMoment(
            gameState,
            'dark_hollow'
        ).changed).toBe(true);
        expect(story.recordForestHelpMoment(
            gameState,
            'dark_hollow'
        ).changed).toBe(false);
        expect(story.recordForestHelpMoment(
            gameState,
            'player supplied sentence'
        ).changed).toBe(false);
        expect(story.recordForestRestored(gameState).changed).toBe(true);

        expect(gameState.read()).toEqual({
            version: 1,
            recoveredMomentIds: ['dark_hollow'],
            forestRestored: true
        });
        expect(gameState.save).toHaveBeenCalledTimes(2);
    });
});
