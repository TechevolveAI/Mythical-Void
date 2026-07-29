const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFirstExpeditionDrill() {
    const filePath = path.join(__dirname, '../systems/FirstExpeditionDrill.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .concat(`
            module.exports = {
                FIRST_EXPEDITION_DRILL_STATE_PATH,
                FIRST_EXPEDITION_DRILL_STEPS,
                getFirstExpeditionCompanionName,
                getFirstExpeditionDrillStep,
                advanceFirstExpeditionDrill
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Object,
        Number,
        Math
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('first expedition field drill', () => {
    const {
        FIRST_EXPEDITION_DRILL_STATE_PATH,
        FIRST_EXPEDITION_DRILL_STEPS,
        getFirstExpeditionCompanionName,
        getFirstExpeditionDrillStep,
        advanceFirstExpeditionDrill
    } = loadFirstExpeditionDrill();

    test('defines the save path and a three-action learning sequence', () => {
        expect(FIRST_EXPEDITION_DRILL_STATE_PATH).toBe(
            'story.projectBeacon.firstExpeditionDrill'
        );
        expect(FIRST_EXPEDITION_DRILL_STEPS.map(step => step.action)).toEqual([
            'move',
            'jump',
            'melee'
        ]);
    });

    test('only advances when the current real action is performed', () => {
        expect(advanceFirstExpeditionDrill(0, 'jump')).toEqual({
            advanced: false,
            completed: false,
            stepIndex: 0
        });
        expect(advanceFirstExpeditionDrill(0, 'move')).toEqual({
            advanced: true,
            completed: false,
            stepIndex: 1
        });
        expect(advanceFirstExpeditionDrill(1, 'jump')).toEqual({
            advanced: true,
            completed: false,
            stepIndex: 2
        });
        expect(advanceFirstExpeditionDrill(2, 'melee')).toEqual({
            advanced: true,
            completed: true,
            stepIndex: 3
        });
    });

    test('returns device-appropriate controls without changing authored copy', () => {
        const desktop = getFirstExpeditionDrillStep(0, {
            companionName: 'Nova'
        });
        const mobile = getFirstExpeditionDrillStep(0, {
            isMobile: true,
            companionName: 'Nova'
        });

        expect(desktop.control).toContain('LEFT / RIGHT');
        expect(mobile.control).toContain('MOVEMENT');
        expect(desktop.heading).toBe(mobile.heading);
        expect(desktop.instruction).toBe(mobile.instruction);
        expect(desktop.instruction).toBe(
            'Guide Nova forward. Stay together.'
        );
    });

    test('keeps player-created names readable and provides a warm fallback', () => {
        expect(getFirstExpeditionCompanionName('  Nova   Light  ')).toBe(
            'Nova Light'
        );
        expect(getFirstExpeditionCompanionName('')).toBe('your companion');
        expect(getFirstExpeditionCompanionName(null)).toBe('your companion');
        expect(
            getFirstExpeditionCompanionName('ABCDEFGHIJKLMNOPQRSTUVW')
        ).toHaveLength(20);
    });
});
