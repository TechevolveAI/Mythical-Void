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
        .concat('\nmodule.exports = { CAYDEN_BIRTHDAY_EVENT, isCaydenBirthdayAnswer, isCaydenBirthdayCelebrationActive };');
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

describe('Cayden birthday Forest celebration', () => {
    const events = loadEventModule();
    const forestSource = fs.readFileSync(forestPath, 'utf8');

    test('activates on 11 September 2026 in Dublin time', () => {
        expect(events.isCaydenBirthdayCelebrationActive({
            date: new Date('2026-09-10T23:30:00.000Z'),
            search: ''
        })).toBe(true);
        expect(events.isCaydenBirthdayCelebrationActive({
            date: new Date('2026-09-10T20:00:00.000Z'),
            search: ''
        })).toBe(false);
    });

    test('supports a deliberate preview without changing the event date', () => {
        expect(events.isCaydenBirthdayCelebrationActive({
            date: new Date('2026-08-01T12:00:00.000Z'),
            search: '?birthday=cayden'
        })).toBe(true);
    });

    test('accepts Cayden\'s favorite number without persisting or transmitting it', async () => {
        const crypto = require('crypto').webcrypto;
        await expect(events.isCaydenBirthdayAnswer('77', crypto)).resolves.toBe(true);
        await expect(events.isCaydenBirthdayAnswer('23', crypto)).resolves.toBe(false);
        await expect(events.isCaydenBirthdayAnswer('not-a-number', crypto)).resolves.toBe(false);
    });

    test('runs the local question after restoration and before rewards', () => {
        expect(forestSource).toContain('isCaydenBirthdayCelebrationActive()');
        expect(forestSource).toContain('showCaydenBirthdayQuestion({');
        expect(forestSource).toContain('showCaydenBirthdayCelebration({');
        expect(forestSource).toContain('onComplete: () => this.showBossVictory()');
        expect(forestSource).toContain('this.player?.body?.setAllowGravity?.(false)');
        expect(forestSource).toContain('What is your favorite number?');
        expect(forestSource).toContain('[ CONTINUE WITHOUT MESSAGE ]');
    });

    test('uses the exact family message and existing runtime actors', () => {
        expect(forestSource).toContain('HAPPY BIRTHDAY, CAYDEN!');
        expect(forestSource).toContain(
            'We love you to the void and back.\\nFrom Dad and Rian.'
        );
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
