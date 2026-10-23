const fs = require('fs');
const vm = require('vm');
const { Storage } = require('../test-support/adultAccountFixture.js');
const source = fs.readFileSync(require('path').join(__dirname, '../systems/FirebaseAdultClient.js'), 'utf8')
    .replace('export function createFirebaseAdultClient', 'function createFirebaseAdultClient') + '\nmodule.exports = createFirebaseAdultClient;';
const createClient = vm.runInNewContext(source, { module: { exports: {} }, URL, Date });
const config = { apiKey: 'synthetic-public-key', projectId: 'demo-mythical-adult',
    appId: 'synthetic-app', authDomain: 'demo-mythical-adult.firebaseapp.com' };
function fixture(href = 'https://game.example.test/play/') {
    const storage = new Storage(), location = new URL(href), history = { replaceState: jest.fn() };
    const user = { uid: 'FirebaseSyntheticUid', email: 'adult@example.test', emailVerified: true, isAnonymous: false,
        getIdToken: jest.fn(async () => 'synthetic-firebase-token') };
    const auth = { currentUser: null, authStateReady: jest.fn(async () => {}) };
    const sdk = { getApps: jest.fn(() => []), initializeApp: jest.fn(() => ({})), initializeAuth: jest.fn(() => auth),
        browserLocalPersistence: 'synthetic-persistence', onIdTokenChanged: jest.fn(() => jest.fn()),
        connectAuthEmulator: jest.fn(), sendSignInLinkToEmail: jest.fn(async () => {}),
        isSignInWithEmailLink: jest.fn(() => true), signInWithEmailLink: jest.fn(async () => { auth.currentUser = user; return { user }; }),
        signOut: jest.fn(async () => { auth.currentUser = null; }) };
    const loadSdk = jest.fn(async () => sdk);
    const client = createClient(config, { storage, location, history, loadSdk });
    return { client, storage, location, history, sdk, user, auth, loadSdk };
}
test('constructing the optional account menu does not initialise Firebase', () => {
    const f = fixture(); f.client.auth.onAuthStateChange(jest.fn());
    expect(f.loadSdk).not.toHaveBeenCalled(); expect(f.client.auth.hasPendingLink()).toBe(false);
});
test('sign-in link uses only the game URL and an isolated email hint', async () => {
    const f = fixture(); await f.client.auth.requestEmailLink('adult@example.test');
    expect(f.sdk.sendSignInLinkToEmail).toHaveBeenCalledWith(f.auth, 'adult@example.test', {
        url: 'https://game.example.test/play/', handleCodeInApp: true
    });
    expect(f.storage.getItem('mythical-creature-save')).toBeNull();
    expect(f.client.auth.pendingEmail()).toBe('adult@example.test');
});
test('one-time link credentials leave the address bar before Firebase starts', () => {
    const f = fixture('https://game.example.test/play/?mode=signIn&oobCode=synthetic-code&apiKey=synthetic-public-key&lang=en');
    expect(f.client.auth.hasPendingLink()).toBe(true); expect(f.loadSdk).not.toHaveBeenCalled();
    expect(f.history.replaceState.mock.calls[0][2]).toBe('https://game.example.test/play/');
});
test('a new device verifies the entered email, retains no link code and returns a Firebase identity', async () => {
    const link = 'https://game.example.test/play/?mode=signIn&oobCode=synthetic-code'; const f = fixture(link);
    const result = await f.client.auth.completeEmailLink('adult@example.test');
    expect(f.sdk.signInWithEmailLink).toHaveBeenCalledWith(f.auth, 'adult@example.test', link);
    expect(result.data.user).toEqual({ id: 'FirebaseSyntheticUid', email: 'adult@example.test', emailVerified: true, isAnonymous: false });
    expect(f.client.auth.hasPendingLink()).toBe(false);
    expect((await f.client.auth.getSession()).data.session.access_token).toBe('synthetic-firebase-token');
});
test('invalid links cannot complete authentication', async () => {
    const f = fixture('https://game.example.test/play/?mode=signIn&oobCode=invalid'); f.sdk.isSignInWithEmailLink.mockReturnValue(false);
    await expect(f.client.auth.completeEmailLink('adult@example.test')).rejects.toThrow('invalid_or_expired_link');
    expect(f.sdk.signInWithEmailLink).not.toHaveBeenCalled();
});
test('retiring a tab rejects a late identity response', async () => {
    const f = fixture(); f.auth.currentUser = f.user; let finish;
    f.user.getIdToken.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const request = f.client.auth.getSession();
    for (let n = 0; n < 15; n++) await Promise.resolve();
    f.client.auth.stopAutoRefresh(); finish('synthetic-firebase-token');
    await expect(request).rejects.toThrow('session_changed');
});
test('the page removes one-time credentials before any other script or external asset', () => {
    const html = fs.readFileSync(require('path').join(__dirname, '../../index.html'), 'utf8');
    const script = html.match(/<script id="adult-email-link">([\s\S]*?)<\/script>/);
    expect(script).not.toBeNull();
    expect(html.indexOf('<script')).toBe(html.indexOf(script[0]));
    expect(html.slice(0, html.indexOf(script[0]))).not.toMatch(/(?:src|href)=/);
    const link = 'https://game.example.test/play/?mode=signIn&oobCode=synthetic-private-code&apiKey=synthetic-key';
    const page = {}, history = { replaceState: jest.fn() };
    vm.runInNewContext(script[1], { window: page, location: new URL(link), history, URL });
    expect(history.replaceState.mock.calls[0][2]).toBe('https://game.example.test/play/');
    expect(Object.keys(page)).not.toContain('__mythicalAdultEmailLink');
    const f = fixture();
    const client = createClient(config, { storage: f.storage, location: f.location, history: f.history,
        loadSdk: f.loadSdk, initialLink: page.__mythicalAdultEmailLink });
    expect(client.auth.hasPendingLink()).toBe(true);
    expect(f.loadSdk).not.toHaveBeenCalled();
});
test('checking whether an adult previously signed in does not start Firebase', () => {
    const f = fixture(); expect(f.client.auth.hasStoredSession()).toBe(false);
    f.storage.setItem('firebase:authUser:synthetic-public-key:mythical-adult-demo-mythical-adult', '{}');
    expect(f.client.auth.hasStoredSession()).toBe(true); expect(f.loadSdk).not.toHaveBeenCalled();
});
