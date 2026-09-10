const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { TextEncoder } = require('util');

const eventPath = path.join(__dirname, '../config/special-events.js');
const forestPath = path.join(__dirname, '../scenes/levels/MythicalForestLevel.js');

function loadEventModule() {
    const source = fs.readFileSync(eventPath, 'utf8')
        .replace(/export const /g, 'const ')
        .replace(/export (async )?function /g, '$1function ')
        .concat('\nmodule.exports = { CADEN_BIRTHDAY_EVENT, isCadenBirthdayAnswer, isCadenBirthdayCelebrationActive };');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Intl,
        URLSearchParams,
        Date,
        TextEncoder,
        Uint8Array,
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

    test('accepts the established number without persisting or transmitting it', async () => {
        const crypto = require('crypto').webcrypto;
        await expect(events.isCadenBirthdayAnswer('23', crypto)).resolves.toBe(true);
        await expect(events.isCadenBirthdayAnswer('22', crypto)).resolves.toBe(false);
        await expect(events.isCadenBirthdayAnswer('not-a-number', crypto)).resolves.toBe(false);
    });

    test('runs the local question after restoration and before rewards', () => {
        expect(forestSource).toContain('isCadenBirthdayCelebrationActive()');
        expect(forestSource).toContain('showCadenBirthdayQuestion({');
        expect(forestSource).toContain('showCadenBirthdayCelebration({');
        expect(forestSource).toContain('onComplete: () => this.showBossVictory()');
        expect(forestSource).toContain('this.player?.body?.setAllowGravity?.(false)');
        expect(forestSource).toContain('What is your favorite number?');
        expect(forestSource).toContain('[ CONTINUE WITHOUT MESSAGE ]');
    });

    test('uses the exact family message and existing runtime actors', () => {
        expect(forestSource).toContain('HAPPY BIRTHDAY, CADEN!');
        expect(forestSource).toContain('We love you so much.\\nFrom Dad and Rian.');
        expect(forestSource).toContain(
            'this.createRuntimeForestArrivalActors(width, height, depth + 4)'
        );
        expect(forestSource).toContain('index < 23');
        expect(forestSource).not.toContain("GameState?.set('birthday");
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
