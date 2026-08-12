const fs = require('fs');
const path = require('path');
const { FusionAuthority } = require('../src/systems/FusionAuthority.js');

function readEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return Object.fromEntries(
        fs.readFileSync(filePath, 'utf8')
            .split(/\r?\n/)
            .filter(line => line && !line.startsWith('#'))
            .map(line => {
                const separator = line.indexOf('=');
                return [
                    line.slice(0, separator),
                    line.slice(separator + 1)
                ];
            })
    );
}

function fail(message) {
    throw new Error(message);
}

async function run() {
    const env = {
        ...readEnvFile(path.join(__dirname, '..', '.env.local')),
        ...process.env
    };
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) {
        fail('Supabase smoke test requires local public client configuration.');
    }

    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(supabaseUrl, publishableKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
    const authority = new FusionAuthority();
    let user = null;
    let smokeResult = null;

    try {
        const authResult = await client.auth.signInAnonymously();
        if (authResult.error || !authResult.data.user?.id) {
            fail(`Anonymous authentication failed: ${authResult.error?.message}`);
        }
        user = authResult.data.user;

        const now = Date.now();
        const parents = [
            {
                id: 'smoke_parent_alpha',
                generation: 1,
                rarity: 'rare',
                genes: { id: 'smoke_genes_alpha', rarity: 'rare' },
                lifecycle: {
                    stage: 'adult',
                    birthDate: now - 3 * 24 * 60 * 60 * 1000
                }
            },
            {
                id: 'smoke_parent_beta',
                generation: 1,
                rarity: 'epic',
                genes: { id: 'smoke_genes_beta', rarity: 'epic' },
                lifecycle: {
                    stage: 'elder',
                    birthDate: now - 12 * 24 * 60 * 60 * 1000
                }
            }
        ];
        const saveState = {
            version: '1.1.0',
            savedAt: now,
            maxCreatures: 8,
            creatures: parents
        };
        const saveResult = await client.rpc('save_game_state', {
            p_save_slot: 'primary',
            p_save_version: '1.1.0',
            p_game_state: saveState,
            p_client_saved_at: new Date(now).toISOString(),
            p_expected_revision: 0
        });
        if (saveResult.error || saveResult.data?.revision !== 1) {
            fail(`Atomic save failed: ${saveResult.error?.message}`);
        }
        const bypassAttempt = await client
            .from('game_saves')
            .update({
                game_state: {
                    ...saveState,
                    savedAt: now + 1
                }
            })
            .eq('user_id', user.id)
            .eq('save_slot', 'primary');
        if (!bypassAttempt.error) {
            fail('Direct cloud-save update unexpectedly bypassed the revision RPC.');
        }

        const operationId = `fusion_smoke_${now}`;
        const candidateOffspringIds = [
            `creature_smoke_${now}_a`,
            `creature_smoke_${now}_b`
        ];
        const transaction = {
            schemaVersion: 2,
            operationId,
            parentIds: parents.map(parent => parent.id),
            candidateOffspringIds,
            offspringCapacity: 2,
            offspringIds: [...candidateOffspringIds],
            offspringCount: 2,
            createdAt: now,
            resultSeed: authority.deriveResultSeed(
                operationId,
                parents.map(parent => parent.id)
            ),
            status: 'pending',
            consentReceipt: {
                schemaVersion: 1,
                operationId,
                mode: 'same_save_owner',
                scope: 'local_sanctuary',
                parentIds: parents.map(parent => parent.id),
                keeperGrant: 'confirmed',
                companionGrants: parents.map(parent => ({
                    creatureId: parent.id,
                    grant: 'lineage_synthesis',
                    decision: 'willing'
                })),
                sharedInvitationId: null,
                recordedAt: new Date(now).toISOString()
            }
        };
        const request = authority.createRequest({
            transaction,
            parents,
            expectedSaveRevision: 1
        });
        if (
            request.contractVersion !== 2 ||
            request.offspringCount !== undefined ||
            request.offspringIds !== undefined ||
            request.candidateOffspringIds.length !== 2
        ) {
            fail('Fusion request did not use the v2 authority contract.');
        }
        const reservation = await client.rpc('reserve_fusion_operation', {
            p_request: request
        });
        if (
            reservation.error ||
            reservation.data?.reservationMode !== 'server_reserved' ||
            reservation.data?.replay !== false ||
            ![1, 2].includes(reservation.data?.offspringCount) ||
            reservation.data?.offspringIds?.length !==
                reservation.data?.offspringCount ||
            JSON.stringify(reservation.data?.offspringIds) !==
                JSON.stringify(
                    candidateOffspringIds.slice(
                        0,
                        reservation.data?.offspringCount
                    )
                )
        ) {
            fail(`Fusion reservation failed: ${reservation.error?.message}`);
        }
        const selectedOffspringIds = reservation.data.offspringIds;
        const selectedNames = selectedOffspringIds.map(
            (_id, index) => `Smoke Nova ${index + 1}`
        );

        const directContext = await client.rpc(
            'get_fusion_execution_context',
            {
                p_user_id: user.id,
                p_operation_id: operationId
            }
        );
        if (!directContext.error) {
            fail('Player session unexpectedly accessed the internal Fusion RPC.');
        }

        const execution = await client.functions.invoke('execute-fusion', {
            body: { operationId }
        });
        if (
            execution.error ||
            !authority.validateServerExecution(
                request,
                reservation.data,
                execution.data
            )
        ) {
            fail(
                `Server Fusion execution failed: ${execution.error?.message}`
            );
        }
        const firstReceiptFingerprint =
            execution.data.receipt.receiptFingerprint;
        const firstOutcomeFingerprint = authority.fingerprint(
            execution.data.outcome
        );

        const executionReplay = await client.functions.invoke(
            'execute-fusion',
            { body: { operationId } }
        );
        if (
            executionReplay.error ||
            executionReplay.data?.replay !== true ||
            executionReplay.data?.receipt?.receiptFingerprint !==
                firstReceiptFingerprint ||
            authority.fingerprint(executionReplay.data?.outcome) !==
                firstOutcomeFingerprint
        ) {
            fail(
                `Server Fusion result replay failed: ${
                    executionReplay.error?.message
                }`
            );
        }

        const directFinalization = await client.rpc(
            'finalize_fusion_operation',
            {
                p_user_id: user.id,
                p_operation_id: operationId,
                p_names: ['Smoke Nova']
            }
        );
        if (!directFinalization.error) {
            fail(
                'Player session unexpectedly accessed Fusion finalization RPC.'
            );
        }

        const finalization = await client.functions.invoke(
            'finalize-fusion',
            {
                body: {
                    operationId,
                    names: selectedNames
                }
            }
        );
        const committedChildren = selectedOffspringIds.map(
            (offspringId, index) => (
                finalization.data?.gameState?.creatures?.find(
                    creature => creature?.id === offspringId
                )
            )
        );
        if (
            finalization.error ||
            finalization.data?.status !== 'committed' ||
            finalization.data?.revision !== 2 ||
            committedChildren.some((child, index) => (
                child?.name !== selectedNames[index] ||
                child?.genes?.metadata?.authority !==
                    'server_generated' ||
                child?.lineage?.fusionOperationId !== operationId
            )) ||
            finalization.data?.gameState?.breedingShrine?.pendingFusion !==
                null
        ) {
            fail(
                `Atomic Fusion finalization failed: ${
                    finalization.error?.message
                }`
            );
        }
        const commitReceiptFingerprint =
            finalization.data.receipt?.receiptFingerprint;

        const finalizationReplay = await client.functions.invoke(
            'finalize-fusion',
            {
                body: {
                    operationId,
                    names: selectedNames
                }
            }
        );
        if (
            finalizationReplay.error ||
            finalizationReplay.data?.replay !== true ||
            finalizationReplay.data?.revision !== 2 ||
            finalizationReplay.data?.receipt?.receiptFingerprint !==
                commitReceiptFingerprint
        ) {
            fail(
                `Atomic Fusion replay failed: ${
                    finalizationReplay.error?.message
                }`
            );
        }

        const renamedReplay = await client.functions.invoke(
            'finalize-fusion',
            {
                body: {
                    operationId,
                    names: ['Altered Nova']
                }
            }
        );
        if (!renamedReplay.error) {
            fail('Altered Fusion finalization replay was not rejected.');
        }

        const reservationReplay = await client.rpc('reserve_fusion_operation', {
            p_request: request
        });
        if (
            reservationReplay.error ||
            reservationReplay.data?.replay !== true
        ) {
            fail(
                `Idempotent reservation replay failed: ${
                    reservationReplay.error?.message
                }`
            );
        }

        const tampered = {
            ...request,
            candidateOffspringIds: [
                `creature_tampered_${now}`,
                request.candidateOffspringIds[1]
            ]
        };
        delete tampered.requestFingerprint;
        tampered.requestFingerprint = authority.fingerprint(tampered);
        const mismatch = await client.rpc('reserve_fusion_operation', {
            p_request: tampered
        });
        if (
            !mismatch.error ||
            !String(mismatch.error.message).includes(
                'fusion_operation_replay_mismatch'
            )
        ) {
            fail('Operation replay mismatch was not rejected.');
        }

        smokeResult = {
            anonymousAuth: true,
            atomicSave: true,
            directWriteBypassRejected: true,
            ownershipReservation: true,
            explicitConsentValidated: true,
            authoritySelectedOffspringCount: true,
            internalRpcProtected: true,
            serverOutcomeGenerated: true,
            deterministicResultReplay: true,
            finalizationRpcProtected: true,
            atomicLineageCommit: true,
            deterministicCommitReplay: true,
            alteredNameReplayRejected: true,
            idempotentReservationReplay: true,
            tamperRejected: true
        };
    } finally {
        if (user) {
            const deletion = await client.functions.invoke(
                'delete-cloud-identity'
            );
            if (deletion.error) {
                throw new Error(
                    `Smoke data cleanup failed: ${deletion.error.message}`
                );
            }
        }
        await client.auth.signOut({ scope: 'local' });
    }

    process.stdout.write(JSON.stringify({
        ...smokeResult,
        cleanup: true
    }));
}

run().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
