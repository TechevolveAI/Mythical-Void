const fs = require('fs');
const path = require('path');
const vm = require('vm');

const eventPath = path.join(__dirname, '../config/special-events.js');
const forestPath = path.join(__dirname, '../scenes/levels/MythicalForestLevel.js');

function loadEventModule() {
    const source = fs.readFileSync(eventPath, 'utf8')
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .concat('\nmodule.exports = { CADEN_BIRTHDAY_EVENT, isCadenBirthdayCelebrationActive };');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Intl,
        URLSearchParams,
        Date,
        globalThis: { location: { search: '' } }
    };
    vm.runInNewContext(source, sandbox);
    return sandbox.module.exports;
}

describe('Caden birthday Forest celebration', () => {
    const events = loadEventModule();
    const forestSource = fs.readFileSync(forestPath, 'utf8');

    test('activates on 11 September 2026 in Dublin time', () => {
        expect(events.isCadenBirthdayCelebrationActive({
            date: new Date('2026-09-10T23:30:00.000Z'),
            search: ''
        })).toBe(true);
        expect(events.isCadenBirthdayCelebrationActive({
            date: new Date('2026-09-10T20:00:00.000Z'),
            search: ''
        })).toBe(false);
    });

    test('supports a deliberate preview without changing the event date', () => {
        expect(events.isCadenBirthdayCelebrationActive({
            date: new Date('2026-08-01T12:00:00.000Z'),
            search: '?birthday=caden'
        })).toBe(true);
    });

    test('runs after restoration and before the normal reward panel', () => {
        expect(forestSource).toContain('isCadenBirthdayCelebrationActive()');
        expect(forestSource).toContain('showCadenBirthdayCelebration({');
        expect(forestSource).toContain('onComplete: () => this.showBossVictory()');
        expect(forestSource).toContain('this.player?.body?.setAllowGravity?.(false)');
    });

    test('uses the exact family message and existing runtime actors', () => {
        expect(forestSource).toContain('HAPPY BIRTHDAY, CADEN!');
        expect(forestSource).toContain('We love you so much.\\nFrom Dad and Rian.');
        expect(forestSource).toContain(
            'this.createRuntimeForestArrivalActors(width, height, depth + 4)'
        );
        expect(forestSource).toContain('index < 23');
    });

    test('keeps completion independent of hosted generated media', () => {
        const method = forestSource.slice(
            forestSource.indexOf('showCadenBirthdayCelebration'),
            forestSource.indexOf('showBossVictory()', forestSource.indexOf('showCadenBirthdayCelebration'))
        );
        expect(method).not.toContain('CompanionMediaService');
        expect(method).not.toContain('generate-companion-video');
    });
});
