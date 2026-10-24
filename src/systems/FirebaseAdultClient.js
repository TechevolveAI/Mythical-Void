const PENDING_EMAIL = 'mythical-firebase-pending-email-v1';
const loadFirebase = async () => ({ ...await import('firebase/app'), ...await import('firebase/auth') });

/** Lazy identity client: the SDK starts only after an adult opts in. */
export function createFirebaseAdultClient(config, { storage = localStorage, location = window.location,
    history = window.history, loadSdk = loadFirebase, emulatorUrl = null, initialLink = null, now = () => Date.now() } = {}) {
    let sdk, auth, initializing, unsubscribe, disposed = false;
    const listeners = new Set();
    const url = new URL(location.href);
    let pendingLink = initialLink || (url.searchParams.get('mode') === 'signIn' && url.searchParams.has('oobCode') ? url.href : null);
    if (pendingLink) {
        // Keep one-time credentials out of subsequent navigation/referrers and game saves.
        for (const key of ['apiKey', 'oobCode', 'mode', 'lang', 'continueUrl']) url.searchParams.delete(key);
        history.replaceState(history.state, '', url.href);
    }
    const normalized = user => user ? { id: user.uid, email: user.email,
        emailVerified: user.emailVerified === true, isAnonymous: user.isAnonymous === true } : null;
    const publish = user => listeners.forEach(fn => fn(user ? 'SIGNED_IN' : 'SIGNED_OUT',
        user ? { user: normalized(user) } : null));
    async function ensure() {
        if (disposed) throw Error('session_changed');
        if (!initializing) initializing = (async () => {
            sdk = await loadSdk();
            if (disposed) throw Error('session_changed');
            const name = 'mythical-adult-' + config.projectId;
            const existing = sdk.getApps().find(app => app.name === name);
            const app = existing || sdk.initializeApp(config, name);
            auth = sdk.initializeAuth(app, { persistence: sdk.browserLocalPersistence });
            if (emulatorUrl && !existing) sdk.connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
            await auth.authStateReady();
            if (disposed) throw Error('session_changed');
            unsubscribe = sdk.onIdTokenChanged(auth, publish);
            return auth;
        })().catch(error => { initializing = null; throw error; });
        return initializing;
    }
    function pendingEmail() {
        try {
            const row = JSON.parse(storage.getItem(PENDING_EMAIL));
            return row && now() - row.sentAt < 60 * 60 * 1000 && typeof row.email === 'string' ? row.email : '';
        } catch { return ''; }
    }
    return { auth: {
        hasPendingLink: () => Boolean(pendingLink),
        hasStoredSession: () => {
            try { return Boolean(storage.getItem(`firebase:authUser:${config.apiKey}:mythical-adult-${config.projectId}`)); }
            catch { return false; }
        },
        pendingEmail,
        onAuthStateChange(fn) {
            listeners.add(fn);
            return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } };
        },
        async getSession() {
            await ensure();
            const user = auth.currentUser;
            if (!user) return { data: { session: null } };
            const token = await user.getIdToken();
            if (disposed || auth.currentUser !== user) throw Error('session_changed');
            return { data: { session: { user: normalized(user), access_token: token } } };
        },
        async requestEmailLink(email) {
            await ensure();
            const returnUrl = new URL('/play/', location.origin);
            await sdk.sendSignInLinkToEmail(auth, email, { url: returnUrl.href, handleCodeInApp: true });
            try { storage.setItem(PENDING_EMAIL, JSON.stringify({ email, sentAt: now() })); } catch { /* Re-enter email on return. */ }
            return {};
        },
        async completeEmailLink(email) {
            await ensure();
            if (!pendingLink || !sdk.isSignInWithEmailLink(auth, pendingLink)) throw Error('invalid_or_expired_link');
            const result = await sdk.signInWithEmailLink(auth, email, pendingLink);
            pendingLink = null;
            try { storage.removeItem(PENDING_EMAIL); } catch { /* No effect on the verified session. */ }
            return { data: { user: normalized(result.user) } };
        },
        async signOut() {
            await ensure(); await sdk.signOut(auth);
            try { storage.removeItem(PENDING_EMAIL); } catch { /* Identity itself is signed out by Firebase. */ }
            return {};
        },
        stopAutoRefresh() { disposed = true; unsubscribe?.(); listeners.clear(); }
    } };
}
