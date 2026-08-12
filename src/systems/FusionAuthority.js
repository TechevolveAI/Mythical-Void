/**
 * Portable Fusion operation contract.
 *
 * The current game executes Fusion locally. This contract keeps operation
 * identity, parent proofs, consent, deterministic randomness, and result
 * receipts independent from Phaser so a server authority can replace the
 * local executor without changing saved lineage records.
 */
const FUSION_AUTHORITY_SCHEMA_VERSION = 1;
const FUSION_AUTHORITY_CONTRACT_VERSION = 2;
const FUSION_FINGERPRINT_ALGORITHM = 'fnv1a32-v1';
const FUSION_TWIN_THRESHOLD = 0.08;

class FusionAuthority {
    stableStringify(value) {
        if (value === null || typeof value !== 'object') {
            return JSON.stringify(value);
        }
        if (Array.isArray(value)) {
            return `[${value.map(item => this.stableStringify(item)).join(',')}]`;
        }

        const entries = Object.keys(value)
            .filter(key => value[key] !== undefined)
            .sort()
            .map(key => `${JSON.stringify(key)}:${this.stableStringify(value[key])}`);
        return `{${entries.join(',')}}`;
    }

    fingerprint(value) {
        const source = this.stableStringify(value);
        let hash = 0x811c9dc5;
        for (let index = 0; index < source.length; index += 1) {
            hash ^= source.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193);
        }
        return `${FUSION_FINGERPRINT_ALGORITHM}:${(hash >>> 0)
            .toString(16)
            .padStart(8, '0')}`;
    }

    createParentProof(creature) {
        if (!creature?.id || typeof creature.id !== 'string') {
            throw new Error('fusion_parent_identity_required');
        }

        return {
            creatureId: creature.id,
            generation: Math.max(1, Number(creature.generation) || 1),
            rarity: String(creature.rarity || creature.genes?.rarity || 'common'),
            lifecycleStage: String(creature.lifecycle?.stage || 'unknown'),
            geneticsFingerprint: this.fingerprint({
                genes: creature.genes || null,
                dna: creature.dna || null,
                lineage: creature.lineage || null
            })
        };
    }

    deriveResultSeed(operationId, parentIds = []) {
        return `fusion-seed-v1:${this.fingerprint({
            operationId,
            parentIds
        }).split(':').pop()}`;
    }

    selectOffspringCount(requestFingerprint, offspringCapacity = 1) {
        const capacity = Number(offspringCapacity) >= 2 ? 2 : 1;
        if (capacity < 2) return 1;
        const hash = String(requestFingerprint || '').split(':').pop();
        if (!/^[0-9a-f]{8}$/i.test(hash)) return 1;
        return parseInt(hash, 16) / 0x100000000 <
            FUSION_TWIN_THRESHOLD
            ? 2
            : 1;
    }

    selectOffspringIdentity(request) {
        if (!this.validateRequest(request)) {
            throw new Error('fusion_request_invalid');
        }
        if (request.contractVersion !== FUSION_AUTHORITY_CONTRACT_VERSION) {
            return {
                offspringCount: request.offspringCount,
                offspringIds: [...request.offspringIds]
            };
        }
        const offspringCount = this.selectOffspringCount(
            request.requestFingerprint,
            request.offspringCapacity
        );
        return {
            offspringCount,
            offspringIds: request.candidateOffspringIds.slice(
                0,
                offspringCount
            )
        };
    }

    createRequest(options = {}) {
        const {
            transaction,
            parents,
            expectedSaveRevision = 0,
            requestedAt = transaction?.createdAt
        } = options;
        if (!transaction?.operationId || !Array.isArray(transaction.parentIds)) {
            throw new Error('fusion_transaction_required');
        }
        if (!Array.isArray(parents) || parents.length !== 2) {
            throw new Error('fusion_parent_proofs_required');
        }

        const parentsById = new Map(parents.map(parent => [parent?.id, parent]));
        const parentProofs = transaction.parentIds.map(parentId => {
            const parent = parentsById.get(parentId);
            if (!parent) {
                throw new Error('fusion_parent_mismatch');
            }
            return this.createParentProof(parent);
        });
        const candidateOffspringIds = Array.isArray(
            transaction.candidateOffspringIds
        )
            ? [...transaction.candidateOffspringIds]
            : [...(transaction.offspringIds || [])];
        const offspringCapacity = Math.min(
            2,
            Math.max(
                1,
                Number(transaction.offspringCapacity) ||
                    candidateOffspringIds.length ||
                    1
            )
        );
        const consentReceipt = transaction.consentReceipt;
        if (
            typeof globalThis?.FusionConsent
                ?.validateFusionConsentReceipt === 'function' &&
            !globalThis.FusionConsent.validateFusionConsentReceipt(
                consentReceipt,
                transaction.operationId,
                transaction.parentIds
            )
        ) {
            throw new Error('fusion_consent_required');
        }
        const request = {
            schemaVersion: FUSION_AUTHORITY_SCHEMA_VERSION,
            contractVersion: FUSION_AUTHORITY_CONTRACT_VERSION,
            operationId: transaction.operationId,
            parentIds: [...transaction.parentIds],
            candidateOffspringIds,
            offspringCapacity,
            expectedSaveRevision: Math.max(0, Number(expectedSaveRevision) || 0),
            requestedAt: Number(requestedAt) || Date.now(),
            resultSeed: transaction.resultSeed || this.deriveResultSeed(
                transaction.operationId,
                transaction.parentIds
            ),
            executionMode: 'local_fallback',
            consent: {
                mode: 'same_save_owner',
                scope: 'local_sanctuary',
                keeperGrant: consentReceipt?.keeperGrant || 'confirmed',
                parentGrants: (
                    consentReceipt?.companionGrants ||
                    transaction.parentIds.map(creatureId => ({
                        creatureId,
                        grant: 'lineage_synthesis',
                        decision: 'willing'
                    }))
                ).map(grant => ({
                    creatureId: grant.creatureId,
                    grant: 'lineage_synthesis',
                    decision: 'willing'
                })),
                sharedInvitationId: null
            },
            parentProofs
        };

        return {
            ...request,
            requestFingerprint: this.fingerprint(request)
        };
    }

    validateRequest(request) {
        const proofIds = Array.isArray(request?.parentProofs)
            ? request.parentProofs.map(proof => proof?.creatureId)
            : [];
        const grantIds = Array.isArray(request?.consent?.parentGrants)
            ? request.consent.parentGrants
                .filter(grant => (
                    grant?.grant === 'lineage_synthesis' &&
                    (
                        request?.contractVersion !==
                            FUSION_AUTHORITY_CONTRACT_VERSION ||
                        grant?.decision === 'willing'
                    )
                ))
                .map(grant => grant.creatureId)
            : [];
        const legacy = request?.contractVersion !==
            FUSION_AUTHORITY_CONTRACT_VERSION;
        const candidateIds = legacy
            ? request?.offspringIds
            : request?.candidateOffspringIds;
        const capacity = legacy
            ? request?.offspringCount
            : request?.offspringCapacity;
        if (
            !request ||
            request.schemaVersion !== FUSION_AUTHORITY_SCHEMA_VERSION ||
            (
                !legacy &&
                request.contractVersion !==
                    FUSION_AUTHORITY_CONTRACT_VERSION
            ) ||
            typeof request.operationId !== 'string' ||
            !Array.isArray(request.parentIds) ||
            new Set(request.parentIds).size !== 2 ||
            !Array.isArray(candidateIds) ||
            ![1, 2].includes(Number(capacity)) ||
            candidateIds.length !== Number(capacity) ||
            new Set(candidateIds).size !== candidateIds.length ||
            request.consent?.mode !== 'same_save_owner' ||
            (
                !legacy &&
                (
                    request.consent?.scope !== 'local_sanctuary' ||
                    request.consent?.keeperGrant !== 'confirmed' ||
                    request.consent?.sharedInvitationId != null
                )
            ) ||
            JSON.stringify(proofIds) !== JSON.stringify(request.parentIds) ||
            JSON.stringify(grantIds) !== JSON.stringify(request.parentIds)
        ) {
            return false;
        }

        const unsigned = { ...request };
        delete unsigned.requestFingerprint;
        return request.requestFingerprint === this.fingerprint(unsigned);
    }

    compareReplay(existingRequest, incomingRequest) {
        if (existingRequest?.operationId !== incomingRequest?.operationId) {
            return { replay: false, compatible: true };
        }
        const compatible = (
            this.validateRequest(existingRequest) &&
            this.validateRequest(incomingRequest) &&
            existingRequest.requestFingerprint === incomingRequest.requestFingerprint
        );
        return {
            replay: true,
            compatible,
            reason: compatible ? 'idempotent_replay' : 'operation_replay_mismatch'
        };
    }

    isReservationIntegrityError(error) {
        const code = String(error?.code || '');
        const message = String(error?.message || '');
        return (
            ['22023', '23505', '40001', '42501'].includes(code) ||
            message.includes('save_revision_conflict') ||
            message.includes('fusion_operation_replay_mismatch') ||
            message.includes('fusion_parent_ownership_or_eligibility_failed') ||
            message.includes('fusion_collection_capacity')
        );
    }

    async reserveOperation(request, options = {}) {
        if (!this.validateRequest(request)) {
            throw new Error('fusion_request_invalid');
        }

        const cloudSave = options.cloudSave ||
            (typeof globalThis !== 'undefined' ? globalThis.CloudSave : null);
        const selected = this.selectOffspringIdentity(request);
        if (!cloudSave?.isEnabled?.()) {
            return {
                schemaVersion: FUSION_AUTHORITY_SCHEMA_VERSION,
                operationId: request.operationId,
                reservationMode: 'local_only',
                requestFingerprint: request.requestFingerprint,
                ...selected,
                reconciliationRequired: false
            };
        }

        const client = cloudSave.client;
        if (!client?.rpc || typeof cloudSave.ensureSession !== 'function') {
            return {
                schemaVersion: FUSION_AUTHORITY_SCHEMA_VERSION,
                operationId: request.operationId,
                reservationMode: 'local_offline',
                requestFingerprint: request.requestFingerprint,
                ...selected,
                reconciliationRequired: true,
                reason: 'reservation_service_unavailable'
            };
        }

        try {
            await cloudSave.ensureSession();
            const { data, error } = await client.rpc('reserve_fusion_operation', {
                p_request: request
            });
            if (error) throw error;
            if (
                data?.operationId !== request.operationId ||
                data?.requestFingerprint !== request.requestFingerprint ||
                data?.reservationMode !== 'server_reserved' ||
                ![1, 2].includes(Number(data?.offspringCount)) ||
                !Array.isArray(data?.offspringIds) ||
                data.offspringIds.length !== Number(data.offspringCount)
            ) {
                throw new Error('fusion_reservation_response_invalid');
            }
            return {
                schemaVersion: Number(data.schemaVersion) ||
                    FUSION_AUTHORITY_SCHEMA_VERSION,
                operationId: data.operationId,
                reservationMode: data.reservationMode,
                requestFingerprint: data.requestFingerprint,
                offspringCount: Number(data.offspringCount),
                offspringIds: [...data.offspringIds],
                serverFingerprint: data.serverFingerprint,
                serverResultSeed: data.resultSeed,
                status: data.status,
                expiresAt: data.expiresAt,
                replay: Boolean(data.replay),
                reconciliationRequired: false
            };
        } catch (error) {
            if (this.isReservationIntegrityError(error)) {
                error.name = 'FusionAuthorityReservationError';
                throw error;
            }
            return {
                schemaVersion: FUSION_AUTHORITY_SCHEMA_VERSION,
                operationId: request.operationId,
                reservationMode: 'local_offline',
                requestFingerprint: request.requestFingerprint,
                ...selected,
                reconciliationRequired: true,
                reason: 'network_unavailable'
            };
        }
    }

    validateServerExecution(request, reservation, execution) {
        const outcome = execution?.outcome;
        const receipt = execution?.receipt;
        return Boolean(
            request &&
            reservation?.reservationMode === 'server_reserved' &&
            execution?.operationId === request.operationId &&
            outcome?.schemaVersion === request.schemaVersion &&
            outcome?.operationId === request.operationId &&
            Array.isArray(outcome?.offspring) &&
            outcome.offspring.length === reservation.offspringCount &&
            outcome.offspring.every((child, index) => (
                child?.offspringData?.creatureId ===
                    reservation.offspringIds[index]
            )) &&
            receipt?.schemaVersion === request.schemaVersion &&
            receipt?.operationId === request.operationId &&
            receipt?.authority === 'server_generated' &&
            receipt?.requestFingerprint === request.requestFingerprint &&
            receipt?.serverFingerprint === reservation.serverFingerprint &&
            receipt?.resultFingerprint === this.fingerprint(outcome)
        );
    }

    async executeReservedOperation(request, reservation, options = {}) {
        if (reservation?.reservationMode !== 'server_reserved') {
            return null;
        }
        if (!this.validateRequest(request)) {
            throw new Error('fusion_request_invalid');
        }

        const cloudSave = options.cloudSave ||
            (typeof globalThis !== 'undefined' ? globalThis.CloudSave : null);
        const client = cloudSave?.client;
        if (
            !client?.functions?.invoke ||
            typeof cloudSave.ensureSession !== 'function'
        ) {
            const unavailable = new Error('fusion_execution_service_unavailable');
            unavailable.name = 'FusionAuthorityExecutionError';
            throw unavailable;
        }

        await cloudSave.ensureSession();
        const { data, error } = await client.functions.invoke(
            'execute-fusion',
            {
                body: {
                    operationId: request.operationId
                }
            }
        );
        if (error) {
            const executionError = new Error(
                error.message || 'fusion_execution_failed',
                { cause: error }
            );
            executionError.name = 'FusionAuthorityExecutionError';
            executionError.code = error.code || 'fusion_execution_failed';
            throw executionError;
        }

        const execution = {
            operationId: data?.operationId,
            outcome: data?.outcome,
            receipt: data?.receipt,
            replay: Boolean(data?.replay)
        };
        if (!this.validateServerExecution(request, reservation, execution)) {
            const invalid = new Error('fusion_server_execution_invalid');
            invalid.name = 'FusionAuthorityExecutionError';
            throw invalid;
        }
        return execution;
    }

    normalizeNames(names, expectedCount) {
        if (!Array.isArray(names) || names.length !== expectedCount) {
            return null;
        }
        const normalized = names.map(value => String(value || '').trim());
        return normalized.every(name => (
            name.length >= 1 &&
            name.length <= 20 &&
            /^[\p{L}\p{N} '\-_]+$/u.test(name)
        ))
            ? normalized
            : null;
    }

    validateServerFinalization(
        request,
        reservation,
        executionReceipt,
        names,
        finalization
    ) {
        const normalizedNames = this.normalizeNames(
            names,
            reservation?.offspringCount
        );
        const collection = Array.isArray(finalization?.gameState?.creatures)
            ? finalization.gameState.creatures
            : [];
        const offspring = reservation?.offspringIds?.map(id => (
            collection.find(creature => creature?.id === id)
        ));
        const firstOffspringIndex = collection.findIndex(
            creature => creature?.id === reservation?.offspringIds?.[0]
        );
        const completedIds =
            finalization?.gameState?.breedingShrine?.completedOperationIds;
        const history =
            finalization?.gameState?.breedingShrine?.breedingHistory;
        const receipt = finalization?.receipt;

        return Boolean(
            this.validateRequest(request) &&
            normalizedNames &&
            reservation?.reservationMode === 'server_reserved' &&
            finalization?.schemaVersion === request.schemaVersion &&
            finalization?.operationId === request.operationId &&
            finalization?.status === 'committed' &&
            Number.isInteger(Number(finalization?.revision)) &&
            Number(finalization.revision) >= 1 &&
            Array.isArray(finalization?.offspringIds) &&
            JSON.stringify(finalization.offspringIds) ===
                JSON.stringify(reservation.offspringIds) &&
            offspring?.every((creature, index) => (
                creature?.id === reservation.offspringIds[index] &&
                creature?.name === normalizedNames[index] &&
                creature?.lineage?.fusionOperationId === request.operationId &&
                collection.filter(entry => entry?.id === creature.id).length === 1
            )) &&
            firstOffspringIndex >= 0 &&
            Number(finalization.gameState.activeCreatureIndex) ===
                firstOffspringIndex &&
            finalization.gameState.creature?.id ===
                reservation.offspringIds[0] &&
            finalization.gameState.breedingShrine?.pendingFusion === null &&
            Array.isArray(completedIds) &&
            completedIds.includes(request.operationId) &&
            Array.isArray(history) &&
            history.some(entry => (
                entry?.operationId === request.operationId &&
                entry?.authority === 'server_generated'
            )) &&
            receipt?.schemaVersion === request.schemaVersion &&
            receipt?.operationId === request.operationId &&
            receipt?.authority === 'server_finalized' &&
            receipt?.requestFingerprint === request.requestFingerprint &&
            receipt?.serverFingerprint === reservation.serverFingerprint &&
            receipt?.resultFingerprint === executionReceipt?.resultFingerprint &&
            Number(receipt?.saveRevision) <= Number(finalization.revision) &&
            receipt?.receiptFingerprint?.startsWith('fusion-commit-v1:')
        );
    }

    async finalizeReservedOperation(
        request,
        reservation,
        executionReceipt,
        names,
        options = {}
    ) {
        if (reservation?.reservationMode !== 'server_reserved') {
            return null;
        }
        if (!this.validateRequest(request)) {
            throw new Error('fusion_request_invalid');
        }
        const normalizedNames = this.normalizeNames(
            names,
            reservation?.offspringCount
        );
        if (!normalizedNames) {
            throw new Error('fusion_names_invalid');
        }

        const cloudSave = options.cloudSave ||
            (typeof globalThis !== 'undefined' ? globalThis.CloudSave : null);
        const client = cloudSave?.client;
        if (
            !client?.functions?.invoke ||
            typeof cloudSave.ensureSession !== 'function' ||
            typeof cloudSave.performServerMutation !== 'function'
        ) {
            const unavailable = new Error(
                'fusion_finalization_service_unavailable'
            );
            unavailable.name = 'FusionAuthorityFinalizationError';
            throw unavailable;
        }

        return cloudSave.performServerMutation(async () => {
            await cloudSave.ensureSession();
            const { data, error } = await client.functions.invoke(
                'finalize-fusion',
                {
                    body: {
                        operationId: request.operationId,
                        names: normalizedNames
                    }
                }
            );
            if (error) {
                const finalizationError = new Error(
                    error.message || 'fusion_finalization_failed',
                    { cause: error }
                );
                finalizationError.name = 'FusionAuthorityFinalizationError';
                finalizationError.code =
                    error.code || 'fusion_finalization_failed';
                throw finalizationError;
            }
            if (!this.validateServerFinalization(
                request,
                reservation,
                executionReceipt,
                normalizedNames,
                data
            )) {
                const invalid = new Error(
                    'fusion_server_finalization_invalid'
                );
                invalid.name = 'FusionAuthorityFinalizationError';
                throw invalid;
            }
            return {
                ...data,
                names: normalizedNames
            };
        });
    }

    createLocalReceipt(
        request,
        result,
        completedAt = Date.now(),
        reservation = null
    ) {
        if (!this.validateRequest(request)) {
            throw new Error('fusion_request_invalid');
        }

        const serverReserved = reservation?.reservationMode === 'server_reserved';
        const receipt = {
            schemaVersion: request.schemaVersion,
            operationId: request.operationId,
            authority: serverReserved
                ? 'server_reserved_local_result'
                : 'local_fallback',
            requestFingerprint: request.requestFingerprint,
            resultFingerprint: this.fingerprint(result),
            resultSeed: request.resultSeed,
            serverFingerprint: serverReserved
                ? reservation.serverFingerprint
                : null,
            reconciliationRequired: Boolean(
                reservation?.reconciliationRequired
            ),
            completedAt: Number(completedAt) || Date.now()
        };
        return {
            ...receipt,
            receiptFingerprint: this.fingerprint(receipt)
        };
    }

    validateReceipt(request, result, receipt) {
        if (!this.validateRequest(request) || !receipt) return false;
        const unsigned = { ...receipt };
        delete unsigned.receiptFingerprint;
        return (
            receipt.schemaVersion === request.schemaVersion &&
            receipt.operationId === request.operationId &&
            receipt.requestFingerprint === request.requestFingerprint &&
            receipt.resultFingerprint === this.fingerprint(result) &&
            receipt.receiptFingerprint === this.fingerprint(unsigned)
        );
    }

    normalizeReconciliationRecord(record) {
        const request = record?.request;
        const receipt = record?.receipt;
        const unsignedReceipt = receipt
            ? { ...receipt }
            : null;
        if (unsignedReceipt) {
            delete unsignedReceipt.receiptFingerprint;
        }
        const selected = this.validateRequest(request)
            ? this.selectOffspringIdentity(request)
            : null;
        const names = this.normalizeNames(
            record?.names,
            Number(record?.offspringCount)
        );
        if (
            !this.validateRequest(request) ||
            !receipt ||
            receipt.operationId !== request.operationId ||
            receipt.requestFingerprint !== request.requestFingerprint ||
            receipt.reconciliationRequired !== true ||
            receipt.receiptFingerprint !==
                this.fingerprint(unsignedReceipt) ||
            !names ||
            !Array.isArray(record?.offspringIds) ||
            record.offspringIds.length !== record.offspringCount ||
            selected?.offspringCount !== Number(record.offspringCount) ||
            JSON.stringify(selected?.offspringIds) !==
                JSON.stringify(record.offspringIds)
        ) {
            return null;
        }
        return {
            schemaVersion: request.schemaVersion,
            operationId: request.operationId,
            request,
            receipt,
            offspringIds: [...record.offspringIds],
            offspringCount: Number(record.offspringCount),
            names,
            queuedAt: Number(record.queuedAt) || Date.now(),
            status: 'pending'
        };
    }

    async reconcileOfflineReceipt(record, options = {}) {
        const normalized = this.normalizeReconciliationRecord(record);
        if (!normalized) {
            throw new Error('fusion_reconciliation_record_invalid');
        }
        const cloudSave = options.cloudSave ||
            (typeof globalThis !== 'undefined' ? globalThis.CloudSave : null);
        if (!cloudSave?.isEnabled?.()) {
            throw new Error('fusion_reconciliation_cloud_unavailable');
        }

        const reservation = await this.reserveOperation(
            normalized.request,
            { cloudSave }
        );
        if (reservation.reservationMode !== 'server_reserved') {
            throw new Error('fusion_reconciliation_deferred');
        }
        if (
            reservation.offspringCount !== normalized.offspringCount ||
            JSON.stringify(reservation.offspringIds) !==
                JSON.stringify(normalized.offspringIds)
        ) {
            throw new Error('fusion_reconciliation_identity_mismatch');
        }

        const execution = await this.executeReservedOperation(
            normalized.request,
            reservation,
            { cloudSave }
        );
        const finalization = await this.finalizeReservedOperation(
            normalized.request,
            reservation,
            execution.receipt,
            normalized.names,
            { cloudSave }
        );
        return {
            operationId: normalized.operationId,
            reservation,
            execution,
            finalization
        };
    }

    createSeededRandom(seed) {
        let state = parseInt(this.fingerprint(String(seed)).split(':').pop(), 16) >>> 0;
        return () => {
            state = (state + 0x6D2B79F5) >>> 0;
            let value = state;
            value = Math.imul(value ^ (value >>> 15), value | 1);
            value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
            return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };
    }

    enterDeterministicRandomScope(seed, phaser = globalThis.Phaser) {
        const random = this.createSeededRandom(seed);
        const originalRandom = Math.random;
        const originalBetween = phaser?.Math?.Between;
        const originalFloatBetween = phaser?.Math?.FloatBetween;
        let restored = false;

        Math.random = random;
        if (phaser?.Math) {
            phaser.Math.Between = (min, max) => (
                Math.floor(random() * (max - min + 1)) + min
            );
            phaser.Math.FloatBetween = (min, max) => random() * (max - min) + min;
        }

        return () => {
            if (restored) return;
            restored = true;
            Math.random = originalRandom;
            if (phaser?.Math && originalBetween) {
                phaser.Math.Between = originalBetween;
            }
            if (phaser?.Math && originalFloatBetween) {
                phaser.Math.FloatBetween = originalFloatBetween;
            }
        };
    }
}

const fusionAuthority = new FusionAuthority();

if (typeof globalThis !== 'undefined') {
    globalThis.FusionAuthority = fusionAuthority;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FusionAuthority,
        fusionAuthority,
        FUSION_AUTHORITY_SCHEMA_VERSION,
        FUSION_AUTHORITY_CONTRACT_VERSION
    };
}
