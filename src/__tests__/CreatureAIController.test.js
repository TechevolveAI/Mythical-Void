const fs = require('fs');
const path = require('path');
const vm = require('vm');
const responseConfig = require('../config/creature-responses.json');

function loadController() {
    const filePath = path.join(__dirname, '../systems/CreatureAIController.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import creatureResponseConfig from '../config/creature-responses.json';",
            'const creatureResponseConfig = RESPONSE_CONFIG;'
        )
        .replace('export default CreatureAIController;', '')
        .concat('\nmodule.exports = { CreatureAIController, SAFE_DEFAULT_RESPONSE };');
    const gameState = {
        get: jest.fn(),
        set: jest.fn(),
        emit: jest.fn()
    };
    const sandbox = {
        module: { exports: {} },
        exports: {},
        RESPONSE_CONFIG: responseConfig,
        window: {
            APIConfig: {},
            GameState: gameState
        },
        console: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        },
        Date,
        Object,
        Array,
        Number,
        String,
        RegExp,
        Math
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return {
        ...sandbox.module.exports,
        gameState,
        console: sandbox.console,
        source
    };
}

describe('CreatureAIController production dialogue', () => {
    const expectedEmotions = [
        'happy',
        'sleepy',
        'nervous',
        'curious',
        'grateful',
        'excited',
        'tired',
        'peaceful',
        'playful',
        'calm'
    ];

    test('bundles its authored response map instead of fetching a source path', () => {
        const { source } = loadController();

        expect(source).toContain(
            "import creatureResponseConfig from '../config/creature-responses.json';"
        );
        expect(source).not.toContain("fetch('/src/config/creature-responses.json')");
        expect(source).toContain('Bundled companion responses ready');
    });

    test('provides bounded story-aligned copy for every allowed emotion', () => {
        expect(Object.keys(responseConfig)).toEqual(expectedEmotions);

        const responses = Object.values(responseConfig)
            .flatMap(triggerMap => Object.values(triggerMap))
            .flat();
        expect(responses.length).toBeGreaterThan(100);
        expect(responses.every(response => (
            typeof response === 'string' &&
            response.length > 0 &&
            response.length <= 200
        ))).toBe(true);
        expect(responses.join(' ')).toMatch(/Current|Fend|signal|Wanderer|mission/i);
        expect(responses.join(' ')).not.toMatch(
            /you(?:'re| are) (?:the )?(?:best|amazing|awesome|wonderful|greatest)|can't cope without you|cannot cope without you/i
        );
    });

    test('initializes from the bundled configuration without a warning fallback', async () => {
        const {
            CreatureAIController,
            console
        } = loadController();
        const controller = new CreatureAIController();

        await controller.initialize();

        expect(controller.initialized).toBe(true);
        expect(controller.fallbackResponses).toBe(responseConfig);
        expect(console.warn).not.toHaveBeenCalled();
    });

    test('returns authored contextual dialogue in offline mode', async () => {
        const { CreatureAIController } = loadController();
        const controller = new CreatureAIController();
        await controller.initialize();
        const response = await controller.generateResponse({
            emotion: 'curious',
            trigger: 'exploration'
        });

        expect(responseConfig.curious.exploration).toContain(response);
    });

    test('filters model output that creates emotional dependency', async () => {
        const {
            CreatureAIController,
            SAFE_DEFAULT_RESPONSE,
            gameState
        } = loadController();
        const controller = new CreatureAIController();
        const response = await controller.applySafetyFilter(
            "You're the best. I cannot cope without you."
        );

        expect(response).toBe(SAFE_DEFAULT_RESPONSE);
        expect(gameState.set).toHaveBeenCalledWith(
            'safety.violations',
            expect.arrayContaining([
                expect.objectContaining({ category: 'DEPENDENCY' })
            ])
        );
    });
});
