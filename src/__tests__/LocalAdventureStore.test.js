const fs = require('fs');
const path = require('path');
const vm = require('vm');
const GameStateManager = require('../systems/GameState.js');
const CloudSaveManager = require('../systems/CloudSaveManager.js');
const load = (file, extras = {}) => vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/import .*;\n/g, '')
        .replace('export default class', 'module.exports = class'),
    { module: { exports: {} }, document, window, localStorage, Date, Promise, ...extras }
);
const LocalAdventureStore = load('../systems/LocalAdventureStore.js');
const AdventureMenu = load('../ui/AdventureMenu.js', { LocalAdventureStore });
const SaveRecoveryGate = load('../ui/SaveRecoveryGate.js');
const ORIGINAL = 'mythical-creature-save';
const ACTIVE = 'mythical-void-active-adventure';
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
const newKey = id => `mythical-creature-adventure-${id}`;
const click = label => [...document.querySelectorAll('button')].find(b => b.textContent === label).click();

describe('independent adventures and a fresh start without losing the old game', () => {
    let state, store, managers, menus, gates, next;
    beforeEach(() => {
        jest.useFakeTimers();
        localStorage.clear();
        sessionStorage.clear();
        managers = []; menus = []; gates = []; next = 0;
        state = createState();
        store = new LocalAdventureStore({ storage: localStorage, newId: () => ids[next++] });
    });
    const createState = () => { const s = new GameStateManager(); managers.push(s); return s; };
    const createMenu = (gameState = state, options = {}) => {
        const menu = new AdventureMenu(gameState, { store, document, reload: jest.fn(), getGame: () => null, ...options });
        menus.push(menu); return menu;
    };
    afterEach(() => {
        managers.forEach(s => s.stopAutoSave());
        menus.forEach(m => m.close()); gates.forEach(g => g.destroy());
        jest.restoreAllMocks(); jest.useRealTimers(); document.body.replaceChildren();
    });
    const saveNamed = (name = 'Test Sprout') => {
        state.set('creature.name', name);
        state.set('session.gameStarted', true);
        expect(state.save()).toBe(true);
        return localStorage.getItem(ORIGINAL);
    };

    test('a first visit goes to the egg without an extra chooser', async () => {
        expect(await createMenu().chooseAtStartup()).toBe(ORIGINAL);
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        expect(store.cloudOptions(ORIGINAL)).toEqual({});
    });

    test('refresh offers continue or new; continue reads the chosen name', async () => {
        const original = saveNamed();
        const freshInstance = createState(), menu = createMenu(freshInstance);
        const choice = menu.chooseAtStartup();
        expect(document.body.textContent).toContain('Ready for an adventure?');
        click('Continue with Test Sprout');
        freshInstance.selectLocalAdventure(await choice);
        expect(freshInstance.load()).toBe(true);
        expect(freshInstance.get('creature.name')).toBe('Test Sprout');
        expect(JSON.parse(original).creature.name).toBe('Test Sprout');
    });

    test('a fresh adventure persists, can be named and reopened, and keeps its predecessor byte-for-byte', async () => {
        const original = saveNamed();
        const menu = createMenu();
        const choice = menu.chooseAtStartup();
        click('Start a new adventure');
        const key = await choice;
        expect(key).toBe(newKey(ids[0]));
        expect(store.activeKey()).toBe(key);
        expect(localStorage.getItem(ORIGINAL)).toBe(original);
        const fresh = createState(); fresh.selectLocalAdventure(key); fresh.init();
        expect(fresh.get('session.gameStarted')).toBe(false);
        expect(fresh.get('creature.name')).toBe('Your Creature');
        expect(fresh.get('game.cloudSavePausedForNewGame')).toBe(true);
        fresh.set('creature.name', 'Test Pebble'); fresh.set('session.gameStarted', true);
        expect(fresh.save()).toBe(true);
        const nextMenu = createMenu(createState()), nextChoice = nextMenu.chooseAtStartup();
        click('Continue with Test Pebble');
        const reopened = createState(); reopened.selectLocalAdventure(await nextChoice);
        expect(reopened.load()).toBe(true);
        expect(reopened.get('creature.name')).toBe('Test Pebble');
        expect(localStorage.getItem(ORIGINAL)).toBe(original);
        store.select(ORIGINAL);
        const previous = createState(); previous.selectLocalAdventure(store.activeKey());
        expect(previous.load()).toBe(true);
        expect(previous.get('creature.name')).toBe('Test Sprout');
    });

    test('a new egg opens once after restart, but a later refresh can still choose the old creature', async () => {
        saveNamed();
        createMenu().startNew();
        const key = store.activeKey();
        expect(await createMenu(createState()).chooseAtStartup()).toBe(key);
        const later = createMenu(createState());
        later.chooseAtStartup();
        expect(document.body.textContent).toContain('Other adventures');
        expect(document.body.textContent).toContain('Test Sprout');
        expect(document.body.textContent).toContain('Continue adventure');
    });

    test.each(['corrupt', 'future', 'cloud'])('%s save can start separately without changing old save or recovery evidence', mode => {
        if (mode === 'corrupt') localStorage.setItem(ORIGINAL, '{unreadable-save');
        if (mode === 'future') localStorage.setItem(ORIGINAL, JSON.stringify({ ...state.createInitialState(), version: '9.0.0' }));
        if (mode === 'cloud') {
            expect(state.save()).toBe(true);
            state.beginCloudWrite('mutation', state.createSaveSnapshot());
            state.protectCloudWrite(state.cloudWriteLease);
        }
        const held = createState(); held.init();
        expect(held.getSaveAdmission().status).toBe('held');
        const before = { ...localStorage };
        const menu = createMenu(held);
        const gate = new SaveRecoveryGate(held, { pause: jest.fn(), onNewAdventure: () => menu.startNew() });
        gates.push(gate);
        click('Start a new adventure');
        expect(menu.reload).toHaveBeenCalledTimes(1);
        expect(held.getSaveAdmission().status).toBe('held');
        Object.entries(before).forEach(([key, value]) => expect(localStorage.getItem(key)).toBe(value));
        const fresh = createState(); fresh.selectLocalAdventure(store.activeKey()); fresh.init();
        expect(fresh.initialized).toBe(true);
        expect(fresh.getSaveAdmission().status).toBe('ready');
        expect(fresh.getCloudRecoveryStatus().pending).toBe(false);
        expect(fresh.save()).toBe(true);
        Object.entries(before).forEach(([key, value]) => expect(localStorage.getItem(key)).toBe(value));
        const previous = createState(); previous.init();
        expect(previous.getSaveAdmission().status).toBe('held');
    });

    test.each(['silent-drop', 'throw-before-write', 'unreadable'])('%s cannot select an unverified new save', failure => {
        const original = saveNamed();
        const write = Storage.prototype.setItem, read = Storage.prototype.getItem;
        let attempted = false;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === newKey(ids[0])) {
                attempted = true;
                if (failure === 'throw-before-write') throw Error('Synthetic quota');
                if (failure === 'silent-drop') return;
            }
            return write.call(this, key, value);
        });
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
            if (key === newKey(ids[0]) && attempted && failure === 'unreadable') throw Error('Synthetic read failure');
            return read.call(this, key);
        });
        expect(() => store.create(state)).toThrow();
        expect(store.activeKey()).toBe(ORIGINAL);
        expect(localStorage.getItem(ORIGINAL)).toBe(original);
    });

    test('a write that lands before throwing is accepted only after exact read-back', () => {
        const write = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            write.call(this, key, value);
            throw Error('Synthetic acknowledgement error');
        });
        expect(store.create(state)).toBe(newKey(ids[0]));
        expect(store.activeKey()).toBe(newKey(ids[0]));
    });

    test('failed selection keeps both the old adventure and the new discoverable egg', () => {
        const original = saveNamed();
        const write = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (key === ACTIVE) throw Error('Synthetic pointer failure');
            return write.call(this, key, value);
        });
        expect(() => store.create(state)).toThrow();
        expect(store.activeKey()).toBe(ORIGINAL);
        expect(store.list().map(a => a.key)).toEqual([ORIGINAL, newKey(ids[0])]);
        expect(localStorage.getItem(ORIGINAL)).toBe(original);
    });

    test('missing or damaged selection is explained without silently opening a different save', () => {
        saveNamed();
        localStorage.setItem(ACTIVE, newKey(ids[1]));
        const menu = createMenu(); menu.chooseAtStartup();
        expect(document.body.textContent).toContain('could not find your last adventure');
        expect(document.body.textContent).toContain('Other adventures');
        expect(localStorage.getItem(ACTIVE)).toBe(newKey(ids[1]));
    });

    test('cloud preferences and identities are separate; new games keep backup off', async () => {
        localStorage.setItem('mythical_void_age_group', 'age_18_plus');
        localStorage.setItem('mythical_void_cloud_save_enabled', 'true');
        localStorage.setItem('mythical_void_cloud_save_consent', 'true');
        const first = store.create(state), second = store.create(state);
        const options = store.cloudOptions(first);
        expect(options.authStorageKey).not.toBe(store.cloudOptions(second).authStorageKey);
        expect(options.enabledKey).not.toBe(store.cloudOptions(second).enabledKey);
        expect(options.consentKey).not.toBe(store.cloudOptions(second).consentKey);
        const fresh = createState(); fresh.selectLocalAdventure(first); fresh.load();
        const client = { auth: { getSession: jest.fn(), signInAnonymously: jest.fn() } };
        const cloud = new CloudSaveManager({ ...options, client, gameState: fresh, storage: localStorage });
        expect(cloud.saveSlot).toBe('primary');
        await cloud.initialize();
        expect(cloud.getStatus().enabled).toBe(false);
        expect(client.auth.getSession).not.toHaveBeenCalled();
        expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
        expect(localStorage.getItem('mythical_void_cloud_save_enabled')).toBe('true');
        cloud.destroy();
    });

    test('a loaded or held GameState cannot be pointed at another adventure', () => {
        state.selectLocalAdventure(ORIGINAL);
        expect(() => state.selectLocalAdventure(newKey(ids[0]))).toThrow();
        const held = createState(); held.holdSaveAdmission({ code: 'save_unreadable' }, 'test');
        expect(() => held.selectLocalAdventure(newKey(ids[0]))).toThrow();
        const initialized = createState(); initialized.init();
        expect(() => initialized.selectLocalAdventure(newKey(ids[0]))).toThrow();
    });

    test.each([false, true])('fresh stories preserve sound, accessibility and safety preferences (loaded: %s)', initialized => {
        state.set('settings.audioMuted', true);
        state.set('settings.reducedMotion', true);
        state.set('safety.parentalControls.enabled', true);
        state.set('safety.guardian.pinHash', 'synthetic-hash');
        saveNamed();
        const source = createState();
        if (initialized) source.init();
        const key = store.create(source);
        const fresh = JSON.parse(localStorage.getItem(key));
        expect(fresh.settings.audioMuted).toBe(true);
        expect(fresh.settings.reducedMotion).toBe(true);
        expect(fresh.safety.parentalControls.enabled).toBe(true);
        expect(fresh.safety.guardian.pinHash).toBe('synthetic-hash');
        expect(fresh.creature.name).toBe('Your Creature');
    });

    test('names are text, closed adventure lists stay outside the focus trap, and Escape cannot skip startup', () => {
        saveNamed('<img src=x onerror=alert(1)>');
        const menu = createMenu(); menu.chooseAtStartup();
        expect(document.querySelector('img')).toBeNull();
        const dialog = document.querySelector('[role="dialog"]');
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.querySelector('[role="dialog"]')).toBe(dialog);
        const controls = [...dialog.querySelectorAll('button, summary')];
        controls.at(-1).focus();
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(controls[0]);
    });

    test('retired tabs cannot create or select adventures', () => {
        saveNamed();
        const before = { ...localStorage };
        const menu = createMenu(state, { isCurrent: () => false });
        menu.startNew(); menu.choose(ORIGINAL); menu.open();
        expect({ ...localStorage }).toEqual(before);
        expect(menu.reload).not.toHaveBeenCalled();
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
});
