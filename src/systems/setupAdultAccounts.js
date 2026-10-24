import AdultAccountManager from './AdultAccountManager.js';
import AdultAccountMenu from '../ui/AdultAccountMenu.js';

/** Mount optional accounts before the chooser, so a new device can recover a creature. */
export default async function setupAdultAccounts(gameState, adventures, isCurrent) {
    if (['itch', 'continuity'].includes(import.meta.env.MODE)) return null;
    const config = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
    const endpoint = import.meta.env.VITE_ADULT_ACCOUNT_API_URL;
    if (import.meta.env.VITE_ENABLE_ADULT_ACCOUNTS !== 'true' ||
        Object.values(config).some(value => !value) || !endpoint || !isCurrent()) return null;
    const { createFirebaseAdultClient } = await import('./FirebaseAdultClient.js');
    if (!isCurrent()) return null;
    const client = createFirebaseAdultClient(config, { initialLink: window.__mythicalAdultEmailLink || null });
    delete window.__mythicalAdultEmailLink;
    const manager = new AdultAccountManager({ client, endpoint, gameState, store: adventures.store, isCurrent });
    const menu = new AdultAccountMenu(manager, { onChosen: chosen => adventures.finish(chosen) });
    window.AdultAccounts = manager;
    window.AdultAccountMenu = menu;
    adventures.openAccount = parent => menu.open(parent);
    manager.initialize().then(() => {
        if (isCurrent() && client.auth.hasPendingLink()) { adventures.open(); menu.open(adventures.element); }
    }).catch(() => {});

    let entry = null;
    const updateEntry = () => {
        if (!isCurrent() || !gameState.initialized || gameState.get('creature.hatched')) {
            entry?.remove(); entry = null; return;
        }
        if (entry) return;
        entry = document.createElement('button'); entry.className = 'account-entry-button';
        entry.type = 'button'; entry.textContent = 'Continue on this device (18+)';
        entry.onclick = () => { adventures.open(); menu.open(adventures.element); };
        document.body.append(entry);
    };
    const initialized = gameState.on('initialized', updateEntry);
    const hatched = gameState.on('changed:creature.hatched', updateEntry);
    const online = () => manager.flush().catch(() => {});
    const visible = () => {
        if (document.visibilityState === 'visible') manager.reconcile().then(online).catch(() => {});
    };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', visible);
    updateEntry();
    return { destroy() {
        initialized?.(); hatched?.(); window.removeEventListener('online', online);
        document.removeEventListener('visibilitychange', visible);
        entry?.remove(); menu.close(); manager.destroy();
        adventures.openAccount = null;
        if (window.AdultAccounts === manager) delete window.AdultAccounts;
        if (window.AdultAccountMenu === menu) delete window.AdultAccountMenu;
    } };
}
