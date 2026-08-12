export const SHARED_FUSION_INVITATION_SCHEMA_VERSION = 1;
export const SHARED_FUSION_POLICY_VERSION = '2026-07-31';
export const SHARED_FUSION_CODE_PATTERN =
    /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;
export const SHARED_FUSION_ID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SHARED_FUSION_STATUSES = Object.freeze([
    'waiting',
    'paired',
    'ready',
    'executing',
    'staged',
    'committed',
    'cancelled',
    'expired'
]);

const PEER_RARITIES = new Set([
    'common',
    'uncommon',
    'rare',
    'epic',
    'legendary'
]);
const TERMINAL_STATUSES = new Set([
    'committed',
    'cancelled',
    'expired'
]);

function normalizeIdentifier(value, maxLength = 180) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return (
        normalized.length >= 1 &&
        normalized.length <= maxLength &&
        /^[A-Za-z0-9_-]+$/.test(normalized)
    )
        ? normalized
        : null;
}

function normalizeTimestamp(value) {
    const timestamp = typeof value === 'number'
        ? value
        : Date.parse(value);
    return Number.isFinite(timestamp)
        ? new Date(timestamp).toISOString()
        : null;
}

export function normalizeSharedFusionCode(value) {
    if (typeof value !== 'string') return null;
    const compact = value
        .toUpperCase()
        .replace(/[^0-9A-F]/g, '')
        .slice(0, 12);
    if (!/^[0-9A-F]{12}$/.test(compact)) return null;
    return [
        compact.slice(0, 4),
        compact.slice(4, 8),
        compact.slice(8, 12)
    ].join('-');
}

export function normalizeSharedFusionInvitation(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const invitationId = typeof value.invitationId === 'string' &&
        SHARED_FUSION_ID_PATTERN.test(value.invitationId)
        ? value.invitationId.toLowerCase()
        : null;
    const role = ['host', 'guest'].includes(value.role)
        ? value.role
        : null;
    const status = SHARED_FUSION_STATUSES.includes(value.status)
        ? value.status
        : null;
    const ownParentId = normalizeIdentifier(value.ownParentId);
    const expiresAt = normalizeTimestamp(value.expiresAt);
    if (!invitationId || !role || !status || !ownParentId || !expiresAt) {
        return null;
    }

    const peer = value.peerSignal &&
        typeof value.peerSignal === 'object' &&
        !Array.isArray(value.peerSignal)
        ? value.peerSignal
        : null;
    const peerSignal = peer
        ? {
            rarity: PEER_RARITIES.has(peer.rarity)
                ? peer.rarity
                : 'common',
            affinity: normalizeIdentifier(peer.affinity, 32) ||
                'unclassified',
            generation: Math.min(
                9999,
                Math.max(1, Number(peer.generation) || 1)
            ),
            stage: ['adult', 'elder'].includes(peer.stage)
                ? peer.stage
                : 'adult'
        }
        : null;
    const code = normalizeSharedFusionCode(value.code);
    const operationId = typeof value.operationId === 'string' &&
        /^fusion_shared_[A-Za-z0-9_-]{1,160}$/.test(value.operationId)
        ? value.operationId
        : null;
    const ownOffspringId = normalizeIdentifier(value.ownOffspringId);

    return {
        schemaVersion: SHARED_FUSION_INVITATION_SCHEMA_VERSION,
        invitationId,
        role,
        status,
        ownParentId,
        peerSignal,
        hostConfirmed: value.hostConfirmed === true,
        guestConfirmed: value.guestConfirmed === true,
        createdAt: normalizeTimestamp(value.createdAt),
        expiresAt,
        operationId,
        ownOffspringId,
        ownNameSubmitted: value.ownNameSubmitted === true,
        code,
        terminal: TERMINAL_STATUSES.has(status)
    };
}

export function normalizeSharedFusionSaveState(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const activeInvitation = normalizeSharedFusionInvitation(
        source.activeInvitation
    );
    const completedOperationIds = Array.from(new Set(
        Array.isArray(source.completedOperationIds)
            ? source.completedOperationIds.filter(operationId => (
                typeof operationId === 'string' &&
                /^fusion_shared_[A-Za-z0-9_-]{1,160}$/.test(operationId)
            ))
            : []
    )).slice(-25);
    const pendingSource = source.pendingReveal &&
        typeof source.pendingReveal === 'object'
        ? source.pendingReveal
        : {};
    const pendingReveal = (
        SHARED_FUSION_ID_PATTERN.test(
            String(pendingSource.invitationId || '')
        ) &&
        /^fusion_shared_[A-Za-z0-9_-]{1,160}$/.test(
            String(pendingSource.operationId || '')
        ) &&
        normalizeIdentifier(pendingSource.creatureId)
    )
        ? {
            invitationId:
                String(pendingSource.invitationId).toLowerCase(),
            operationId: String(pendingSource.operationId),
            creatureId: normalizeIdentifier(pendingSource.creatureId),
            receivedAt: Math.max(
                0,
                Number(pendingSource.receivedAt) || 0
            )
        }
        : null;
    return {
        schemaVersion: SHARED_FUSION_INVITATION_SCHEMA_VERSION,
        activeInvitation: activeInvitation?.terminal
            ? null
            : activeInvitation
                ? {
                    ...activeInvitation,
                    code: null
                }
                : null,
        completedOperationIds,
        pendingReveal
    };
}

export function normalizeSharedFusionExecution(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const invitationId = typeof value.invitationId === 'string' &&
        SHARED_FUSION_ID_PATTERN.test(value.invitationId)
        ? value.invitationId.toLowerCase()
        : null;
    const operationId = typeof value.operationId === 'string' &&
        /^fusion_shared_[A-Za-z0-9_-]{1,160}$/.test(value.operationId)
        ? value.operationId
        : null;
    const role = ['host', 'guest'].includes(value.role)
        ? value.role
        : null;
    const offspring = value.offspring &&
        typeof value.offspring === 'object' &&
        !Array.isArray(value.offspring)
        ? value.offspring
        : null;
    const offspringData = offspring?.offspringData &&
        typeof offspring.offspringData === 'object'
        ? { ...offspring.offspringData }
        : null;
    const offspringGenes = offspring?.offspringGenes &&
        typeof offspring.offspringGenes === 'object'
        ? offspring.offspringGenes
        : null;
    const creatureId = normalizeIdentifier(offspringData?.creatureId);
    if (
        !invitationId ||
        !operationId ||
        !role ||
        !creatureId ||
        !offspringGenes
    ) {
        return null;
    }
    delete offspringData.parentIds;
    return {
        schemaVersion: SHARED_FUSION_INVITATION_SCHEMA_VERSION,
        invitationId,
        operationId,
        role,
        status: 'staged',
        offspring: {
            offspringGenes,
            offspringData
        },
        compatibilityScore: Math.max(
            0,
            Math.min(100, Number(value.compatibilityScore) || 0)
        ),
        birthEvents: Array.isArray(value.birthEvents)
            ? value.birthEvents.slice(0, 12)
            : [],
        receipt: value.receipt &&
            typeof value.receipt === 'object'
            ? value.receipt
            : null,
        replay: value.replay === true
    };
}

export function getSharedFusionAvailability(cloudSave) {
    const ageEligible = cloudSave?.isAgeEligible?.() === true;
    const cloudEnabled = cloudSave?.isEnabled?.() === true;
    const configured = cloudSave?.isConfigured?.() === true;
    const rpcAvailable = typeof cloudSave?.client?.rpc === 'function';

    let reason = null;
    if (!ageEligible) reason = 'age_restricted';
    else if (!cloudEnabled) reason = 'cloud_save_required';
    else if (!configured || !rpcAvailable) reason = 'service_unavailable';

    return {
        available: reason === null,
        reason,
        ageEligible,
        cloudEnabled,
        configured,
        excludes: [
            'public_matchmaking',
            'player_search',
            'chat',
            'location_sharing',
            'creature_trading'
        ]
    };
}

export class SharedFusionInvitationError extends Error {
    constructor(code, message, cause = null) {
        super(message, cause ? { cause } : undefined);
        this.name = 'SharedFusionInvitationError';
        this.code = code;
    }
}

export class SharedFusionInvitationService {
    constructor(options = {}) {
        this.cloudSave = options.cloudSave ||
            (typeof window !== 'undefined' ? window.CloudSave : null);
        this.gameState = options.gameState ||
            (typeof window !== 'undefined' ? window.GameState : null);
        this.policyVersion = options.policyVersion ||
            SHARED_FUSION_POLICY_VERSION;
        this.logger = options.logger || console;
        this.inFlightReads = new Map();
        this.attestedSessionId = null;
    }

    getAvailability() {
        return getSharedFusionAvailability(this.cloudSave);
    }

    getExpectedRevision() {
        const revision = Number(this.cloudSave?.remoteRevision);
        return Number.isInteger(revision) && revision > 0
            ? revision
            : null;
    }

    requireParent(parent) {
        const readiness = typeof window !== 'undefined'
            ? window.FusionConsent
                ?.getFusionCompanionReadiness?.(parent)
            : null;
        const parentId = normalizeIdentifier(parent?.id);
        if (!parentId || !readiness?.willing) {
            throw new SharedFusionInvitationError(
                'companion_not_ready',
                'This companion needs care, time, or space before Shared Fusion.'
            );
        }
        return parentId;
    }

    async ensureReady() {
        const availability = this.getAvailability();
        if (!availability.available) {
            throw new SharedFusionInvitationError(
                availability.reason,
                availability.reason === 'age_restricted'
                    ? 'Shared Fusion is unavailable for this local-only profile.'
                    : availability.reason === 'cloud_save_required'
                        ? 'Enable optional cloud saving before Shared Fusion.'
                        : 'Shared Fusion is temporarily unavailable.'
            );
        }

        const user = await this.cloudSave.ensureSession();
        if (!user?.id) {
            throw new SharedFusionInvitationError(
                'cloud_identity_required',
                'A protected cloud identity is required.'
            );
        }
        if (!this.getExpectedRevision()) {
            await this.cloudSave.synchronize();
        }
        if (!this.getExpectedRevision()) {
            throw new SharedFusionInvitationError(
                'cloud_save_required',
                'Sync the current sanctuary before Shared Fusion.'
            );
        }
        if (this.attestedSessionId !== user.id) {
            await this.invoke(
                'attest_shared_fusion_eligibility',
                {
                    p_age_band: this.cloudSave.getAgeGroup(),
                    p_policy_version: this.policyVersion
                },
                { normalize: false }
            );
            this.attestedSessionId = user.id;
        }
        return user;
    }

    mapError(error) {
        const source = [
            error?.code,
            error?.message,
            error?.details,
            error?.hint
        ].filter(Boolean).join(' ');
        const knownCodes = [
            'shared_fusion_age_ineligible',
            'shared_fusion_age_attestation_required',
            'shared_fusion_invitation_limit',
            'shared_fusion_join_rate_limited',
            'shared_fusion_invitation_unavailable',
            'shared_fusion_cloud_save_required',
            'shared_fusion_parent_unavailable',
            'shared_fusion_parent_changed',
            'shared_fusion_collection_capacity',
            'shared_fusion_invitation_not_found',
            'shared_fusion_invitation_not_confirmable',
            'shared_fusion_invitation_locked',
            'shared_fusion_result_not_ready',
            'shared_fusion_name_replay_mismatch',
            'invalid_shared_fusion_name',
            'shared_fusion_sanctuary_busy',
            'shared_fusion_in_progress',
            'save_revision_conflict'
        ];
        const code = knownCodes.find(entry => source.includes(entry)) ||
            'shared_fusion_service_error';
        const messages = {
            shared_fusion_age_ineligible:
                'Shared Fusion is unavailable for this local-only profile.',
            shared_fusion_age_attestation_required:
                'Confirm the 16+ cloud profile before Shared Fusion.',
            shared_fusion_invitation_limit:
                'Close an existing Shared Fusion invitation before creating another.',
            shared_fusion_join_rate_limited:
                'Too many code attempts. Wait ten minutes before trying again.',
            shared_fusion_invitation_unavailable:
                'That Shared Fusion code is unavailable or has expired.',
            shared_fusion_cloud_save_required:
                'Sync the current sanctuary before Shared Fusion.',
            shared_fusion_parent_unavailable:
                'This companion is no longer ready for Shared Fusion.',
            shared_fusion_parent_changed:
                'The companion changed after pairing. Review the invitation again.',
            shared_fusion_collection_capacity:
                'Make one sanctuary space before Shared Fusion.',
            shared_fusion_invitation_not_found:
                'This Shared Fusion invitation is no longer available.',
            shared_fusion_invitation_not_confirmable:
                'Both Current signals must be paired before confirmation.',
            shared_fusion_invitation_locked:
                'This Shared Fusion has already entered synthesis.',
            shared_fusion_result_not_ready:
                'The linked sibling signal is not ready for naming.',
            shared_fusion_name_replay_mismatch:
                'This sibling already has a different protected name.',
            invalid_shared_fusion_name:
                'Choose a name between 1 and 20 characters.',
            shared_fusion_sanctuary_busy:
                'This sanctuary is cooling down or has another lineage in progress.',
            shared_fusion_in_progress:
                'Resolve the active Shared Fusion link before starting another lineage.',
            save_revision_conflict:
                'Newer cloud progress was found. Sync before continuing.',
            shared_fusion_service_error:
                'Shared Fusion could not reach the protected invitation service.'
        };
        return new SharedFusionInvitationError(
            code,
            messages[code],
            error
        );
    }

    async invoke(name, payload, options = {}) {
        const { data, error } = await this.cloudSave.client.rpc(name, payload);
        if (error) throw this.mapError(error);
        if (options.normalize === false) return data;
        const invitation = normalizeSharedFusionInvitation(data);
        if (!invitation) {
            throw new SharedFusionInvitationError(
                'shared_fusion_response_invalid',
                'Shared Fusion returned an invalid protected response.'
            );
        }
        return invitation;
    }

    recordInvitation(invitation) {
        if (!this.gameState?.get || !this.gameState?.set) return invitation;
        const current = normalizeSharedFusionSaveState(
            this.gameState.get('breedingShrine.sharedFusion')
        );
        const operationIds = invitation?.status === 'committed' &&
            invitation.operationId
            ? [...current.completedOperationIds, invitation.operationId]
            : current.completedOperationIds;
        this.gameState.set(
            'breedingShrine.sharedFusion',
            normalizeSharedFusionSaveState({
                ...current,
                activeInvitation: invitation,
                completedOperationIds: operationIds
            })
        );
        this.gameState.save?.();
        return invitation;
    }

    async create(parent) {
        const parentId = this.requireParent(parent);
        await this.ensureReady();
        const invitation = await this.invoke(
            'create_shared_fusion_invitation',
            {
            p_parent_id: parentId,
            p_expected_revision: this.getExpectedRevision()
            }
        );
        this.recordInvitation(invitation);
        return invitation;
    }

    async join(code, parent) {
        const normalizedCode = normalizeSharedFusionCode(code);
        if (!normalizedCode) {
            throw new SharedFusionInvitationError(
                'shared_fusion_invitation_unavailable',
                'That Shared Fusion code is unavailable or has expired.'
            );
        }
        const parentId = this.requireParent(parent);
        await this.ensureReady();
        const invitation = await this.invoke(
            'join_shared_fusion_invitation',
            {
            p_code: normalizedCode,
            p_parent_id: parentId,
            p_expected_revision: this.getExpectedRevision()
            }
        );
        this.recordInvitation(invitation);
        return invitation;
    }

    async get(invitationId, options = {}) {
        if (!SHARED_FUSION_ID_PATTERN.test(String(invitationId || ''))) {
            throw new SharedFusionInvitationError(
                'shared_fusion_invitation_not_found',
                'This Shared Fusion invitation is no longer available.'
            );
        }
        await this.ensureReady();
        const key = String(invitationId).toLowerCase();
        if (!options.force && this.inFlightReads.has(key)) {
            return this.inFlightReads.get(key);
        }
        const promise = this.invoke('get_shared_fusion_invitation', {
            p_invitation_id: key
        }).finally(() => this.inFlightReads.delete(key));
        this.inFlightReads.set(key, promise);
        return promise.then(invitation => {
            if (invitation.status !== 'committed') {
                this.recordInvitation(invitation);
            }
            return invitation;
        });
    }

    async confirm(invitationId) {
        await this.ensureReady();
        const invitation = await this.invoke(
            'confirm_shared_fusion_invitation',
            {
            p_invitation_id: invitationId
            }
        );
        this.recordInvitation(invitation);
        return invitation;
    }

    async execute(invitationId) {
        await this.ensureReady();
        if (!SHARED_FUSION_ID_PATTERN.test(String(invitationId || ''))) {
            throw new SharedFusionInvitationError(
                'shared_fusion_invitation_not_found',
                'This Shared Fusion invitation is no longer available.'
            );
        }
        const invoke = this.cloudSave?.client?.functions?.invoke;
        if (typeof invoke !== 'function') {
            throw new SharedFusionInvitationError(
                'shared_fusion_service_error',
                'Shared Fusion could not reach the protected executor.'
            );
        }
        const { data, error } = await invoke.call(
            this.cloudSave.client.functions,
            'execute-fusion',
            {
                body: {
                    invitationId: String(invitationId).toLowerCase()
                }
            }
        );
        if (error) throw this.mapError(error);
        const execution = normalizeSharedFusionExecution(data);
        if (!execution) {
            throw new SharedFusionInvitationError(
                'shared_fusion_response_invalid',
                'Shared Fusion returned an invalid protected result.'
            );
        }
        const current = await this.get(invitationId, { force: true });
        if (current.status !== 'staged') {
            throw new SharedFusionInvitationError(
                'shared_fusion_response_invalid',
                'The protected sibling result was not staged.'
            );
        }
        return execution;
    }

    normalizeName(value) {
        const name = String(value || '').trim();
        return (
            name.length >= 1 &&
            name.length <= 20 &&
            !/[\u0000-\u001F\u007F<>]/.test(name)
        )
            ? name
            : null;
    }

    async submitName(invitationId, value) {
        const name = this.normalizeName(value);
        if (!name) {
            throw new SharedFusionInvitationError(
                'invalid_shared_fusion_name',
                'Choose a name between 1 and 20 characters.'
            );
        }
        await this.ensureReady();
        const data = await this.invoke(
            'submit_shared_fusion_name',
            {
                p_invitation_id: invitationId,
                p_name: name
            },
            { normalize: false }
        );
        const invitation = normalizeSharedFusionInvitation(data);
        if (!invitation) {
            throw new SharedFusionInvitationError(
                'shared_fusion_response_invalid',
                'Shared Fusion returned an invalid naming receipt.'
            );
        }
        if (invitation.status === 'committed') {
            await this.cloudSave.synchronize();
        }
        this.recordInvitation(invitation);
        const ownOffspring = data?.ownOffspring &&
            data.ownOffspring.id === invitation.ownOffspringId
            ? data.ownOffspring
            : null;
        return {
            invitation,
            awaitingOtherKeeper: data?.awaitingOtherKeeper === true,
            ownOffspring,
            replay: data?.replay === true
        };
    }

    async cancel(invitationId) {
        await this.ensureReady();
        const invitation = await this.invoke(
            'cancel_shared_fusion_invitation',
            {
            p_invitation_id: invitationId
            }
        );
        this.recordInvitation(invitation);
        return invitation;
    }

    destroy() {
        this.inFlightReads.clear();
        this.attestedSessionId = null;
    }
}

if (typeof window !== 'undefined') {
    window.SharedFusionInvitationService =
        SharedFusionInvitationService;
    window.SharedFusionInvitation = {
        SHARED_FUSION_INVITATION_SCHEMA_VERSION,
        SHARED_FUSION_POLICY_VERSION,
        SHARED_FUSION_CODE_PATTERN,
        SHARED_FUSION_ID_PATTERN,
        SHARED_FUSION_STATUSES,
        normalizeSharedFusionCode,
        normalizeSharedFusionInvitation,
        normalizeSharedFusionSaveState,
        normalizeSharedFusionExecution,
        getSharedFusionAvailability
    };
}
