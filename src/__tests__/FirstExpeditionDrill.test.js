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
        expect(mobile.control).toBe('MOVE THE JOYSTICK LEFT OR RIGHT');
        expect(desktop.heading).toBe(mobile.heading);
        expect(desktop.instruction).toBe(mobile.instruction);
        expect(desktop.instruction).toBe(
            'Move with Nova. The astronaut stays close.'
        );
    });

    test('names mobile controls by function and icon instead of color alone', () => {
        expect(getFirstExpeditionDrillStep(1, { isMobile: true }).control)
            .toBe('TAP JUMP (UP ARROW)');
        expect(getFirstExpeditionDrillStep(2, { isMobile: true }).control)
            .toBe('TAP KATANA (CROSSED BLADES)');
        expect(getFirstExpeditionDrillStep(2, { isMobile: true }).instruction)
            .toContain("astronaut's katana strike");
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

    test('provides a local-only katana-step preview for responsive QA', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );
        const levelSource = fs.readFileSync(
            path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
            'utf8'
        );

        expect(gameSource).toContain("'katana-mobile'");
        expect(gameSource).toContain('firstExpeditionDrillStepPreview:');
        expect(levelSource).toContain(
            'stepIndex: this.firstExpeditionDrillStepPreview'
        );
    });
});
