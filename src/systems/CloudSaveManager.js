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
        this.lastConflict = null;
        this.lastSyncedAt = null;
        this.lastSyncDirection = null;
        this.campaignEpoch = 0;
        this.activeCloudWrite = null;
        this.remoteWriteUncertain = this.gameState?.getCloudRecoveryStatus?.().pending === true;
        this.attachResetListener();
    }

    attachResetListener() {
        if (this.unsubscribeFromReset) return;
        this.unsubscribeFromReset = this.gameState?.on?.('reset', () => {
            this.campaignEpoch += 1;
            this.clearSyncTimer();
            this.pendingSave = null;
        });
        this.unsubscribeFromAdmission = this.gameState?.on?.('saveAdmissionChanged', admission => {
            this.campaignEpoch += 1;
            this.clearSyncTimer();
            const cloudHold = admission.status === 'held' && admission.source === 'cloud_recovery';
            if (!cloudHold) this.pendingSave = null;
            if (cloudHold) this.remoteWriteUncertain = true;
            this.lastSyncedAt = null;
            this.lastSyncDirection = null;
            this.status = admission.status === 'held' ? 'save_protected' : 'idle';
        });
        const subscription = this.client?.auth?.onAuthStateChange?.((_event, session) => {
            const nextUser = session?.user || null;
            if (this.currentUser && this.currentUser.id !== nextUser?.id) {
                this.campaignEpoch += 1;
                this.clearSyncTimer();
                this.pendingSave = null;
                this.status = 'session_changed';
                this.lastSyncedAt = null;
                this.lastSyncDirection = null;
            }
            this.currentUser = nextUser;
        });
        this.authSubscription = subscription?.data?.subscription || null;
    }

    captureCampaignGuard() {
        const epoch = this.campaignEpoch;
        const admissionEpoch = this.gameState?.getSaveAdmission?.().epoch;
        let ownerId = this.currentUser?.id || null;
        return () => {
            if (!this.isSaveAdmitted()) return false;
            if (!ownerId && this.currentUser) ownerId = this.currentUser.id;
            return this.campaignEpoch === epoch &&
                this.gameState?.getSaveAdmission?.().epoch === admissionEpoch &&
                (!ownerId || this.currentUser?.id === ownerId);
        };
    }

    isSaveAdmitted() {
        const pendingOwner = this.gameState?.cloudWriteLease;
        if (pendingOwner && this.gameState.getCloudRecoveryStatus?.().pending &&
            this.activeCloudWrite !== pendingOwner) {
            // A second manager cannot borrow the first manager's live write capability.
            this.gameState.protectCloudWrite(pendingOwner);
        }
        if (this.gameState?.canPersistSave?.() !== false) return true;
        this.clearSyncTimer();
        if (!this.gameState?.getCloudRecoveryStatus?.().pending) this.pendingSave = null;
        this.status = 'save_protected';
        return false;
    }

    snapshotIsCurrent(snapshot) {
        return JSON.stringify(this.sanitizeForCloud(snapshot)) ===
            JSON.stringify(this.sanitizeForCloud(this.createLocalSnapshot()));
    }

    assertCurrentCampaign(isCurrentCampaign) {
        if (isCurrentCampaign()) return;
        const error = new Error('Cloud operation belongs to an earlier game.');
        error.code = 'cloud_campaign_changed';
        throw error;
    }

    isConfigured() {
        return Boolean(this.client && this.gameState);
    }

    isEnabled() {
        if (this.gameState?.get?.('game.cloudSavePausedForNewGame') === true) return false;
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
        this.attachResetListener();

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
        if (!this.isSaveAdmitted()) throw new Error('Resolve the saved-game warning before enabling Cloud Save.');

        if (this.gameState.get?.('game.cloudSavePausedForNewGame') === true) {
            this.gameState.set('game.cloudSavePausedForNewGame', false);
            if (!this.gameState.save()) {
                this.gameState.set('game.cloudSavePausedForNewGame', true);
                throw new Error('Save this new game on your device before enabling Cloud Save.');
            }
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
        this.campaignEpoch += 1;
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
        this.lastConflict = null;
    }

    async ensureSession(isCurrentCampaign = this.captureCampaignGuard()) {
        this.assertCurrentCampaign(isCurrentCampaign);
        if (this.currentUser) {
            return this.currentUser;
        }

        const { data: sessionData, error: sessionError } = await this.client.auth.getSession();
        this.assertCurrentCampaign(isCurrentCampaign);
        if (sessionError) {
            throw sessionError;
        }

        let user = sessionData?.session?.user || null;
        if (!user) {
            const { data, error } = await this.client.auth.signInAnonymously();
            this.assertCurrentCampaign(isCurrentCampaign);
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
        if (!this.isSaveAdmitted()) return this.getStatus();
        if (this.activeCloudWrite) return this.getStatus();
        if (!this.isEnabled() || !this.isConfigured()) {
            return this.getStatus();
        }

        const isCurrentCampaign = this.captureCampaignGuard();
        this.status = 'syncing';
        this.lastError = null;
        this.lastConflict = null;

        try {
            await this.reconcileFusionReceipts(isCurrentCampaign);
            if (!isCurrentCampaign()) return this.getStatus();
            await this.withSyncLock(() => {
                if (!isCurrentCampaign()) return;
                return this.synchronizeSnapshot(this.createLocalSnapshot(), {
                    localSaveExists: this.hasPersistedLocalSave(), isCurrentCampaign
                });
            });
        } catch (error) {
            if (!isCurrentCampaign()) return this.getStatus();
            this.status = this.isRevisionConflict(error) ? 'conflict' : 'error';
            this.lastError = error;
            this.lastConflict = this.isRevisionConflict(error)
                ? this.normalizeRevisionConflict(error)
                : null;
            this.logger.warn('[CloudSave] Synchronization failed; local save remains available:', error);
        }

        return this.getStatus();
    }

    async synchronizeSnapshot(localSave, options = {}) {
        const { localSaveExists = true, isCurrentCampaign = this.captureCampaignGuard() } = options;
        if (!isCurrentCampaign()) return;
        if (this.gameState?.get?.('game.cloudSavePausedForNewGame') === true) return;
        if (this.getPendingFusionReconciliation(localSave)) {
            this.status = 'pending_fusion_reconciliation';
            this.lastSyncDirection = 'deferred';
            return;
        }
        const user = await this.ensureSession(isCurrentCampaign);
        if (!isCurrentCampaign()) return;
        const remoteSave = await this.fetchRemoteSave(user.id);
        if (!isCurrentCampaign()) return;
        if (this.gameState?.get?.('game.cloudSavePausedForNewGame') === true) return;
        const unresolvedFusionOperationId =
            this.getUnresolvedServerFusionOperationId(localSave);
        if (!this.snapshotIsCurrent(localSave)) {
            this.status = 'pending';
            this.lastSyncedAt = null;
            this.lastSyncDirection = null;
            return;
        }

        if (!remoteSave) {
            this.remoteWriteUncertain = false;
            if (unresolvedFusionOperationId) {
                this.status = 'pending_server_mutation';
                this.lastSyncDirection = 'deferred';
                return;
            }
            await this.upload(localSave, 0, isCurrentCampaign);
            return;
        }

        // Inspect remote content before timestamps or revision selection can overwrite it.
        if (this.gameState.validateExternalSaveAdmission?.(remoteSave.game_state, 'cloud') === false) return;
        if (!isCurrentCampaign()) return;
        this.remoteWriteUncertain = false;

        this.remoteRevision = Number(remoteSave.revision) || 0;
        if (unresolvedFusionOperationId) {
            const completedIds = remoteSave.game_state
                ?.breedingShrine
                ?.completedOperationIds;
            if (
                Array.isArray(completedIds) &&
                completedIds.includes(unresolvedFusionOperationId)
            ) {
                await this.restoreRemoteSave(remoteSave.game_state, isCurrentCampaign);
                this.pendingSave = null;
            } else {
                this.status = 'pending_server_mutation';
                this.lastSyncDirection = 'deferred';
            }
            return;
        }
        if (!localSaveExists) {
            await this.restoreRemoteSave(remoteSave.game_state, isCurrentCampaign);
            this.discardPendingSaveThrough(remoteSave.game_state?.savedAt);
            return;
        }

        const remoteSavedAt = this.toTimestamp(remoteSave.client_saved_at)
            || Number(remoteSave.game_state?.savedAt)
            || 0;
        const localSavedAt = Number(localSave?.savedAt) || 0;

        if (remoteSavedAt > localSavedAt) {
            await this.restoreRemoteSave(remoteSave.game_state, isCurrentCampaign);
            this.discardPendingSaveThrough(remoteSavedAt);
        } else if (localSavedAt > remoteSavedAt) {
            await this.upload(localSave, this.remoteRevision, isCurrentCampaign);
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
        const stripPortraitUrls = portraits => {
            if (!portraits?.byStage || typeof portraits.byStage !== 'object') {
                return;
            }
            Object.values(portraits.byStage).forEach(record => {
                if (!record?.assetRef) return;
                delete record.imageUrl;
                delete record.expiresAt;
            });
        };
        stripPortraitUrls(snapshot.creature?.portraits);
        if (Array.isArray(snapshot.creatures)) {
            snapshot.creatures.forEach(creature => {
                stripPortraitUrls(creature?.portraits);
            });
        }

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
        if (!this.isSaveAdmitted()) return;
        if (!this.isEnabled() || !this.isConfigured()) {
            return;
        }

        this.pendingSave = saveData;
        this.clearSyncTimer();
        if (this.activeCloudWrite) return;
        if (this.getPendingFusionReconciliation(saveData)) {
            this.status = 'pending_fusion_reconciliation';
            this.lastSyncDirection = 'deferred';
            this.syncTimer = setTimeout(() => {
                this.flush().catch((error) => {
                    this.logger.warn(
                        '[CloudSave] Fusion receipt reconciliation deferred:',
                        error
                    );
                });
            }, this.syncDelayMs);
            return;
        }
        if (this.getUnresolvedServerFusionOperationId(saveData)) {
            this.status = 'pending_server_mutation';
            this.lastSyncDirection = 'deferred';
            return;
        }
        this.syncTimer = setTimeout(() => {
            this.flush().catch((error) => {
                this.logger.warn('[CloudSave] Deferred upload failed:', error);
            });
        }, this.syncDelayMs);
    }

    async flush() {
        if (!this.isSaveAdmitted()) return this.getStatus();
        if (this.activeCloudWrite) return this.getStatus();
        const isCurrentCampaign = this.captureCampaignGuard();
        this.clearSyncTimer();
        if (!this.pendingSave || !this.isEnabled()) {
            return this.getStatus();
        }
        if (this.getPendingFusionReconciliation(this.pendingSave)) {
            await this.reconcileFusionReceipts(isCurrentCampaign);
            if (!isCurrentCampaign()) return this.getStatus();
            if (!this.pendingSave) {
                return this.getStatus();
            }
        }
        if (this.getUnresolvedServerFusionOperationId(this.pendingSave)) {
            this.status = 'pending_server_mutation';
            this.lastSyncDirection = 'deferred';
            return this.getStatus();
        }

        const saveData = this.pendingSave;
        this.pendingSave = null;

        try {
            this.status = 'syncing';
            this.lastError = null;
            this.lastConflict = null;
            await this.withSyncLock(() => this.synchronizeSnapshot(saveData, { isCurrentCampaign }));
        } catch (error) {
            if (!isCurrentCampaign()) return this.getStatus();
            this.retainNewestPendingSave(saveData);
            this.status = this.isRevisionConflict(error) ? 'conflict' : 'error';
            this.lastError = error;
            this.lastConflict = this.isRevisionConflict(error)
                ? this.normalizeRevisionConflict(error)
                : null;
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

    async performServerMutation(callback, options = {}) {
        if (!this.isSaveAdmitted()) throw new Error('Progress is protected. Cloud mutations are paused.');
        if (!this.isEnabled() || !this.isConfigured()) {
            throw new Error('Cloud server mutation is unavailable.');
        }
        if (typeof callback !== 'function') {
            throw new Error('Cloud server mutation callback is required.');
        }

        const localGuard = this.captureCampaignGuard();
        const isCurrentCampaign = () => localGuard() && (options.isCurrentCampaign?.() ?? true);
        return this.withSyncLock(async () => {
            this.assertCurrentCampaign(isCurrentCampaign);
            if (this.activeCloudWrite) throw new Error('A cloud change is already in progress.');
            this.clearSyncTimer();
            await this.ensureSession(isCurrentCampaign);
            this.assertCurrentCampaign(isCurrentCampaign);
            if (this.activeCloudWrite) throw new Error('A cloud change is already in progress.');
            const snapshot = this.createLocalSnapshot();
            const lease = this.reserveCloudWrite('mutation', snapshot, isCurrentCampaign, {
                operationId: options.operationId || this.getUnresolvedServerFusionOperationId(snapshot),
                wireRequest: options.wireRequest || null
            });
            let result = null;

            try {
                this.assertCurrentCampaign(isCurrentCampaign);
                if (!this.snapshotIsCurrent(snapshot) || !this.gameState.cloudWriteIsCurrent(lease)) {
                    throw new Error('Progress changed before cloud dispatch. No mutation was sent.');
                }
                result = await callback();
                this.assertCurrentCampaign(isCurrentCampaign);
                const revision = Number(result?.revision);
                if (
                    !result?.gameState ||
                    typeof result.gameState !== 'object' ||
                    !Number.isInteger(revision) ||
                    revision < 1 ||
                    revision < this.remoteRevision
                ) {
                    throw new Error('Cloud server mutation returned an invalid save.');
                }
                if (!this.snapshotIsCurrent(snapshot) || !this.gameState.cloudWriteIsCurrent(lease)) {
                    throw new Error('Newer local progress is protected from a delayed cloud result.');
                }

                this.applyingRemoteSave = true;
                let applied;
                try {
                    applied = this.gameState.applyCloudWriteResult(lease, result.gameState);
                } finally {
                    this.applyingRemoteSave = false;
                }
                this.assertCurrentCampaign(isCurrentCampaign);
                if (!applied?.snapshot || typeof applied.serialized !== 'string' ||
                    !this.snapshotIsCurrent(applied.snapshot) ||
                    !this.gameState.cloudWriteIsCurrent(lease, applied.serialized)) {
                    throw new Error('Progress changed during cloud result delivery.');
                }

                this.gameState.recordCloudWriteOutcome?.(lease, { outcome: 'accepted', revision });
                this.gameState.finishCloudWrite(lease);
                this.activeCloudWrite = null;
                this.pendingSave = null;
                this.remoteRevision = revision;
                this.remoteWriteUncertain = false;
                this.status = 'synced';
                this.lastSyncedAt = this.now();
                this.lastSyncDirection = 'server_mutation';
                this.lastError = null;
                this.lastConflict = null;
                return result;
            } catch (error) {
                const current = isCurrentCampaign();
                this.protectCloudWrite(lease, isCurrentCampaign, result?.gameState);
                this.status = this.gameState?.getSaveAdmission?.().status === 'held' ? 'save_protected' : 'error';
                this.lastError = error;
                if (!current) this.assertCurrentCampaign(() => false);
                throw error;
            }
        });
    }

    reserveCloudWrite(kind, snapshot, isCurrentCampaign, context = {}) {
        if (this.activeCloudWrite || typeof this.gameState?.beginCloudWrite !== 'function' ||
            typeof this.gameState?.finishCloudWrite !== 'function' ||
            typeof this.gameState?.protectCloudWrite !== 'function' ||
            typeof this.gameState?.cloudWriteIsCurrent !== 'function' ||
            typeof this.gameState?.applyCloudWriteResult !== 'function') {
            throw new Error('Durable cloud recovery is unavailable. No request was sent.');
        }
        const lease = this.gameState.beginCloudWrite(kind, snapshot, isCurrentCampaign, {
            ownerId: this.currentUser?.id, saveSlot: this.saveSlot,
            expectedRevision: this.remoteRevision, ...context
        });
        this.activeCloudWrite = lease;
        this.status = 'syncing';
        this.lastSyncedAt = null;
        this.lastSyncDirection = null;
        return lease;
    }

    protectCloudWrite(lease, isCurrentCampaign, result = null) {
        // Keep the actual latest queue, never the one captured before dispatch.
        if (isCurrentCampaign()) this.pendingSave = this.createLocalSnapshot();
        this.remoteWriteUncertain = true;
        this.lastSyncedAt = null;
        this.lastSyncDirection = null;
        this.clearSyncTimer();
        this.gameState.protectCloudWrite(lease, result);
        this.activeCloudWrite = null;
    }

    getUnresolvedServerFusionOperationId(saveData) {
        const pending = saveData?.breedingShrine?.pendingFusion;
        if (
            pending?.operationId &&
            pending?.authorityReservation?.reservationMode ===
                'server_reserved'
        ) {
            return pending.operationId;
        }
        return null;
    }

    getPendingFusionReconciliation(saveData) {
        const queue = saveData?.breedingShrine?.reconciliationQueue;
        return Array.isArray(queue) && queue.length > 0
            ? queue[0]
            : null;
    }

    async reconcileFusionReceipts(isCurrentCampaign = this.captureCampaignGuard()) {
        this.assertCurrentCampaign(isCurrentCampaign);
        if (!this.isEnabled() || !this.isConfigured()) return null;
        const snapshot = this.createLocalSnapshot();
        const record = this.getPendingFusionReconciliation(snapshot);
        if (!record) return null;
        const authority = typeof globalThis !== 'undefined'
            ? globalThis.FusionAuthority
            : null;
        if (typeof authority?.reconcileOfflineReceipt !== 'function') {
            this.status = 'pending_fusion_reconciliation';
            this.lastSyncDirection = 'deferred';
            throw new Error(
                'Fusion receipt reconciliation service is unavailable.'
            );
        }

        this.status = 'reconciling_fusion';
        this.lastSyncDirection = 'server_mutation';
        const result = await authority.reconcileOfflineReceipt(
            record,
            { cloudSave: this, isCurrentCampaign }
        );
        this.assertCurrentCampaign(isCurrentCampaign);
        this.pendingSave = null;
        this.status = 'synced';
        this.lastSyncedAt = this.now();
        this.lastSyncDirection = 'fusion_reconciled';
        this.lastError = null;
        this.lastConflict = null;
        return result;
    }

    retainNewestPendingSave(saveData) {
        const pendingSavedAt = Number(this.pendingSave?.savedAt) || 0;
        const failedSavedAt = Number(saveData?.savedAt) || 0;

        if (!this.pendingSave || failedSavedAt > pendingSavedAt) {
            this.pendingSave = saveData;
        }
    }

    discardPendingSaveThrough(savedAt) {
        const remoteSavedAt = Number(savedAt) || 0;
        const pendingSavedAt = Number(this.pendingSave?.savedAt) || 0;
        if (this.pendingSave && remoteSavedAt >= pendingSavedAt) {
            this.pendingSave = null;
        }
    }

    isRevisionConflict(error) {
        return Boolean(
            error?.code === '40001' ||
            error?.name === 'CloudSaveRevisionConflictError' ||
            String(error?.message || '').includes('save_revision_conflict')
        );
    }

    isConfirmedUploadRejection(error, expectedRevision) {
        // Match save_game_state's structured SQL rejection, not the broader UI label.
        if (error?.code !== '40001' || error.message !== 'save_revision_conflict' ||
            typeof error.details !== 'string') return false;
        try {
            const details = JSON.parse(error.details);
            return details !== null && !Array.isArray(details) &&
                details.expectedRevision === expectedRevision &&
                Number.isSafeInteger(details.expectedRevision) && details.expectedRevision >= 0 &&
                Number.isSafeInteger(details.currentRevision) && details.currentRevision >= 0;
        } catch (parseError) {
            return false;
        }
    }

    normalizeRevisionConflict(error) {
        let details = {};
        if (typeof error?.details === 'string') {
            try {
                details = JSON.parse(error.details);
            } catch (parseError) {
                details = {};
            }
        } else if (error?.details && typeof error.details === 'object') {
            details = error.details;
        }

        return {
            expectedRevision: Math.max(
                0,
                Number(details.expectedRevision) || this.remoteRevision || 0
            ),
            currentRevision: Math.max(
                0,
                Number(details.currentRevision) || 0
            ),
            detectedAt: this.now()
        };
    }

    async upload(saveData, currentRevision = 0, isCurrentCampaign = this.captureCampaignGuard()) {
        if (!isCurrentCampaign()) return;
        if (this.remoteWriteUncertain) throw new Error('Read the cloud save safely before retrying an uncertain upload.');
        if (this.activeCloudWrite) throw new Error('A cloud change is already in progress.');
        if (this.gameState?.get?.('game.cloudSavePausedForNewGame') === true) return;
        if (this.getPendingFusionReconciliation(saveData)) {
            throw new Error(
                'Fusion receipt must reconcile before cloud upload.'
            );
        }
        if (this.gameState.validateExternalSaveAdmission?.(saveData, 'cloud_upload') === false) return;
        await this.ensureSession(isCurrentCampaign);
        if (!isCurrentCampaign()) return;
        if (this.gameState?.get?.('game.cloudSavePausedForNewGame') === true) return;
        if (!this.snapshotIsCurrent(saveData)) {
            this.status = 'pending';
            this.lastSyncedAt = null;
            this.lastSyncDirection = null;
            return;
        }
        const snapshot = this.sanitizeForCloud(saveData);
        const clientSavedAt = new Date(Number(snapshot.savedAt) || this.now()).toISOString();

        if (typeof this.client.rpc !== 'function') {
            throw new Error('Cloud save revision service is unavailable.');
        }

        const expectedRevision = Math.max(0, Number(currentRevision) || 0);
        const request = {
            p_save_slot: this.saveSlot,
            p_save_version: snapshot.version || this.gameState.gameVersion || '1.0.0',
            p_game_state: snapshot,
            p_client_saved_at: clientSavedAt,
            p_expected_revision: expectedRevision
        };
        const lease = this.reserveCloudWrite('upload', saveData, isCurrentCampaign, {
            expectedRevision, wireRequest: { rpc: 'save_game_state', arguments: request }
        });
        let response;
        try {
            this.assertCurrentCampaign(isCurrentCampaign);
            if (!this.snapshotIsCurrent(saveData) || !this.gameState.cloudWriteIsCurrent(lease)) {
                throw new Error('Progress changed before cloud dispatch. No upload was sent.');
            }
            response = await this.client.rpc('save_game_state', request);
            const { data, error } = response || {};
            if (!isCurrentCampaign()) {
                this.protectCloudWrite(lease, isCurrentCampaign);
                return;
            }
            if (error) {
                // The existing CAS conflict is an authoritative transaction rejection,
                // unlike a lost reply or an unclassified service error.
                if (data === null && this.isConfirmedUploadRejection(error, expectedRevision)) {
                    this.gameState.recordCloudWriteOutcome?.(lease, { outcome: 'rejected',
                        revision: this.normalizeRevisionConflict(error).currentRevision });
                    this.gameState.finishCloudWrite(lease);
                    this.activeCloudWrite = null;
                    this.remoteWriteUncertain = false;
                }
                throw error;
            }
            const revision = Number(data?.revision);
            if (!Number.isInteger(revision) || revision <= expectedRevision) {
                throw new Error('Cloud upload returned an invalid revision.');
            }
            if (!this.gameState.cloudWriteIsCurrent(lease) && this.snapshotIsCurrent(snapshot)) {
                throw new Error('Durable local progress changed outside this cloud request.');
            }
            this.gameState.recordCloudWriteOutcome?.(lease, { outcome: 'accepted', revision });
            this.gameState.finishCloudWrite(lease);
            this.activeCloudWrite = null;
            this.remoteRevision = revision;
            this.remoteWriteUncertain = false;
            if (!this.snapshotIsCurrent(snapshot)) {
                this.status = 'pending';
                this.lastSyncedAt = null;
                this.lastSyncDirection = null;
                return data;
            }
            this.status = 'synced';
            this.lastSyncedAt = this.now();
            this.lastSyncDirection = 'uploaded';
            this.lastError = null;
            this.lastConflict = null;
            return data;
        } catch (error) {
            this.lastError = error;
            if (this.activeCloudWrite === lease) this.protectCloudWrite(lease, isCurrentCampaign);
            throw error;
        }
    }

    async restoreRemoteSave(saveData, isCurrentCampaign = this.captureCampaignGuard()) {
        if (!isCurrentCampaign()) return false;
        // A response begun before the confirmed restart cannot restore the old run.
        if (this.gameState?.get?.('game.cloudSavePausedForNewGame') === true) return false;
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
        this.lastConflict = null;
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
            hasError: Boolean(this.lastError),
            hasConflict: this.status === 'conflict',
            conflict: this.lastConflict,
            pendingFusionReconciliations:
                this.gameState?.getPendingFusionReconciliations?.().length ||
                0,
            remoteWriteUncertain: this.remoteWriteUncertain === true,
            saveProtected: this.gameState?.getSaveAdmission?.().status === 'held'
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
        this.campaignEpoch += 1;
        this.clearSyncTimer();
        this.unsubscribeFromSaves?.();
        this.unsubscribeFromSaves = null;
        this.unsubscribeFromReset?.();
        this.unsubscribeFromReset = null;
        this.unsubscribeFromAdmission?.();
        this.unsubscribeFromAdmission = null;
        this.authSubscription?.unsubscribe?.();
        this.authSubscription = null;
        this.initialized = false;
    }
}

if (typeof window !== 'undefined') {
    window.CloudSaveManager = CloudSaveManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CloudSaveManager;
}
