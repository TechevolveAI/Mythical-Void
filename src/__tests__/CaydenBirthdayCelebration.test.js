const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { TextEncoder } = require('util');
const { EventEmitter } = require('events');
const { parse } = require('@babel/parser');

const eventPath = path.join(__dirname, '../config/special-events.js');
const forestPath = path.join(__dirname, '../scenes/levels/MythicalForestLevel.js');
const forestSource = fs.readFileSync(forestPath, 'utf8');
const declaration = parse(forestSource, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ClassDeclaration');

function loadMethod(name, scope = {}) {
    const node = declaration.body.body.find(node => node.key?.name === name);
    return new Function(...Object.keys(scope),
        `return ({${forestSource.slice(node.start, node.end)}}).${name};`
    )(...Object.values(scope));
}

function questionHarness(check = jest.fn(async value => value === '77')) {
    const keyboard = new EventEmitter();
    const window = {
        addEventListener: (event, handler) => keyboard.on(event, handler),
        removeEventListener: jest.fn((event, handler) => keyboard.off(event, handler))
    };
    const elements = [];
    const element = (text = '') => {
        const item = new EventEmitter();
        item.text = text;
        item.destroy = jest.fn();
        item.setText = value => { item.text = value; return item; };
        for (const method of ['setScrollFactor', 'setDepth', 'fillStyle', 'fillRect',
            'fillEllipse', 'setOrigin', 'setColor', 'disableInteractive', 'setInteractive']) {
            item[method] = jest.fn(() => item);
        }
        elements.push(item);
        return item;
    };
    const timers = [];
    const scene = {
        cameras: { main: { width: 390, height: 844 } },
        events: new EventEmitter(),
        physics: { world: { isPaused: true }, pause: jest.fn(), resume: jest.fn() },
        add: { graphics: () => element(), text: (x, y, text) => element(text) },
        time: { delayedCall: (delay, callback) => {
            const timer = { callback, remove: jest.fn() }; timers.push(timer); return timer;
        } }
    };
    const onSuccess = jest.fn(), onSkip = jest.fn();
    loadMethod('showCaydenBirthdayQuestion', { window, isCaydenBirthdayAnswer: check })
        .call(scene, { onSuccess, onSkip });
    return { scene, elements, check, timers, onSuccess, onSkip, window, keyboard,
        tap: label => elements.find(item => item.text === label && item.listenerCount('pointerdown')).emit('pointerdown'),
        key: key => keyboard.emit('keydown', { key, preventDefault: jest.fn() }) };
}

const flushAnswer = async () => { await Promise.resolve(); await Promise.resolve(); };

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
        const method = loadMethod('showCaydenBirthdayCelebration').toString();
        expect(method).not.toContain('CompanionMediaService');
        expect(method).not.toContain('generate-companion-video');
    });
});

describe('permanent Forest birthday replay', () => {
    test('remains an optional result action after the birthday date and on repeat completions', () => {
        expect(loadEventModule().isCaydenBirthdayCelebrationActive({
            date: new Date('2026-09-18T12:00:00Z'), search: ''
        })).toBe(false);
        const replay = loadMethod('replayForestBirthdayMessage').toString();
        expect(replay).not.toContain('isCaydenBirthdayCelebrationActive');
        expect(replay).not.toContain('completeLevelProgression');
        expect(replay).not.toContain('showBossVictory');
    });

    test.each(['skip', 'success'])('restores the same results after %s without awarding again', route => {
        const window = { removeEventListener: jest.fn() };
        const elements = [{ setVisible: jest.fn() }];
        const scene = { birthdayCelebrationElements: [], levelCompletionKeyHandler: jest.fn(),
            bindLevelCompletionReturn: jest.fn(), showCaydenBirthdayQuestion: jest.fn(),
            showCaydenBirthdayCelebration: jest.fn() };
        expect(loadMethod('replayForestBirthdayMessage', { window }).call(scene, elements)).toBe(true);
        expect(window.removeEventListener).toHaveBeenCalledWith('keydown', scene.levelCompletionKeyHandler);
        expect(elements[0].setVisible).toHaveBeenLastCalledWith(false);
        const question = scene.showCaydenBirthdayQuestion.mock.calls[0][0];
        if (route === 'skip') question.onSkip();
        else {
            question.onSuccess();
            scene.showCaydenBirthdayCelebration.mock.calls[0][0].onComplete();
        }
        expect(elements[0].setVisible).toHaveBeenLastCalledWith(true);
        expect(scene.bindLevelCompletionReturn).toHaveBeenCalledTimes(1);
    });

    test('touch keypad accepts 77, continues once, and does not resume completed combat', async () => {
        const h = questionHarness();
        h.tap('7'); h.tap('7'); h.tap('ENTER'); h.tap('ENTER');
        await flushAnswer();
        expect(h.check).toHaveBeenCalledTimes(1);
        expect(h.check).toHaveBeenCalledWith('77');
        h.timers[0].callback(); h.timers[0].callback();
        expect(h.onSuccess).toHaveBeenCalledTimes(1);
        expect(h.scene.physics.resume).not.toHaveBeenCalled();
        expect(h.keyboard.listenerCount('keydown')).toBe(0);
    });

    test('keyboard supports a wrong answer followed by backspace and the correct answer', async () => {
        const h = questionHarness();
        h.key('2'); h.key('3'); h.key('Enter'); await flushAnswer();
        expect(h.timers).toHaveLength(0);
        h.key('7'); h.key('8'); h.key('Backspace'); h.key('7'); h.key('Enter');
        await flushAnswer(); h.timers[0].callback();
        expect(h.onSuccess).toHaveBeenCalledTimes(1);
        expect(h.check.mock.calls).toEqual([['23'], ['77']]);
    });

    test('failed answer checks permit retry rather than stranding the keypad', async () => {
        const h = questionHarness(jest.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(true));
        h.tap('7'); h.tap('7'); h.tap('ENTER'); await flushAnswer();
        expect(h.elements.find(item => item.text === 'ENTER').setInteractive).toHaveBeenCalledTimes(2);
        h.tap('ENTER'); await flushAnswer(); h.timers[0].callback();
        expect(h.onSuccess).toHaveBeenCalledTimes(1);
    });

    test.each(['skip', 'shutdown'])('ignores late answer results after %s', async route => {
        let resolve;
        const h = questionHarness(() => new Promise(done => { resolve = done; }));
        h.tap('7'); h.tap('7'); h.tap('ENTER');
        if (route === 'skip') h.tap('[ CONTINUE WITHOUT MESSAGE ]');
        else h.scene.events.emit('shutdown');
        resolve(true); await flushAnswer();
        expect(h.timers).toHaveLength(0);
        expect(h.onSuccess).not.toHaveBeenCalled();
        expect(h.onSkip).toHaveBeenCalledTimes(route === 'skip' ? 1 : 0);
        expect(h.keyboard.listenerCount('keydown')).toBe(0);
        expect(h.scene.birthdayCelebrationElements).toEqual([]);
    });
});
