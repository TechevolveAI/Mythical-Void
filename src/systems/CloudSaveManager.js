/**
 * Optional Supabase cloud synchronization for the local-first GameState manager.
 *
 * Cloud saving is disabled until the player explicitly opts in. Local saves remain
 * authoritative whenever the network or Supabase is unavailable.
 */
class CloudSaveManager {
    constructor(options = {}) {
        this.client = options.client || null;
        this.gameState = options.gameState || null;
        this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
        this.logger = options.logger || console;
        this.now = options.now || (() => Date.now());
        this.syncDelayMs = options.syncDelayMs ?? 2000;
        this.saveSlot = options.saveSlot || 'primary';
        this.enabledKey = options.enabledKey || 'mythical_void_cloud_save_enabled';
        this.consentKey = options.consentKey || 'mythical_void_cloud_save_consent';
        this.ageGroupKey = options.ageGroupKey || 'mythical_void_age_group';
        this.lockManager = options.lockManager
            ?? (typeof navigator !== 'undefined' ? navigator.locks : null);
        this.syncLockName = options.syncLockName
            || `mythical-void-cloud-save:${this.saveSlot}`;

        this.initialized = false;
        this.syncTimer = null;
        this.pendingSave = null;
        this.unsubscribeFromSaves = null;
        this.currentUser = null;
        this.remoteRevision = 0;
        this.applyingRemoteSave = false;
        this.status = 'disabled';
        this.lastError = null;
        this.lastSyncedAt = null;
        this.lastSyncDirection = null;
    }

    isConfigured() {
        return Boolean(this.client && this.gameState);
    }

    isEnabled() {
        try {
            return this.storage?.getItem(this.enabledKey) === 'true';
        } catch (error) {
            return false;
        }
    }

    getAgeGroup() {
        try {
            return this.storage?.getItem(this.ageGroupKey) || null;
        } catch (error) {
            return null;
        }
    }

    static isAgeGroupEligible(ageGroup) {
        return ageGroup === 'age_16_17' || ageGroup === 'age_18_plus';
    }

    isAgeEligible() {
        return CloudSaveManager.isAgeGroupEligible(this.getAgeGroup());
    }

    async initialize() {
        if (!this.isConfigured()) {
            this.status = 'unavailable';
            return this.getStatus();
        }

        this.initialized = true;

        if (!this.isAgeEligible()) {
            if (this.isEnabled()) {
                this.disable();
            }
            this.status = 'restricted';
            return this.getStatus();
        }

        if (!this.unsubscribeFromSaves && typeof this.gameState.on === 'function') {
            this.unsubscribeFromSaves = this.gameState.on('saved', (saveData) => {
                if (!this.applyingRemoteSave) {
                    this.queueUpload(saveData);
                }
            });
        }

        if (!this.isEnabled()) {
            this.status = 'disabled';
            return this.getStatus();
        }

        await this.synchronize();
        return this.getStatus();
    }

    async enable(options = {}) {
        const {
            consentConfirmed = false,
            policyVersion = '2026-07-26'
        } = options;

        if (!this.isConfigured()) {
            throw new Error('Cloud saves are not configured.');
        }
        if (!this.isAgeEligible()) {
            throw new Error('Cloud saves are available only to confirmed 16+ profiles.');
        }
        if (!consentConfirmed) {
            throw new Error('Cloud saves require explicit player consent.');
        }

        this.storage?.setItem(this.enabledKey, 'true');
        this.storage?.setItem(this.consentKey, JSON.stringify({
            policyVersion,
            confirmedAt: new Date(this.now()).toISOString()
        }));
        this.status = 'connecting';

        if (!this.initialized) {
            return this.initialize();
        }

        await this.synchronize();
        return this.getStatus();
    }

    disable() {
        try {
            this.storage?.removeItem(this.enabledKey);
            this.storage?.removeItem(this.consentKey);
        } catch (error) {
            this.logger.warn('[CloudSave] Could not persist disabled state:', error);
        }

        this.clearSyncTimer();
        this.pendingSave = null;
        this.status = 'disabled';
        this.lastError = null;
    }

    async ensureSession() {
        if (this.currentUser) {
            return this.currentUser;
        }

        const { data: sessionData, error: sessionError } = await this.client.auth.getSession();
        if (sessionError) {
            throw sessionError;
        }

        let user = sessionData?.session?.user || null;
        if (!user) {
            const { data, error } = await this.client.auth.signInAnonymously();
            if (error) {
                throw error;
            }
            user = data?.user || data?.session?.user || null;
        }

        if (!user?.id) {
            throw new Error('Supabase did not return a cloud-save user.');
        }

        this.currentUser = user;
        return user;
    }

    async synchronize() {
        if (!this.isEnabled() || !this.isConfigured()) {
            return this.getStatus();
        }

        this.status = 'syncing';
        this.lastError = null;

        try {
            await this.withSyncLock(() => {
                return this.synchronizeSnapshot(this.createLocalSnapshot(), {
                    localSaveExists: this.hasPersistedLocalSave()
                });
            });
        } catch (error) {
            this.status = 'error';
            this.lastError = error;
            this.logger.warn('[CloudSave] Synchronization failed; local save remains available:', error);
        }

        return this.getStatus();
    }

    async synchronizeSnapshot(localSave, options = {}) {
        const { localSaveExists = true } = options;
        const user = await this.ensureSession();
        const remoteSave = await this.fetchRemoteSave(user.id);

        if (!remoteSave) {
            await this.upload(localSave, 0);
            return;
        }

        this.remoteRevision = Number(remoteSave.revision) || 0;
        if (!localSaveExists) {
            await this.restoreRemoteSave(remoteSave.game_state);
            return;
        }

        const remoteSavedAt = this.toTimestamp(remoteSave.client_saved_at)
            || Number(remoteSave.game_state?.savedAt)
            || 0;
        const localSavedAt = Number(localSave?.savedAt) || 0;

        if (remoteSavedAt > localSavedAt) {
            await this.restoreRemoteSave(remoteSave.game_state);
        } else if (localSavedAt > remoteSavedAt) {
            await this.upload(localSave, this.remoteRevision);
        } else {
            this.status = 'synced';
            this.lastSyncedAt = this.now();
            this.lastSyncDirection = 'unchanged';
            this.lastError = null;
        }
    }

    async fetchRemoteSave(userId) {
        const { data, error } = await this.client
            .from('game_saves')
            .select('save_version, revision, game_state, client_saved_at, updated_at')
            .eq('user_id', userId)
            .eq('save_slot', this.saveSlot)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data || null;
    }

    createLocalSnapshot() {
        if (typeof this.gameState.createSaveSnapshot === 'function') {
            return this.gameState.createSaveSnapshot();
        }

        return {
            ...this.gameState.get(),
            savedAt: this.now()
        };
    }

    hasPersistedLocalSave() {
        if (typeof this.gameState?.hasPersistedSave === 'function') {
            return this.gameState.hasPersistedSave();
        }

        // Custom GameState adapters predate this signal and are assumed durable.
        return true;
    }

    sanitizeForCloud(saveData) {
        const snapshot = JSON.parse(JSON.stringify(saveData || {}));
        delete snapshot.session;

        if (snapshot.safety?.guardian) {
            snapshot.safety.guardian.pinHash = null;
            snapshot.safety.guardian.lastVerified = null;
        }
        if (snapshot.safety) {
            snapshot.safety.auditLog = [];
        }
        if (snapshot.memory) {
            snapshot.memory.deletionLog = [];
        }

        return snapshot;
    }

    queueUpload(saveData) {
        if (!this.isEnabled() || !this.isConfigured()) {
            return;
        }

        this.pendingSave = saveData;
        this.clearSyncTimer();
        this.syncTimer = setTimeout(() => {
            this.flush().catch((error) => {
                this.logger.warn('[CloudSave] Deferred upload failed:', error);
            });
        }, this.syncDelayMs);
    }

    async flush() {
        this.clearSyncTimer();
        if (!this.pendingSave || !this.isEnabled()) {
            return this.getStatus();
        }

        const saveData = this.pendingSave;
        this.pendingSave = null;

        try {
            this.status = 'syncing';
            this.lastError = null;
            await this.withSyncLock(() => this.synchronizeSnapshot(saveData));
        } catch (error) {
            this.retainNewestPendingSave(saveData);
            this.status = 'error';
            this.lastError = error;
            throw error;
        }

        return this.getStatus();
    }

    async withSyncLock(callback) {
        if (typeof this.lockManager?.request === 'function') {
            return this.lockManager.request(this.syncLockName, callback);
        }

        return callback();
    }

    retainNewestPendingSave(saveData) {
        const pendingSavedAt = Number(this.pendingSave?.savedAt) || 0;
        const failedSavedAt = Number(saveData?.savedAt) || 0;

        if (!this.pendingSave || failedSavedAt > pendingSavedAt) {
            this.pendingSave = saveData;
        }
    }

    async upload(saveData, currentRevision = 0) {
        const user = await this.ensureSession();
        const snapshot = this.sanitizeForCloud(saveData);
        const clientSavedAt = new Date(Number(snapshot.savedAt) || this.now()).toISOString();

        const payload = {
            user_id: user.id,
            save_slot: this.saveSlot,
            save_version: snapshot.version || this.gameState.gameVersion || '1.0.0',
            revision: Number(currentRevision) + 1,
            game_state: snapshot,
            client_saved_at: clientSavedAt
        };

        const { data, error } = await this.client
            .from('game_saves')
            .upsert(payload, { onConflict: 'user_id,save_slot' })
            .select('revision, updated_at')
            .single();

        if (error) {
            throw error;
        }

        this.remoteRevision = Number(data?.revision) || payload.revision;
        this.status = 'synced';
        this.lastSyncedAt = this.now();
        this.lastSyncDirection = 'uploaded';
        this.lastError = null;
        return data;
    }

    async restoreRemoteSave(saveData) {
        if (!saveData || typeof saveData !== 'object') {
            throw new Error('Cloud save payload is invalid.');
        }
        if (typeof this.gameState.applyExternalSave !== 'function') {
            throw new Error('GameState cannot restore an external save.');
        }

        this.applyingRemoteSave = true;
        try {
            const restored = this.gameState.applyExternalSave(saveData, {
                source: 'cloud',
                persist: true
            });
            if (!restored) {
                throw new Error('Cloud save is incompatible with this game version.');
            }
        } finally {
            this.applyingRemoteSave = false;
        }

        this.status = 'synced';
        this.lastSyncedAt = this.now();
        this.lastSyncDirection = 'restored';
    }

    async deleteCloudSave() {
        if (!this.isConfigured()) {
            return false;
        }

        const user = await this.ensureSession();
        if (user.is_anonymous === true && typeof this.client.functions?.invoke === 'function') {
            const { error } = await this.client.functions.invoke('delete-cloud-identity');
            if (error) {
                throw error;
            }

            try {
                await this.client.auth.signOut({ scope: 'local' });
            } catch (error) {
                this.logger.warn('[CloudSave] Cloud identity deleted; local sign-out cleanup failed:', error);
            }
            this.currentUser = null;
        } else {
            const { error } = await this.client
                .from('game_saves')
                .delete()
                .eq('user_id', user.id)
                .eq('save_slot', this.saveSlot);

            if (error) {
                throw error;
            }
        }

        this.remoteRevision = 0;
        this.lastSyncedAt = null;
        this.lastSyncDirection = null;
        this.lastError = null;
        return true;
    }

    getStatus() {
        return {
            configured: this.isConfigured(),
            enabled: this.isEnabled(),
            ageEligible: this.isAgeEligible(),
            ageGroup: this.getAgeGroup(),
            status: this.status,
            lastSyncedAt: this.lastSyncedAt,
            lastSyncDirection: this.lastSyncDirection,
            hasError: Boolean(this.lastError)
        };
    }

    toTimestamp(value) {
        if (!value) return 0;
        const timestamp = new Date(value).getTime();
        return Number.isFinite(timestamp) ? timestamp : 0;
    }

    clearSyncTimer() {
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
            this.syncTimer = null;
        }
    }

    destroy() {
        this.clearSyncTimer();
        this.unsubscribeFromSaves?.();
        this.unsubscribeFromSaves = null;
        this.initialized = false;
    }
}

if (typeof window !== 'undefined') {
    window.CloudSaveManager = CloudSaveManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CloudSaveManager;
}
