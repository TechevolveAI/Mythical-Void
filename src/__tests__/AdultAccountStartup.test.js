const fs = require('fs');
const path = require('path');
const vm = require('vm');
const GameState = require('../systems/GameState.js');
const { server, authClient } = require('../test-support/adultAccountFixture.js');
const loadClass = file => vm.runInNewContext(fs.readFileSync(path.join(__dirname, file), 'utf8')
    .replace('export default class', 'module.exports = class'),
    { module: { exports: {} }, window, localStorage, document, Date, Promise, AbortController, URLSearchParams,
        setTimeout: (...args) => setTimeout(...args), clearTimeout: (...args) => clearTimeout(...args) });
const Store = loadClass('../systems/LocalAdventureStore.js');
const Manager = loadClass('../systems/AdultAccountManager.js');
const Menu = loadClass('../ui/AdultAccountMenu.js');
const loadSetup = (createFirebaseAdultClient, env) => {
    const source = fs.readFileSync(path.join(__dirname, '../systems/setupAdultAccounts.js'), 'utf8')
        .replace(/^import .*;\n/gm, '').replaceAll('import.meta.env', 'env')
        .replace("await import('./FirebaseAdultClient.js')", '({ createFirebaseAdultClient: fakeClient })')
        .replace('export default async function', 'module.exports = async function');
    return vm.runInNewContext(source, { module: { exports: {} }, env, fakeClient: createFirebaseAdultClient,
        AdultAccountManager: Manager, AdultAccountMenu: Menu, window, document });
};
let state, mounting;
beforeEach(() => {
    localStorage.clear(); state = new GameState();
    for (const method of ['log', 'warn', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => { mounting?.destroy(); mounting = null; state.stopAutoSave(); document.body.replaceChildren(); jest.restoreAllMocks(); });
test('disabled or unconfigured builds make no adult auth client and leave local play available', async () => {
    const createFirebaseAdultClient = jest.fn(); const store = new Store();
    for (const env of [{}, { VITE_ENABLE_ADULT_ACCOUNTS: 'false' }, { VITE_ENABLE_ADULT_ACCOUNTS: 'true' }, { MODE: 'itch', VITE_ENABLE_ADULT_ACCOUNTS: 'true', VITE_FIREBASE_PROJECT_ID: 'demo-mythical-adult', VITE_FIREBASE_API_KEY: 'synthetic', VITE_FIREBASE_AUTH_DOMAIN: 'demo-mythical-adult.firebaseapp.com', VITE_FIREBASE_APP_ID: 'synthetic-app', VITE_ADULT_ACCOUNT_API_URL: 'https://game.example.test/accounts' }, { MODE: 'continuity', VITE_ENABLE_ADULT_ACCOUNTS: 'true', VITE_FIREBASE_PROJECT_ID: 'demo-mythical-adult', VITE_FIREBASE_API_KEY: 'synthetic', VITE_FIREBASE_AUTH_DOMAIN: 'demo-mythical-adult.firebaseapp.com', VITE_FIREBASE_APP_ID: 'synthetic-app', VITE_ADULT_ACCOUNT_API_URL: 'https://game.example.test/accounts' }]) {
        expect(await loadSetup(createFirebaseAdultClient, env)(state, { store }, () => true)).toBeNull();
    }
    expect(createFirebaseAdultClient).not.toHaveBeenCalled(); expect(state.canPersistSave()).toBe(true);
});
test('fresh devices can open the account flow before hatching, then cleanly retire the tab', async () => {
    server(); const client = authClient(1, false), createFirebaseAdultClient = jest.fn(() => client);
    const adventures = { store: new Store(), open: jest.fn(), finish: jest.fn() };
    mounting = await loadSetup(createFirebaseAdultClient, { VITE_ENABLE_ADULT_ACCOUNTS: 'true', VITE_FIREBASE_PROJECT_ID: 'demo-mythical-adult', VITE_FIREBASE_API_KEY: 'synthetic', VITE_FIREBASE_AUTH_DOMAIN: 'demo-mythical-adult.firebaseapp.com', VITE_FIREBASE_APP_ID: 'synthetic-app', VITE_ADULT_ACCOUNT_API_URL: 'https://game.example.test/accounts' })(state, adventures, () => true);
    expect(createFirebaseAdultClient.mock.calls[0][0].projectId).toBe('demo-mythical-adult');
    expect(document.querySelector('.account-entry-button')).toBeNull();
    state.initialized = true; state.emit('initialized');
    document.querySelector('.account-entry-button').click();
    expect(adventures.open).toHaveBeenCalled(); expect(document.body.textContent).toContain('Under 18');
    window.AdultAccountMenu.close();
    state.state.creature.hatched = true; state.emit('changed:creature.hatched');
    expect(document.querySelector('.account-entry-button')).toBeNull();
    mounting.destroy(); mounting = null;
    expect(window.AdultAccounts).toBeUndefined(); expect(adventures.openAccount).toBeNull();
    expect(client.auth.stopAutoRefresh).toHaveBeenCalled();
});
