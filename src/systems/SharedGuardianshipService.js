import contract from '../config/sharedGuardianship.json';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_PATTERN = /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;
const TERMINAL_STATUSES = new Set(['committed', 'cancelled', 'expired']);

function isSharedGuardianshipEnabled() {
    if (contract.enabled) return true;
    if (typeof window === 'undefined') return false;
    const hostname = String(window.location?.hostname || '').toLowerCase();
    if (!['127.0.0.1', 'localhost'].includes(hostname)) return false;
    return new URLSearchParams(window.location?.search || '')
        .get('testSharedGuardianship') === '1';
}

function normalizeCode(value) {
    const compact = String(value || '').toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 12);
    if (!/^[0-9A-F]{12}$/.test(compact)) return null;
    return `${compact.slice(0,4)}-${compact.slice(4,8)}-${compact.slice(8,12)}`;
}

function normalizeInvitation(value) {
    if (!value || typeof value !== 'object') return null;
    const invitationId = String(value.invitationId || '').toLowerCase();
    if (!UUID_PATTERN.test(invitationId) || !['host','guest'].includes(value.role)) return null;
    return {
        schemaVersion: 1,
        invitationId,
        role: value.role,
        status: String(value.status || ''),
        ownParentId: String(value.ownParentId || ''),
        peerSignal: value.peerSignal && typeof value.peerSignal === 'object'
            ? {
                rarity: String(value.peerSignal.rarity || 'common'),
                affinity: String(value.peerSignal.affinity || 'unclassified'),
                generation: Math.max(1, Number(value.peerSignal.generation) || 1),
                stage: String(value.peerSignal.stage || 'adult')
            }
            : null,
        hostConfirmed: value.hostConfirmed === true,
        guestConfirmed: value.guestConfirmed === true,
        ownNameChoice: contract.safeNames.includes(value.ownNameChoice) ? value.ownNameChoice : null,
        peerNameChoice: contract.safeNames.includes(value.peerNameChoice) ? value.peerNameChoice : null,
        nameAgreed: value.nameAgreed === true,
        expiresAt: value.expiresAt ? new Date(value.expiresAt).toISOString() : null,
        operationId: typeof value.operationId === 'string' ? value.operationId : null,
        sharedCreatureId: UUID_PATTERN.test(String(value.sharedCreatureId || ''))
            ? String(value.sharedCreatureId).toLowerCase()
            : null,
        sharedRuntimeId: typeof value.sharedRuntimeId === 'string' ? value.sharedRuntimeId : null,
        code: normalizeCode(value.code),
        terminal: TERMINAL_STATUSES.has(value.status)
    };
}

function normalizeProjection(value) {
    if (!value || typeof value !== 'object') return null;
    const sharedCreatureId = String(value.sharedCreatureId || '').toLowerCase();
    if (!UUID_PATTERN.test(sharedCreatureId) || !value.genes || !Number.isInteger(Number(value.revision))) return null;
    return {
        schemaVersion: 1,
        sharedCreatureId,
        runtimeId: String(value.runtimeId || ''),
        name: String(value.name || 'Shared Signal').slice(0, 20),
        genes: structuredCloneSafe(value.genes),
        lifecycle: structuredCloneSafe(value.lifecycle || {}),
        care: structuredCloneSafe(value.care || {}),
        revision: Number(value.revision),
        status: String(value.status || 'active'),
        guardianCount: Math.max(1, Math.min(2, Number(value.guardianCount) || 1)),
        guardianRole: ['host','guest'].includes(value.guardianRole) ? value.guardianRole : null,
        guardianLabel: ['Guardian A','Guardian B'].includes(value.guardianLabel) ? value.guardianLabel : null,
        notificationsMuted: value.notificationsMuted === true,
        history: Array.isArray(value.history)
            ? value.history.slice(0,20).map(entry => ({
                kind: String(entry.kind || ''),
                summary: String(entry.summary || '').slice(0,160),
                guardianLabel: String(entry.guardianLabel || '').slice(0,24),
                revision: Number(entry.revision) || 0,
                createdAt: entry.createdAt || null
            }))
            : [],
        updatedAt: value.updatedAt || null,
        replay: value.replay === true,
        rebased: value.rebased === true,
        conflict: value.conflict === true
    };
}

function structuredCloneSafe(value) {
    if (typeof structuredClone === 'function') {
        try { return structuredClone(value); } catch (_) { /* JSON fallback */ }
    }
    return JSON.parse(JSON.stringify(value));
}

function randomId() {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID().replace(/-/g, '');
    }
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        globalThis.crypto.getRandomValues(bytes);
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    throw new SharedGuardianshipError(
        'secure_random_unavailable',
        'This browser cannot safely record a shared care action.'
    );
}

export class SharedGuardianshipError extends Error {
    constructor(code, message, cause = null) {
        super(message, cause ? { cause } : undefined);
        this.name = 'SharedGuardianshipError';
        this.code = code;
    }
}

export function getSharedGuardianshipAvailability(cloudSave, accountStatus = null) {
    let reason = null;
    if (!isSharedGuardianshipEnabled()) reason = 'feature_disabled';
    else if (cloudSave?.isAgeEligible?.() !== true) reason = 'age_restricted';
    else if (cloudSave?.isEnabled?.() !== true) reason = 'cloud_save_required';
    else if (!cloudSave?.isConfigured?.() || typeof cloudSave?.client?.rpc !== 'function') reason = 'service_unavailable';
    else if (accountStatus && !accountStatus.permanent) reason = 'account_required';
    return { available: reason === null, reason, contract };
}

export function getSharedGuardianshipEntryAvailability(cloudSave) {
    let reason = null;
    if (!isSharedGuardianshipEnabled()) reason = 'feature_disabled';
    else if (cloudSave?.isAgeEligible?.() !== true) reason = 'age_restricted';
    else if (
        !cloudSave?.isConfigured?.() ||
        typeof cloudSave?.client?.auth?.getSession !== 'function'
    ) reason = 'service_unavailable';
    return { available: reason === null, reason, contract };
}

export class SharedGuardianshipService {
    constructor(options = {}) {
        this.cloudSave = options.cloudSave || window.CloudSave || null;
        this.gameState = options.gameState || window.GameState || null;
        this.account = options.account || new window.DurableAccountService({
            client: this.cloudSave?.client,
            cloudSave: this.cloudSave
        });
        this.pollers = new Map();
        this.pendingCommandKeys = new Map();
        this.attestedUserId = null;
        this.pendingCreationKey = null;
    }

    getExpectedRevision() {
        const revision = Number(this.cloudSave?.remoteRevision);
        return Number.isInteger(revision) && revision > 0 ? revision : null;
    }

    async getAvailability() {
        const accountStatus = await this.account.getStatus();
        return { ...getSharedGuardianshipAvailability(this.cloudSave, accountStatus), accountStatus };
    }

    mapError(error) {
        const source = [error?.code,error?.message,error?.details,error?.hint].filter(Boolean).join(' ');
        const known = [
            'shared_guardianship_permanent_identity_required','shared_guardianship_eligibility_required',
            'shared_guardianship_limit_reached','shared_guardianship_invitation_limit','shared_guardianship_invitation_rate_limited',
            'shared_guardianship_join_rate_limited','shared_guardianship_action_rate_limited',
            'shared_guardianship_invitation_unavailable','shared_guardianship_cloud_save_required',
            'shared_guardianship_parent_unavailable','shared_guardianship_parent_changed',
            'shared_guardianship_invitation_not_found','shared_guardianship_invitation_not_confirmable',
            'shared_guardianship_invitation_locked','shared_guardianship_result_not_ready',
            'shared_guardianship_name_invalid','shared_guardianship_access_denied',
            'shared_guardianship_revision_conflict','shared_guardianship_action_invalid',
            'shared_guardianship_request_invalid','save_revision_conflict'
        ];
        const code = known.find(entry => source.includes(entry)) || 'shared_guardianship_service_error';
        const messages = {
            shared_guardianship_permanent_identity_required: 'Create or sign in to a verified account first.',
            shared_guardianship_eligibility_required: 'Review the Shared Guardianship privacy promise first.',
            shared_guardianship_limit_reached: 'This account already cares for a shared creature.',
            shared_guardianship_invitation_limit: 'Finish or cancel the current private invitation first.',
            shared_guardianship_invitation_rate_limited: 'Too many private links were created. Wait an hour and try again.',
            shared_guardianship_join_rate_limited: 'Too many code attempts. Wait ten minutes and try again.',
            shared_guardianship_action_rate_limited: 'Too many shared actions happened at once. Wait a minute and try again.',
            shared_guardianship_invitation_unavailable: 'That private code is unavailable or has expired.',
            shared_guardianship_cloud_save_required: 'Sync this Sanctuary before continuing.',
            shared_guardianship_parent_unavailable: 'That creature is not ready to contribute to Fusion.',
            shared_guardianship_parent_changed: 'The chosen creature changed. Review the pairing again.',
            shared_guardianship_invitation_not_found: 'This private invitation is no longer available.',
            shared_guardianship_invitation_not_confirmable: 'Both creatures must be paired before consent.',
            shared_guardianship_invitation_locked: 'This Fusion has already started.',
            shared_guardianship_result_not_ready: 'The shared creature is still forming.',
            shared_guardianship_name_invalid: 'Choose one of the protected creature names.',
            shared_guardianship_access_denied: 'This shared creature is not available to this account.',
            shared_guardianship_revision_conflict: 'The other Sanctuary changed first. Updating this view now.',
            shared_guardianship_action_invalid: 'That shared action could not be verified. Refresh and try again.',
            shared_guardianship_request_invalid: 'That private request could not be verified. Refresh and try again.',
            save_revision_conflict: 'The Sanctuary changed. Sync and review the pairing again.',
            shared_guardianship_service_error: 'Shared Guardianship is temporarily unavailable.'
        };
        return new SharedGuardianshipError(code, messages[code], error);
    }

    async invoke(name, params = {}) {
        const { data, error } = await this.cloudSave.client.rpc(name, params);
        if (error) throw this.mapError(error);
        if (data?.errorCode) {
            throw this.mapError({
                code: data.errorCode,
                message: data.errorCode,
                details: data
            });
        }
        return data;
    }

    async ensureReady() {
        const availability = await this.getAvailability();
        if (!availability.available) {
            throw new SharedGuardianshipError(
                availability.reason,
                availability.reason === 'account_required'
                    ? 'Create or sign in to a verified account first.'
                    : availability.reason === 'feature_disabled'
                        ? 'Shared Guardianship is not open in this release yet.'
                        : 'Shared Guardianship is unavailable for this profile.'
            );
        }
        if (!this.getExpectedRevision()) await this.cloudSave.synchronize();
        const user = await this.cloudSave.client.auth.getUser();
        if (user.error || !user.data?.user?.id) throw this.mapError(user.error);
        if (this.attestedUserId !== user.data.user.id) {
            await this.invoke('attest_shared_guardianship_eligibility', {
                p_age_band: this.cloudSave.getAgeGroup(),
                p_terms_version: contract.termsVersion,
                p_privacy_version: contract.privacyVersion
            });
            this.attestedUserId = user.data.user.id;
        }
        return user.data.user;
    }

    parentId(parent) {
        const readiness = window.FusionConsent?.getFusionCompanionReadiness?.(parent);
        if (!parent?.id || !readiness?.willing) {
            throw new SharedGuardianshipError('companion_not_ready', 'This creature is not ready to contribute to Fusion.');
        }
        return parent.id;
    }

    commandKey(scope, prefix, supplied = null) {
        if (supplied) return supplied;
        if (!this.pendingCommandKeys.has(scope)) {
            this.pendingCommandKeys.set(scope, `${prefix}_${randomId()}`);
        }
        return this.pendingCommandKeys.get(scope);
    }

    clearCommandKey(scope, error = null) {
        if (
            !error ||
            error.code === 'shared_guardianship_revision_conflict' ||
            error.code === 'shared_guardianship_action_invalid' ||
            error.code === 'shared_guardianship_access_denied'
        ) {
            this.pendingCommandKeys.delete(scope);
        }
    }

    async create(parent) {
        await this.ensureReady();
        this.pendingCreationKey ||= `invite_${randomId()}`;
        const data = await this.invoke('create_shared_guardianship_invitation', {
            p_parent_id: this.parentId(parent),
            p_expected_revision: this.getExpectedRevision(),
            p_idempotency_key: this.pendingCreationKey
        });
        const invitation = normalizeInvitation(data);
        if (invitation) this.pendingCreationKey = null;
        return invitation;
    }

    async join(code, parent) {
        await this.ensureReady();
        const normalized = normalizeCode(code);
        if (!normalized) throw new SharedGuardianshipError('invalid_code', 'Enter the complete private code.');
        const data = await this.invoke('join_shared_guardianship_invitation', {
            p_code: normalized,
            p_parent_id: this.parentId(parent),
            p_expected_revision: this.getExpectedRevision()
        });
        return normalizeInvitation(data);
    }

    async get(invitationId) {
        await this.ensureReady();
        return normalizeInvitation(await this.invoke('get_shared_guardianship_invitation', { p_invitation_id: invitationId }));
    }

    async confirm(invitationId) {
        await this.ensureReady();
        return normalizeInvitation(await this.invoke('confirm_shared_guardianship_invitation', { p_invitation_id: invitationId }));
    }

    async execute(invitationId) {
        await this.ensureReady();
        const { data, error } = await this.cloudSave.client.functions.invoke('execute-fusion', {
            body: { guardianshipInvitationId: invitationId }
        });
        if (error) throw this.mapError(error);
        return data;
    }

    async chooseName(invitationId, name) {
        if (!contract.safeNames.includes(name)) throw new SharedGuardianshipError('shared_guardianship_name_invalid', 'Choose a protected creature name.');
        await this.ensureReady();
        const invitation = normalizeInvitation(await this.invoke('submit_shared_guardianship_name', {
            p_invitation_id: invitationId,
            p_name: name
        }));
        if (invitation?.status === 'committed') await this.refreshAll();
        return invitation;
    }

    async refreshAll() {
        await this.ensureReady();
        const data = await this.invoke('list_shared_guardianship_creatures');
        const projections = Array.isArray(data) ? data.map(normalizeProjection).filter(Boolean) : [];
        this.gameState?.set?.('sharedGuardianship.projections', projections);
        this.gameState?.set?.('sharedGuardianship.lastSyncedAt', Date.now());
        return projections;
    }

    async getProjection(creatureId) {
        await this.ensureReady();
        const projection = normalizeProjection(await this.invoke('get_shared_guardianship_projection', { p_creature_id: creatureId }));
        if (!projection) throw new SharedGuardianshipError('invalid_projection', 'The shared creature returned an invalid state.');
        const current = this.gameState?.get?.('sharedGuardianship.projections') || [];
        const next = [...current.filter(entry => entry.sharedCreatureId !== creatureId), projection];
        this.gameState?.set?.('sharedGuardianship.projections', next);
        this.gameState?.set?.('sharedGuardianship.lastSyncedAt', Date.now());
        return projection;
    }

    storeProjection(projection) {
        if (!projection) return null;
        const current = this.gameState?.get?.('sharedGuardianship.projections') || [];
        const next = [
            ...current.filter(entry => entry.sharedCreatureId !== projection.sharedCreatureId),
            projection
        ];
        this.gameState?.set?.('sharedGuardianship.projections', next);
        this.gameState?.set?.('sharedGuardianship.lastSyncedAt', Date.now());
        return projection;
    }

    commandProjection(data) {
        const projection = this.storeProjection(normalizeProjection(data));
        if (!projection) {
            throw new SharedGuardianshipError(
                'invalid_projection',
                'The shared creature returned an invalid state.'
            );
        }
        if (data?.conflict === true) {
            const conflict = new SharedGuardianshipError(
                'shared_guardianship_revision_conflict',
                'The other Sanctuary changed first. This view is now up to date.'
            );
            conflict.latestProjection = projection;
            throw conflict;
        }
        return projection;
    }

    async care(creatureId, action, expectedRevision, idempotencyKey = null) {
        await this.ensureReady();
        const scope = `care:${creatureId}:${action}`;
        const commandKey = this.commandKey(scope, `care_${action}`, idempotencyKey);
        try {
            const data = await this.invoke('perform_shared_guardianship_care', {
                p_creature_id: creatureId,
                p_action: action,
                p_idempotency_key: commandKey,
                p_expected_revision: expectedRevision
            });
            const projection = this.commandProjection(data);
            this.clearCommandKey(scope);
            return projection;
        } catch (error) {
            this.clearCommandKey(scope, error);
            throw error;
        }
    }

    async setNotificationsMuted(creatureId, muted, expectedRevision, idempotencyKey = null) {
        await this.ensureReady();
        const scope = `notifications:${creatureId}:${muted === true}`;
        const commandKey = this.commandKey(scope, 'notice', idempotencyKey);
        try {
            const data = await this.invoke('set_shared_guardianship_notifications', {
                p_creature_id: creatureId,
                p_muted: muted === true,
                p_idempotency_key: commandKey,
                p_expected_revision: expectedRevision
            });
            const projection = this.commandProjection(data);
            this.clearCommandKey(scope);
            return projection;
        } catch (error) {
            this.clearCommandKey(scope, error);
            throw error;
        }
    }

    async leave(creatureId, expectedRevision, idempotencyKey = null) {
        await this.ensureReady();
        const scope = `leave:${creatureId}`;
        const commandKey = this.commandKey(scope, 'leave', idempotencyKey);
        try {
            const result = await this.invoke('leave_shared_guardianship', {
                p_creature_id: creatureId,
                p_idempotency_key: commandKey,
                p_expected_revision: expectedRevision
            });
            if (result?.conflict === true) {
                const latestProjection = this.storeProjection(normalizeProjection(result));
                const conflict = new SharedGuardianshipError(
                    'shared_guardianship_revision_conflict',
                    'The shared creature changed. Review the latest state before leaving.'
                );
                conflict.latestProjection = latestProjection;
                throw conflict;
            }
            await this.refreshAll();
            this.clearCommandKey(scope);
            return result;
        } catch (error) {
            this.clearCommandKey(scope, error);
            throw error;
        }
    }

    async cancel(invitationId) {
        await this.ensureReady();
        return normalizeInvitation(await this.invoke('cancel_shared_guardianship_invitation', { p_invitation_id: invitationId }));
    }

    watch(creatureId, callback, intervalMs = 3000) {
        this.stopWatching(creatureId);
        let lastRevision = 0;
        let inFlight = false;
        let stopped = false;
        const poll = async () => {
            if (stopped || inFlight) return;
            inFlight = true;
            try {
                const projection = await this.getProjection(creatureId);
                if (!stopped && projection.revision !== lastRevision) {
                    lastRevision = projection.revision;
                    callback(projection, null);
                }
            } catch (error) {
                if (!stopped) callback(null, error);
            } finally {
                inFlight = false;
            }
        };
        poll();
        const timer = window.setInterval(poll, Math.max(2000, intervalMs));
        this.pollers.set(creatureId, {
            timer,
            stop: () => { stopped = true; }
        });
        return () => this.stopWatching(creatureId);
    }

    stopWatching(creatureId) {
        const poller = this.pollers.get(creatureId);
        poller?.stop?.();
        if (poller?.timer) window.clearInterval(poller.timer);
        this.pollers.delete(creatureId);
    }

    destroy() {
        for (const poller of this.pollers.values()) {
            poller?.stop?.();
            if (poller?.timer) window.clearInterval(poller.timer);
        }
        this.pollers.clear();
        this.pendingCommandKeys.clear();
    }
}

if (typeof window !== 'undefined') {
    window.SharedGuardianship = {
        contract,
        normalizeCode,
        normalizeInvitation,
        normalizeProjection,
        isEnabled: isSharedGuardianshipEnabled,
        getSharedGuardianshipEntryAvailability,
        getSharedGuardianshipAvailability
    };
    window.SharedGuardianshipService = SharedGuardianshipService;
}
