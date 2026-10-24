const fs = require('fs');
const path = require('path');
const vm = require('vm');
const GameState = require('../systems/GameState.js');
const { id, Storage, server, authClient } = require('../test-support/adultAccountFixture.js');
const load = file => vm.runInNewContext(fs.readFileSync(path.join(__dirname, file), 'utf8')
    .replace('export default class', 'module.exports = class'),
    { module: { exports: {} }, window, localStorage, document, Date, Promise, AbortController, URLSearchParams, setTimeout: (...args) => setTimeout(...args), clearTimeout: (...args) => clearTimeout(...args) });
const Store = load('../systems/LocalAdventureStore.js');
const Manager = load('../systems/AdultAccountManager.js');
const Menu = load('../ui/AdultAccountMenu.js');
const ORIGINAL = 'mythical-creature-save';
const ACTIVE = 'mythical-void-active-adventure';
const settle = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };

describe('optional adult accounts across devices', () => {
    let backend, devices, next;
    function device({ account = 1, signedIn = true, age = 'age_18_plus', name = 'Test Fern' } = {}) {
        const storage = new Storage();
        if (age) storage.setItem('mythical_void_age_group', age);
        const state = new GameState(); state.initialized = true;
        state.state.creature.name = name;
        state.state.creature.hatched = true;
        state.state.creature.genes = { id: 'synthetic-creature' };
        state.state.session.gameStarted = true;
        const store = new Store({ storage, newId: () => id(next++) });
        storage.setItem(ORIGINAL, JSON.stringify(state.createSaveSnapshot()));
        const client = authClient(account, signedIn);
        let current = true;
        const manager = new Manager({ client, gameState: state, store, storage,
            fetcher: backend.fetcher, newId: () => id(next++), isCurrent: () => current,
            mediaClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'anonymous-token' } } }) } }) });
        const value = { storage, state, store, client, manager, retire: () => { current = false; manager.destroy(); } };
        devices.push(value); return value;
    }
    beforeEach(() => {
        jest.useFakeTimers(); process.env.ENABLE_ADULT_ACCOUNTS = 'true'; next = 100;
        localStorage.clear(); devices = []; backend = server();
        for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
    });
    afterEach(() => {
        devices.forEach(d => { d.manager.destroy(); d.state.stopAutoSave(); });
        jest.restoreAllMocks(); jest.useRealTimers(); document.body.replaceChildren();
        delete process.env.ENABLE_ADULT_ACCOUNTS;
    });
    test('under-18 players never see an email field or make auth requests', async () => {
        const { manager, client, storage } = device({ signedIn: false, age: null });
        const menu = new Menu(manager); menu.open();
        expect(document.querySelector('[type=email]')).toBeNull();
        [...document.querySelectorAll('button')].find(b => b.textContent === 'Under 18').click();
        expect(document.body.textContent).toContain('keep playing without one');
        expect(document.querySelector('[type=email]')).toBeNull();
        expect(storage.getItem('mythical_void_age_group')).toBeNull();
        await expect(manager.requestLink('adult@example.test', { consent: true })).rejects.toMatchObject({ code: 'adults_only' });
        expect(client.auth.requestEmailLink).not.toHaveBeenCalled(); menu.close();
    });
    test.each(['age_under_13', 'age_13_15', 'age_16_17'])('existing %s profile cannot open adult sign-up', async age => {
        const { manager, client } = device({ age }); await manager.initialize();
        expect(() => manager.declareAge(true)).toThrow();
        expect(client.auth.getSession).not.toHaveBeenCalled();
    });
    test('email link sign-up requires consent, has a cooldown and stores no email in game saves', async () => {
        const { manager, client, storage } = device({ signedIn: false });
        await expect(manager.requestLink('adult@example.test')).rejects.toMatchObject({ code: 'consent_required' });
        await manager.requestLink('adult@example.test', { consent: true });
        expect(client.auth.requestEmailLink).toHaveBeenCalledWith('adult@example.test');
        await expect(manager.requestLink('adult@example.test', { consent: true })).rejects.toMatchObject({ code: 'wait_before_resending' });
        await manager.completeLink('adult@example.test', { consent: true });
        expect(manager.phase).toBe('signed_in');
        expect([...storage.map.values()].join()).not.toContain('adult@example.test');
        expect(backend.rows.size).toBe(0);
    });
    test('expired email links keep local play available', async () => {
        const { manager, client } = device({ signedIn: false });
        await manager.requestLink('adult@example.test', { consent: true, existing: true });
        client.auth.completeEmailLink.mockResolvedValueOnce({ error: { message: 'expired' } });
        await expect(manager.completeLink('adult@example.test', { consent: true })).rejects.toMatchObject({ code: 'invalid_or_expired_link' });
        expect(manager.phase).toBe('link_sent');
    });
    test('a verified email link survives a setup outage and can finish without a second email', async () => {
        const { manager } = device({ signedIn: false });
        await manager.requestLink('adult@example.test', { consent: true });
        backend.fetcher.mockRejectedValueOnce(new Error('offline'));
        await expect(manager.completeLink('adult@example.test', { consent: true })).rejects.toMatchObject({ code: 'accounts_unavailable' });
        expect(manager.phase).toBe('finish_setup');
        await manager.finishSetup(); expect(manager.phase).toBe('signed_in');
    });
    test('two devices continue a selected creature without overwriting an existing local adventure', async () => {
        const one = device(); await one.manager.initialize(); await one.manager.attachCurrent();
        const two = device({ name: 'Test Moss' }); const original = two.storage.getItem(ORIGINAL);
        two.state.state.safety.guardian.pinHash = 'synthetic-device-pin';
        await two.manager.initialize(); expect(two.manager.library[0].display_name).toBe('Test Fern');
        const key = await two.manager.openAdventure(one.manager.binding().id);
        expect(key).not.toBe(ORIGINAL); expect(two.storage.getItem(ORIGINAL)).toBe(original);
        const downloaded = JSON.parse(two.storage.getItem(key));
        expect(downloaded.creature.name).toBe('Test Fern');
        expect(downloaded.game.cloudSavePausedForNewGame).toBe(true);
        expect(downloaded.safety.guardian.pinHash).toBe('synthetic-device-pin');
        expect(two.store.activeKey()).toBe(key);
        expect(two.state.prepareSaveCandidate(downloaded).state.creature.name).toBe('Test Fern');
    });
    test('a newer device save causes a conflict without changing local play or either creature', async () => {
        const one = device(); await one.manager.initialize(); await one.manager.attachCurrent();
        const two = device(); await two.manager.initialize();
        const key = await two.manager.openAdventure(one.manager.binding().id);
        const resumed = new GameState(); resumed.selectLocalAdventure(key);
        resumed.state = resumed.prepareSaveCandidate(two.storage.getItem(key)).state; resumed.initialized = true;
        two.state = resumed; two.manager.gameState = resumed;
        two.state.state.creature.name = 'Test Comet'; await two.manager.flush();
        one.state.state.creature.name = 'Test Fern Again';
        await expect(one.manager.flush()).rejects.toMatchObject({ code: 'adventure_changed' });
        expect(one.manager.syncStatus).toBe('conflict'); expect(one.state.canPersistSave()).toBe(true);
        expect([...backend.rows.values()][0].game_state.creature.name).toBe('Test Comet');
        await one.manager.saveAsSeparateAdventure(); expect(backend.rows.size).toBe(2);
    });
    test('lost upload response is reconciled by operation id on retry', async () => {
        const { manager } = device(); await manager.initialize();
        const normal = backend.fetcher.getMockImplementation();
        backend.fetcher.mockImplementationOnce(async (...args) => { await normal(...args); throw new Error('response lost'); });
        await expect(manager.attachCurrent()).rejects.toThrow();
        expect(manager.binding().pendingOperationId).toBeTruthy(); expect([...backend.rows.values()][0].revision).toBe(1);
        await manager.flush(); expect(manager.syncStatus).toBe('saved');
        expect(manager.binding().revision).toBe(1); expect(backend.rows.size).toBe(1);
    });
    test('pending operation survives reload and a later device update is not overwritten', async () => {
        const d = device(); await d.manager.initialize(); await d.manager.attachCurrent();
        const binding = d.manager.binding(); d.manager.writeBinding(ORIGINAL, { ...binding, pendingOperationId: id(999) });
        [...backend.rows.values()][0].revision++;
        await d.manager.reconcile(); expect(d.manager.syncStatus).toBe('conflict');
        const calls = backend.fetcher.mock.calls.length; await d.manager.flush();
        expect(backend.fetcher.mock.calls.length).toBe(calls);
    });
    test('tokens, email, guardian data and temporary media links never leave in snapshots', async () => {
        const { manager, state } = device(); await manager.initialize();
        state.state.safety.kidProfile.nickname = 'Synthetic private label';
        state.state.creature.email = 'fictional@example.test';
        state.state.creature.privateMedia = { assetRef: 'portrait-job-v1:' + id(50), imageUrl: 'https://example.test/signed', expiresAt: 999 };
        await manager.attachCurrent();
        const sent = JSON.parse(backend.fetcher.mock.calls.find(([, o]) => o.body?.includes('"action":"save"'))[1].body).state;
        expect(sent.session).toBeUndefined(); expect(sent.safety).toBeUndefined();
        expect(sent.creature.email).toBeUndefined(); expect(sent.creature.privateMedia.imageUrl).toBeUndefined();
        expect(sent.creature.privateMedia.assetRef).toBeTruthy();
    });
    test('quota failure before binding prevents any upload', async () => {
        const { manager, storage } = device(); await manager.initialize(); backend.fetcher.mockClear();
        jest.spyOn(storage, 'setItem').mockImplementation(() => { throw Error('quota'); });
        await expect(manager.attachCurrent()).rejects.toThrow(); expect(backend.fetcher).not.toHaveBeenCalled();
    });
    test('failed import selection keeps the original save and leaves the downloaded copy discoverable', async () => {
        const one = device(); await one.manager.initialize(); await one.manager.attachCurrent();
        const two = device(); await two.manager.initialize(); const original = two.storage.getItem(ORIGINAL);
        const set = two.storage.setItem.bind(two.storage);
        jest.spyOn(two.storage, 'setItem').mockImplementation((k, v) => { if (k === ACTIVE) throw Error('quota'); set(k, v); });
        await expect(two.manager.openAdventure(one.manager.binding().id)).rejects.toThrow();
        expect(two.storage.getItem(ORIGINAL)).toBe(original); expect(two.store.activeKey()).toBe(ORIGINAL);
        expect(two.store.list()).toHaveLength(2);
    });
    test('sign out retains local saves and a different account cannot silently claim a bound adventure', async () => {
        const d = device(); await d.manager.initialize(); await d.manager.attachCurrent(); const original = d.storage.getItem(ORIGINAL);
        await d.manager.signOut(); expect(d.storage.getItem(ORIGINAL)).toBe(original);
        expect(d.manager.user).toBeNull(); d.client.switchUser(2); d.manager.phase = 'signed_in';
        await expect(d.manager.attachCurrent()).rejects.toMatchObject({ code: 'different_account' });
    });
    test('remote removal cannot be undone by a stale device; account deletion retains local saves', async () => {
        const one = device(); await one.manager.initialize(); await one.manager.attachCurrent();
        const two = device(); await two.manager.initialize(); await two.manager.openAdventure(one.manager.binding().id);
        const binding = one.manager.binding(); await one.manager.removeAdventure(binding.id, binding.revision);
        await expect(two.manager.flush()).resolves.toBeUndefined();
        expect(two.manager.syncStatus).toBe('removed');
        const original = one.storage.getItem(ORIGINAL); await one.manager.deleteAccount();
        expect(one.storage.getItem(ORIGINAL)).toBe(original); expect(backend.rows.size).toBe(0);
    });
    test('late network replies after tab retirement cannot select or publish an adventure', async () => {
        const one = device(); await one.manager.initialize(); await one.manager.attachCurrent();
        const two = device(); await two.manager.initialize();
        const normal = backend.fetcher.getMockImplementation(); let resolve;
        backend.fetcher.mockImplementationOnce(async (...args) => { const response = await normal(...args); return new Promise(done => { resolve = () => done(response); }); });
        const pending = two.manager.openAdventure(one.manager.binding().id); await settle(); two.retire(); resolve();
        await expect(pending).rejects.toMatchObject({ code: 'session_changed' }); expect(two.store.list()).toHaveLength(1);
    });
    test('new progress during an upload gets a follow-up upload', async () => {
        const d = device(); await d.manager.initialize(); await d.manager.attachCurrent();
        const normal = backend.fetcher.getMockImplementation(); let resolve;
        backend.fetcher.mockImplementationOnce(async (...args) => { const response = await normal(...args); return new Promise(done => { resolve = () => done(response); }); });
        d.state.state.creature.name = 'Test Earlier';
        const pending = d.manager.flush(); await settle();
        d.state.state.creature.name = 'Test Later'; d.manager.schedule();
        jest.advanceTimersByTime(2000); await settle(); resolve(); await pending;
        jest.advanceTimersByTime(2000); await settle();
        expect([...backend.rows.values()][0].game_state.creature.name).toBe('Test Later');
    });
    test('idle time and unchanged autosaves do not create new remote revisions', async () => {
        const d = device(); await d.manager.initialize(); await d.manager.attachCurrent();
        backend.fetcher.mockClear();
        d.state.state.savedAt += 30000; d.state.state.player.playTime += 30000;
        d.state.state.player.lastPlayed = Date.now() + 30000;
        await d.manager.flush(); expect(backend.fetcher).not.toHaveBeenCalled();
        expect([...backend.rows.values()][0].revision).toBe(1);
        d.manager.isVisible = () => false; d.state.state.creature.name = 'Test Hidden';
        d.manager.schedule(); jest.advanceTimersByTime(30000); await settle();
        expect(backend.fetcher).not.toHaveBeenCalled();
    });
    test('a selected download cannot receive writes from the previous running adventure', async () => {
        const one = device(); await one.manager.initialize(); await one.manager.attachCurrent();
        const two = device({ name: 'Test Other' }); await two.manager.initialize();
        await two.manager.openAdventure(one.manager.binding().id);
        await expect(two.manager.flush()).rejects.toMatchObject({ code: 'open_adventure_first' });
        expect([...backend.rows.values()][0].game_state.creature.name).toBe('Test Fern');
    });
    test('a valid account download is still available when an old local save is unreadable', async () => {
        const one = device(); await one.manager.initialize(); await one.manager.attachCurrent();
        const two = device(); two.state.initialized = false; two.storage.setItem(ORIGINAL, '{ unreadable');
        two.storage.setItem(ACTIVE, 'invalid-local-selection');
        await two.manager.initialize();
        expect(two.manager.binding()).toBeNull();
        const menu = new Menu(two.manager); menu.open(); expect(document.querySelector('[role=dialog]')).not.toBeNull(); menu.close();
        const key = await two.manager.openAdventure(one.manager.binding().id);
        expect(two.storage.getItem(ORIGINAL)).toBe('{ unreadable');
        expect(JSON.parse(two.storage.getItem(key)).creature.name).toBe('Test Fern');
    });
    test('unsettled Fusion and protected saves never get published as account copies', async () => {
        const d = device(); await d.manager.initialize();
        d.state.state.breedingShrine.pendingFusion = { operationId: 'synthetic-operation', authorityReservation: { reservationMode: 'server_reserved' } };
        await expect(d.manager.attachCurrent()).rejects.toMatchObject({ code: 'save_in_progress' });
        expect(backend.rows.size).toBe(0);
        d.state.holdSaveAdmission({ code: 'synthetic_hold' });
        await expect(d.manager.attachCurrent()).rejects.toMatchObject({ code: 'open_adventure_first' });
    });
    test('media access becomes invalid on sign out and never changes anonymous generation auth', async () => {
        const { manager } = device(); await manager.initialize(); await manager.attachCurrent();
        const access = await manager.mediaRequest('/.netlify/functions/generate-ai-art?assetRef=fictional', 'anonymous-token');
        expect(access.token).toBe('adult-token-1'); expect(access.url).toContain('accountAdventure=');
        await manager.signOut(); expect(() => access.assertCurrent()).toThrow();
        expect(await manager.mediaRequest('/path?x=1', 'anonymous-token')).toEqual({ url: '/path?x=1', token: 'anonymous-token' });
    });
    test('a revoked sign-in returns to the email form without changing the local adventure', async () => {
        const d = device(); await d.manager.initialize(); await d.manager.attachCurrent();
        const original = d.storage.getItem(ORIGINAL); backend.tokens.delete('adult-token-1');
        await expect(d.manager.refreshLibrary()).rejects.toMatchObject({ code: 'sign_in_required' });
        expect(d.manager.phase).toBe('signed_out'); expect(d.manager.user).toBeNull();
        expect(d.storage.getItem(ORIGINAL)).toBe(original); expect(d.state.canPersistSave()).toBe(true);
    });
    test('an offline auth refresh keeps the account available for a later retry', async () => {
        const d = device(); await d.manager.initialize();
        d.client.auth.getSession.mockResolvedValueOnce({ error: { message: 'offline' } });
        await expect(d.manager.refreshLibrary()).rejects.toMatchObject({ code: 'accounts_unavailable' });
        expect(d.manager.user).toBeTruthy(); expect(d.manager.phase).toBe('signed_in');
        await d.manager.refreshLibrary();
    });
    test('form refresh keeps typed email and consent, and closing restores the parent', async () => {
        const { manager } = device({ signedIn: false }); const parent = document.createElement('div'); document.body.append(parent);
        const menu = new Menu(manager); menu.open(parent);
        document.querySelector('[type=email]').value = 'adult@example.test'; document.querySelector('[type=checkbox]').checked = true;
        manager.emit(); expect(document.querySelector('[type=email]').value).toBe('adult@example.test');
        expect(document.querySelector('[type=checkbox]').checked).toBe(true); expect(parent.inert).toBe(true);
        menu.close(); expect(parent.inert).toBe(false); expect(document.querySelector('[role=dialog]')).toBeNull();
    });
});
