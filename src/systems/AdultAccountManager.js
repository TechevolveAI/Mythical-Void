const AGE_KEY = 'mythical_void_age_group';
const ACCOUNT_AGE_KEY = 'mythical-adult-account-age';
const BINDING_PREFIX = 'mythical-account-adventure:';
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ACCOUNT_ID = /^[A-Za-z0-9_-]{1,128}$/;
const adultUser = user => Boolean(ACCOUNT_ID.test(user?.id || '') && user.isAnonymous === false && user.emailVerified === true);
const problem = code => Object.assign(new Error(code), { code });

function accountSnapshot(input) {
    const state = JSON.parse(JSON.stringify(input));
    const privateKeys = new Set(['session', 'safety', 'email', 'password', 'access_token', 'refresh_token',
        'accessToken', 'refreshToken', 'pinHash', 'lastVerified', 'auditLog', 'deletionLog']);
    const scrub = value => {
        if (!value || typeof value !== 'object') return;
        for (const key of Object.keys(value)) {
            if (privateKeys.has(key) || (value.assetRef && ['imageUrl', 'videoUrl', 'expiresAt'].includes(key))) delete value[key];
            else scrub(value[key]);
        }
    };
    scrub(state);
    return state;
}

function progressFingerprint(input) {
    const state = accountSnapshot(input);
    delete state.savedAt;
    if (state.player) { delete state.player.playTime; delete state.player.lastPlayed; }
    if (state.game) {
        delete state.game.cloudSavePausedForNewGame;
        if (!Object.keys(state.game).length) delete state.game;
    }
    return JSON.stringify(state);
}

/** Optional account copies. Failures never change GameState save admission. */
export default class AdultAccountManager {
    constructor({ client, gameState, store, endpoint = '/api/adult-accounts', fetcher = (...args) => fetch(...args),
        storage = localStorage, isCurrent = () => true, isVisible = () => document.visibilityState !== 'hidden', mediaClient = () => window.CreatureMediaClient,
        newId = () => crypto.randomUUID(), now = () => Date.now() }) {
        Object.assign(this, { client, gameState, store, endpoint, fetcher, storage, isCurrent, isVisible, mediaClient, newId, now });
        this.user = null;
        this.phase = 'signed_out';
        this.syncStatus = 'not_connected';
        this.listeners = new Set();
        this.epoch = 0;
        this.retryAt = 0;
        this.pendingEmail = null;
        this.activeAuth = null;
        this.uploading = null;
        this.library = [];
        this.dirty = 0;
        this.unsubscribe = gameState.on?.('saved', () => this.schedule());
        this.unsubscribeInit = gameState.on?.('initialized', () => this.reconcile().catch(() => {}));
        this.subscription = client.auth.onAuthStateChange?.((_event, session) => {
            if (!this.isCurrent()) return;
            const user = this.ageGroup() === 'age_18_plus' && adultUser(session?.user) ? session.user : null;
            if (this.user?.id !== user?.id) {
                this.epoch += 1;
                clearTimeout(this.timer);
                this.library = [];
            }
            this.user = user;
            this.emit();
        })?.data?.subscription;
    }

    ageGroup() {
        try {
            const gameAge = this.storage.getItem(AGE_KEY);
            if (gameAge && gameAge !== 'age_18_plus') return gameAge;
            return this.storage.getItem(ACCOUNT_AGE_KEY) || gameAge;
        } catch { return null; }
    }
    declareAge(adult) {
        const previous = this.ageGroup();
        if (previous && previous !== 'age_18_plus') throw problem('adults_only');
        this.store.writeVerified(ACCOUNT_AGE_KEY, adult ? 'age_18_plus' : 'age_under_18');
        if (adult && !this.storage.getItem(AGE_KEY)) this.store.writeVerified(AGE_KEY, 'age_18_plus');
        this.emit();
    }
    requireAdult() {
        if (!this.isCurrent()) throw problem('adventure_changed');
        if (this.ageGroup() !== 'age_18_plus') throw problem('adults_only');
    }
    currentKey() { return this.store.activeKey(); }
    binding(key = null) {
        try {
            const b = JSON.parse(this.storage.getItem(BINDING_PREFIX + (key || this.currentKey())));
            return b && UUID.test(b.id) && ACCOUNT_ID.test(b.accountId) && Number.isSafeInteger(b.revision) && b.revision >= 0 ? b : null;
        } catch { return null; }
    }
    writeBinding(key, value) { this.store.writeVerified(BINDING_PREFIX + key, JSON.stringify(value)); }
    subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    emit() { this.listeners.forEach(fn => fn()); }
    maskedEmail() {
        const email = this.user?.email || this.pendingEmail;
        if (!email) return '';
        const [name, host] = email.split('@');
        return `${name.slice(0, 1)}•••@${host}`;
    }
    async initialize() {
        if (this.client.auth.hasPendingLink?.()) { this.phase = 'email_link'; this.emit(); return; }
        if (this.ageGroup() !== 'age_18_plus') return;
        if (this.client.auth.hasStoredSession?.() === false) return;
        try {
            const { data, error } = await this.client.auth.getSession();
            if (error || !this.isCurrent()) return;
            this.user = adultUser(data?.session?.user) ? data.session.user : null;
            if (this.user) {
                this.phase = 'signed_in';
                await this.refreshLibrary();
                await this.reconcile();
            }
        } catch (error) {
            if (error.code === 'adult_declaration_required') this.phase = 'finish_setup';
            this.syncStatus = 'offline';
        }
        this.emit();
    }
    async requestLink(email, { consent = false } = {}) {
        this.requireAdult();
        if (!consent) throw problem('consent_required');
        if (this.activeAuth || this.phase === 'signing_out') throw problem('please_wait');
        if (this.now() < this.retryAt) throw problem('wait_before_resending');
        const address = String(email).trim();
        if (address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw problem('invalid_email');
        const epoch = this.epoch;
        this.phase = 'sending'; this.emit();
        this.activeAuth = this.client.auth.requestEmailLink(address);
        try {
            const result = await this.activeAuth;
            if (!this.isCurrent() || this.epoch !== epoch) throw problem('session_changed');
            if (result.error) throw problem('email_unavailable');
            this.pendingEmail = address;
            this.retryAt = this.now() + 60000;
            this.phase = 'link_sent';
        } catch { this.phase = 'signed_out'; throw problem('email_unavailable'); }
        finally { this.activeAuth = null; this.emit(); }
    }
    async completeLink(email, { consent = false } = {}) {
        this.requireAdult();
        if (!consent) throw problem('consent_required');
        const address = String(email).trim();
        if (address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw problem('invalid_email');
        if (this.activeAuth) throw problem('please_wait');
        this.activeAuth = this.client.auth.completeEmailLink(address);
        try {
            const result = await this.activeAuth;
            if (!adultUser(result.data?.user)) throw problem('invalid_or_expired_link');
            if (!this.isCurrent()) throw problem('adventure_changed');
            this.user = result.data.user; this.pendingEmail = null;
            this.phase = 'finish_setup';
            await this.finishSetup();
        } catch (error) {
            throw problem(this.user ? 'accounts_unavailable' : 'invalid_or_expired_link');
        } finally { this.activeAuth = null; this.emit(); }
    }
    async finishSetup() {
        await this.request('consent', { adultDeclared: true, policyVersion: '2026-10-23' });
        this.phase = 'signed_in';
        await this.refreshLibrary();
        await this.reconcile();
        this.emit();
    }
    async session() {
        this.requireAdult();
        const { data, error } = await this.client.auth.getSession();
        const session = data?.session;
        if (error) throw problem('accounts_unavailable');
        if (!adultUser(session?.user) || !session.access_token || session.user.id !== this.user?.id) {
            this.sessionEnded();
            throw problem('sign_in_required');
        }
        return session;
    }
    sessionEnded() {
        this.epoch += 1; clearTimeout(this.timer);
        this.user = null; this.pendingEmail = null; this.library = [];
        this.phase = 'signed_out'; this.syncStatus = 'not_connected'; this.emit();
    }
    async request(action, values = {}, read = false) {
        const epoch = this.epoch;
        const session = await this.session();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const query = new URLSearchParams({ action, ...values });
            const response = await this.fetcher(this.endpoint + (read ? `?${query}` : ''), {
                method: read ? 'GET' : 'POST', signal: controller.signal, credentials: 'omit',
                headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                ...(read ? {} : { body: JSON.stringify({ action, ...values }) })
            });
            if (!this.isCurrent() || this.epoch !== epoch || session.user.id !== this.user?.id) throw problem('session_changed');
            const result = await response.json();
            if (!this.isCurrent() || this.epoch !== epoch || session.user.id !== this.user?.id) throw problem('session_changed');
            if (response.status === 401) { this.sessionEnded(); throw problem(result.error === 'recent_sign_in_required' ? 'recent_sign_in_required' : 'sign_in_required'); }
            if (!response.ok) throw problem(result.error || 'accounts_unavailable');
            return result;
        } catch (error) {
            const allowed = ['adventure_changed', 'adventure_removed', 'adventure_not_found', 'sign_in_required',
                'session_changed', 'adult_declaration_required', 'library_full', 'recent_sign_in_required', 'adventure_too_large'];
            throw problem(allowed.includes(error.code) ? error.code : 'accounts_unavailable');
        } finally { clearTimeout(timer); }
    }
    async refreshLibrary() {
        const result = await this.request('list', {}, true);
        this.library = Array.isArray(result.adventures) ? result.adventures : [];
        this.emit();
        return this.library;
    }
    async reconcile() {
        const key = this.currentKey(), binding = this.binding(key);
        if (!this.user || !binding || binding.accountId !== this.user.id || binding.disconnected) return;
        const epoch = this.epoch;
        const stillCurrent = () => this.isCurrent() && this.epoch === epoch && this.currentKey() === key &&
            JSON.stringify(this.binding(key)) === JSON.stringify(binding);
        try {
            const { adventure } = await this.request('read', { id: binding.id }, true);
            if (!stillCurrent()) return;
            if (adventure.id !== binding.id || !Number.isSafeInteger(adventure.revision) || adventure.revision < 1) throw problem('invalid_adventure');
            if (binding.pendingOperationId && adventure.operation_id === binding.pendingOperationId) {
                this.writeBinding(key, { ...binding, revision: adventure.revision, pendingOperationId: null });
            } else if (adventure.revision !== binding.revision) {
                this.syncStatus = 'conflict'; this.emit(); return;
            } else if (binding.pendingOperationId) {
                this.writeBinding(key, { ...binding, pendingOperationId: null });
            }
            this.lastUploaded = { key, id: binding.id, revision: adventure.revision,
                fingerprint: progressFingerprint(adventure.game_state) };
            this.syncStatus = 'connected';
        } catch (error) {
            if (!stillCurrent()) return;
            if (error.code === 'adventure_not_found' && binding.revision === 0) {
                this.writeBinding(key, { ...binding, pendingOperationId: null });
                this.syncStatus = 'connected';
            } else this.syncStatus = ['adventure_not_found', 'adventure_removed'].includes(error.code) ? 'removed' : 'offline';
        }
        this.emit();
    }
    schedule() {
        this.dirty += 1;
        clearTimeout(this.timer);
        if (this.user && this.isCurrent() && this.isVisible()) this.timer = setTimeout(() => {
            if (this.isVisible()) this.flush().catch(() => {});
        }, 2000);
    }
    currentSnapshot() {
        if (!this.gameState.initialized || this.gameState.saveKey !== this.currentKey() ||
            this.gameState.canPersistSave?.() === false) throw problem('open_adventure_first');
        const snapshot = this.gameState.createSaveSnapshot();
        this.gameState.prepareSaveCandidate(snapshot);
        // Do not publish a half-completed server transaction as an account copy.
        if (this.gameState.getCloudRecoveryStatus?.().pending || this.gameState.cloudWriteLease ||
            snapshot.breedingShrine?.pendingFusion?.authorityReservation?.reservationMode === 'server_reserved' ||
            snapshot.breedingShrine?.reconciliationQueue?.length) throw problem('save_in_progress');
        return accountSnapshot(snapshot);
    }
    async attachCurrent() {
        this.requireAdult();
        if (!this.user) throw problem('sign_in_required');
        this.currentSnapshot();
        const key = this.currentKey(), previous = this.binding(key);
        if (previous && previous.accountId !== this.user.id) throw problem('different_account');
        if (!previous || previous.disconnected) this.writeBinding(key, { id: this.newId(), accountId: this.user.id, revision: 0 });
        this.syncStatus = 'connected';
        await this.flush();
        await this.refreshLibrary();
    }
    async flush() {
        if (this.uploading) return this.uploading;
        const dirty = this.dirty;
        this.uploading = this.uploadCurrent().finally(() => {
            this.uploading = null;
            if (dirty !== this.dirty) this.schedule();
        });
        return this.uploading;
    }
    async saveAsSeparateAdventure() {
        this.requireAdult(); this.currentSnapshot();
        if (!this.user) throw problem('sign_in_required');
        this.writeBinding(this.currentKey(), { id: this.newId(), accountId: this.user.id, revision: 0 });
        this.syncStatus = 'connected';
        await this.flush();
        await this.refreshLibrary();
    }
    async uploadCurrent() {
        if (!this.user || this.phase !== 'signed_in' || !this.isCurrent() || ['conflict', 'removed'].includes(this.syncStatus)) return;
        const key = this.currentKey(), epoch = this.epoch;
        let binding = this.binding(key);
        if (!binding || binding.accountId !== this.user.id || binding.disconnected) return;
        if (binding.pendingOperationId || ['offline', 'not_connected'].includes(this.syncStatus)) {
            await this.reconcile();
            if (this.syncStatus !== 'connected' || this.currentKey() !== key || this.epoch !== epoch || !this.isCurrent()) return;
            binding = this.binding(key);
        }
        try {
            const state = this.currentSnapshot();
            const fingerprint = progressFingerprint(state);
            if (this.lastUploaded?.key === key && this.lastUploaded.id === binding.id &&
                this.lastUploaded.revision === binding.revision && this.lastUploaded.fingerprint === fingerprint) {
                this.syncStatus = 'saved'; return;
            }
            const operationId = this.newId();
            const owned = await this.mediaClient()?.auth?.getSession?.();
            if (!this.isCurrent() || this.currentKey() !== key || this.epoch !== epoch) return;
            this.writeBinding(key, { ...binding, pendingOperationId: operationId });
            this.syncStatus = 'saving'; this.emit();
            const result = await this.request('save', { id: binding.id, revision: binding.revision, operationId,
                state, ...(owned?.data?.session?.access_token ? { mediaOwnerToken: owned.data.session.access_token } : {}) });
            if (this.currentKey() !== key || this.epoch !== epoch || !this.isCurrent()) return;
            if (result.id !== binding.id || result.operationId !== operationId || result.revision !== binding.revision + 1) throw problem('accounts_unavailable');
            this.writeBinding(key, { ...binding, revision: result.revision });
            this.lastUploaded = { key, id: binding.id, revision: result.revision, fingerprint };
            this.syncStatus = 'saved';
        } catch (error) {
            if (!this.isCurrent() || this.epoch !== epoch) return;
            this.syncStatus = error.code === 'adventure_changed' ? 'conflict' : error.code === 'adventure_removed' ? 'removed' : 'offline';
            throw error;
        } finally { this.emit(); }
    }
    async openAdventure(id) {
        const selection = () => { try { return this.currentKey(); } catch { return null; } };
        const previousKey = selection();
        const { adventure } = await this.request('read', { id }, true);
        if (selection() !== previousKey) throw problem('adventure_changed');
        if (adventure.id !== id || !UUID.test(adventure.id) || !Number.isSafeInteger(adventure.revision) || adventure.revision < 1) throw problem('invalid_adventure');
        return this.store.importSnapshot(this.gameState, adventure.game_state, key => {
            this.writeBinding(key, { accountId: this.user.id, id: adventure.id, revision: adventure.revision });
        });
    }
    async removeAdventure(id, revision) {
        await this.request('remove', { id, revision });
        const binding = this.binding();
        if (binding?.id === id && binding.accountId === this.user.id) {
            this.writeBinding(this.currentKey(), { ...binding, disconnected: true });
            this.syncStatus = 'not_connected';
        }
        await this.refreshLibrary();
    }
    async signOut() {
        this.phase = 'signing_out'; this.emit();
        await this.activeAuth?.catch(() => {});
        this.epoch += 1; clearTimeout(this.timer);
        await this.uploading?.catch(() => {});
        try {
            const result = await this.client.auth.signOut({ scope: 'local' });
            if (result?.error) throw result.error;
        } catch { this.phase = 'signed_in'; this.emit(); throw problem('sign_out_unavailable'); }
        this.user = null; this.pendingEmail = null; this.library = [];
        this.phase = 'signed_out'; this.syncStatus = 'not_connected'; this.emit();
    }
    async deleteAccount() {
        await this.request('delete-account', { confirm: 'delete-account' });
        await this.signOut();
    }
    async mediaRequest(url, fallbackToken) {
        const binding = this.binding();
        if (!this.user || binding?.accountId !== this.user.id || binding.disconnected) return { url, token: fallbackToken };
        const epoch = this.epoch, key = this.currentKey();
        const session = await this.session();
        const assertCurrent = () => {
            if (!this.isCurrent() || this.epoch !== epoch || this.currentKey() !== key) throw problem('session_changed');
        };
        assertCurrent();
        return { url: `${url}&accountAdventure=${encodeURIComponent(binding.id)}`, token: session.access_token, assertCurrent };
    }
    destroy() {
        this.epoch += 1; clearTimeout(this.timer); this.unsubscribe?.(); this.unsubscribeInit?.();
        this.subscription?.unsubscribe(); this.listeners.clear(); this.client.auth.stopAutoRefresh?.();
    }
}
