const fs = require('fs');
const path = require('path');
const vm = require('vm');
const GameStateManager = require('../systems/GameState.js');

const source = fs.readFileSync(path.join(__dirname, '../utils/GameTabSession.js'), 'utf8');
const GameTabSession = vm.runInNewContext(
    source.replace('export default class GameTabSession', 'class GameTabSession') + '\nGameTabSession;',
    { Promise, navigator, document, window }
);

// Model the browser's shared lock table, including the callback's full lifetime.
function sharedLocks() {
    const held = new Set();
    return { request: jest.fn((name, options, callback) => Promise.resolve().then(() => {
        if (held.has(name)) return callback(null);
        held.add(name);
        return Promise.resolve(callback({ name, mode: 'exclusive' })).finally(() => held.delete(name));
    })) };
}

function tab(locks, onRetired = () => {}) {
    const doc = document.implementation.createHTMLDocument('Synthetic tab');
    const handlers = new Map();
    const win = { location: { reload: jest.fn() },
        addEventListener: (name, handler) => handlers.set(name, handler) };
    const session = new GameTabSession({ lockManager: locks, documentRef: doc, windowRef: win, onRetired });
    return { doc, win, session, event: (name, data = {}) => handlers.get(name)?.(data) };
}

const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('one game writer across browser tabs', () => {
    let tabs;
    beforeEach(() => { tabs = []; localStorage.clear(); });
    afterEach(async () => {
        for (const t of tabs) t.session.retire();
        await settle();
        jest.restoreAllMocks();
    });
    const create = (locks, onRetired) => { const t = tab(locks, onRetired); tabs.push(t); return t; };

    test('a second opening cannot initialise or overwrite the first hatch, then loads its latest name on handover', async () => {
        const locks = sharedLocks();
        const firstState = new GameStateManager();
        const first = create(locks, () => {
            firstState.save();
            firstState.holdSaveAdmission({ code: 'game_tab_retired' }, 'browser_tab');
        });
        expect(await first.session.waitUntilReady()).toBe(true);
        firstState.set('session.gameStarted', true);
        firstState.set('creature.hatched', true);
        firstState.set('creature.genes', { id: 'fictional-tab-hatch' });
        expect(firstState.save()).toBe(true);
        const second = create(locks);
        let secondState;
        const initialiseSecond = jest.fn(() => {
            secondState = new GameStateManager();
            secondState.load();
        });
        const secondReady = second.session.waitUntilReady().then(ready => { if (ready) initialiseSecond(); });
        await settle();
        expect(initialiseSecond).not.toHaveBeenCalled();
        expect(second.doc.body.textContent).toContain('Your game is open in another tab');
        firstState.set('creature.name', 'Sprout Test');
        firstState.set('creature.named', true);
        expect(firstState.save()).toBe(true);
        const saved = localStorage.getItem(firstState.saveKey);
        second.doc.querySelector('button').click();
        await settle();
        expect(initialiseSecond).not.toHaveBeenCalled();
        expect(localStorage.getItem(firstState.saveKey)).toBe(saved);
        first.event('pagehide');
        await first.session.request;
        expect(firstState.save()).toBe(false);
        second.doc.querySelector('button').click();
        await secondReady;
        expect(initialiseSecond).toHaveBeenCalledTimes(1);
        expect(secondState.get('creature.name')).toBe('Sprout Test');
        expect(secondState.get('creature.genes.id')).toBe('fictional-tab-hatch');
        expect(second.doc.querySelector('[role="dialog"]')).toBeNull();
    });

    test('simultaneous starts and repeated Continue clicks admit exactly one tab', async () => {
        const locks = sharedLocks();
        const first = create(locks), second = create(locks), third = create(locks);
        first.session.waitUntilReady(); second.session.waitUntilReady(); third.session.waitUntilReady();
        await settle();
        expect([first, second, third].filter(t => t.session.owned)).toHaveLength(1);
        const calls = locks.request.mock.calls.length;
        const button = second.doc.querySelector('button');
        button.click(); button.click(); button.click();
        await settle();
        expect(locks.request).toHaveBeenCalledTimes(calls + 1);
        expect(second.session.owned).toBe(false);
        first.event('pagehide');
        await first.session.request;
        second.doc.querySelector('button').click(); third.doc.querySelector('button').click();
        await settle();
        expect([second, third].filter(t => t.session.owned)).toHaveLength(1);
    });

    test('a waiting tab that leaves before the lock callback never starts a game', async () => {
        const locks = sharedLocks();
        const leaving = create(locks);
        const result = leaving.session.waitUntilReady();
        leaving.event('pagehide');
        expect(await result).toBe(false);
        await settle();
        expect(leaving.session.owned).toBe(false);
        expect(await create(locks).session.waitUntilReady()).toBe(true);
    });

    test('back/forward restoration reloads before a retired tab may play again', async () => {
        const first = create(sharedLocks(), jest.fn());
        await first.session.waitUntilReady();
        first.event('pagehide', { persisted: true });
        first.event('pageshow', { persisted: true });
        expect(first.session.owned).toBe(false);
        expect(first.win.location.reload).toHaveBeenCalledTimes(1);
        first.session.tryAcquire();
        expect(first.session.owned).toBe(false);
    });

    test('ordinary pageshow and backgrounding do not relinquish the active writer', async () => {
        const first = create(sharedLocks(), jest.fn());
        await first.session.waitUntilReady();
        first.event('pageshow', { persisted: false });
        first.event('visibilitychange', { hidden: true });
        expect(first.session.owned).toBe(true);
        expect(first.win.location.reload).not.toHaveBeenCalled();
        expect(first.session.onRetired).not.toHaveBeenCalled();
    });

    test.each(['missing', 'throw', 'reject'])('%s browser locking never starts an unprotected game', async mode => {
        const locks = mode === 'missing' ? null : { request: () => {
            if (mode === 'throw') throw Error('synthetic lock failure');
            return Promise.reject(Error('synthetic lock failure'));
        } };
        const t = create(locks), start = jest.fn();
        t.session.waitUntilReady().then(ready => { if (ready) start(); });
        await settle();
        expect(start).not.toHaveBeenCalled();
        expect(t.doc.body.textContent).toContain('Your game is waiting');
        expect(t.doc.querySelector('button').disabled).toBe(false);
        expect(localStorage.getItem('mythical-creature-save')).toBeNull();
    });

    test('a temporary lock failure can retry successfully without changing save data', async () => {
        const locks = sharedLocks();
        locks.request.mockImplementationOnce(() => Promise.reject(Error('synthetic temporary refusal')));
        const t = create(locks);
        const ready = t.session.waitUntilReady();
        await settle();
        t.doc.querySelector('button').click();
        expect(await ready).toBe(true);
        expect(localStorage.getItem('mythical-creature-save')).toBeNull();
    });

    test('the waiting dialog has a labelled heading and keeps keyboard focus on its action', async () => {
        const locks = sharedLocks();
        await create(locks).session.waitUntilReady();
        const t = create(locks);
        t.session.waitUntilReady();
        await settle();
        const dialog = t.doc.querySelector('[role="dialog"]');
        expect(t.doc.getElementById(dialog.getAttribute('aria-labelledby')).textContent).toContain('another tab');
        const button = t.doc.querySelector('button');
        const focus = jest.spyOn(button, 'focus');
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
        button.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(focus).toHaveBeenCalledTimes(1);
    });
});
