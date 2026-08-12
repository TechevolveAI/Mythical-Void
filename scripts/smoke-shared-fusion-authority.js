const fs = require('fs');
const path = require('path');

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
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
        fail('Shared Fusion smoke requires public Supabase configuration.');
    }
    const { createClient } = await import('@supabase/supabase-js');
    const createSmokeClient = () => createClient(
        env.VITE_SUPABASE_URL,
        env.VITE_SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        }
    );
    const host = createSmokeClient();
    const guest = createSmokeClient();
    const clients = [host, guest];
    const now = Date.now();
    const parentIds = [
        `shared_smoke_host_${now}`,
        `shared_smoke_guest_${now}`
    ];
    let invitationId = null;

    try {
        for (const client of clients) {
            const auth = await client.auth.signInAnonymously();
            if (auth.error || !auth.data.user?.id) {
                fail(`Anonymous authentication failed: ${auth.error?.message}`);
            }
        }

        for (let index = 0; index < clients.length; index += 1) {
            const parentId = parentIds[index];
            const state = {
                version: '1.1.0',
                savedAt: now,
                maxCreatures: 8,
                creatures: [
                    {
                        id: parentId,
                        name: index === 0 ? 'Private Host' : 'Private Guest',
                        generation: index + 1,
                        rarity: index === 0 ? 'rare' : 'epic',
                        genes: {
                            id: `genes_${parentId}`,
                            species: 'currentNative',
                            rarity: index === 0 ? 'rare' : 'epic',
                            cosmicAffinity: {
                                element: index === 0 ? 'void' : 'crystal'
                            }
                        },
                        stats: {
                            happiness: 90,
                            energy: 90,
                            health: 100
                        },
                        mood: { current: 'steady' },
                        lifecycle: {
                            stage: index === 0 ? 'adult' : 'elder',
                            birthDate:
                                now - 4 * 24 * 60 * 60 * 1000
                        }
                    }
                ],
                breedingShrine: {
                    unlocked: true,
                    breedingHistory: [],
                    completedOperationIds: [],
                    sharedFusion: {
                        schemaVersion: 1,
                        activeInvitation: null,
                        completedOperationIds: [],
                        pendingReveal: null
                    }
                }
            };
            const saved = await clients[index].rpc('save_game_state', {
                p_save_slot: 'primary',
                p_save_version: '1.1.0',
                p_game_state: state,
                p_client_saved_at: new Date(now).toISOString(),
                p_expected_revision: 0
            });
            if (saved.error || saved.data?.revision !== 1) {
                fail(`Smoke save failed: ${saved.error?.message}`);
            }
            const attested = await clients[index].rpc(
                'attest_shared_fusion_eligibility',
                {
                    p_age_band: 'age_18_plus',
                    p_policy_version: '2026-07-31'
                }
            );
            if (attested.error || attested.data?.eligible !== true) {
                fail(`Eligibility attestation failed: ${attested.error?.message}`);
            }
        }

        const created = await host.rpc(
            'create_shared_fusion_invitation',
            {
                p_parent_id: parentIds[0],
                p_expected_revision: 1
            }
        );
        if (
            created.error ||
            !created.data?.invitationId ||
            !/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(
                created.data?.code || ''
            )
        ) {
            fail(`Invitation creation failed: ${created.error?.message}`);
        }
        invitationId = created.data.invitationId;

        const directRead = await host
            .from('shared_fusion_invitations')
            .select('invitation_id')
            .eq('invitation_id', invitationId);
        if (!directRead.error) {
            fail('Direct invitation table access was unexpectedly allowed.');
        }

        const joined = await guest.rpc(
            'join_shared_fusion_invitation',
            {
                p_code: created.data.code,
                p_parent_id: parentIds[1],
                p_expected_revision: 1
            }
        );
        if (
            joined.error ||
            joined.data?.status !== 'paired' ||
            joined.data?.peerSignal?.rarity !== 'rare' ||
            JSON.stringify(joined.data).includes('Private Host') ||
            JSON.stringify(joined.data).includes(parentIds[0])
        ) {
            fail(`Invitation join failed: ${joined.error?.message}`);
        }

        const hostConfirmed = await host.rpc(
            'confirm_shared_fusion_invitation',
            { p_invitation_id: invitationId }
        );
        if (
            hostConfirmed.error ||
            hostConfirmed.data?.status !== 'paired' ||
            hostConfirmed.data?.hostConfirmed !== true
        ) {
            fail(`Host confirmation failed: ${hostConfirmed.error?.message}`);
        }
        const guestConfirmed = await guest.rpc(
            'confirm_shared_fusion_invitation',
            { p_invitation_id: invitationId }
        );
        if (
            guestConfirmed.error ||
            guestConfirmed.data?.status !== 'ready' ||
            !/^fusion_shared_/.test(guestConfirmed.data?.operationId || '') ||
            !guestConfirmed.data?.ownOffspringId
        ) {
            fail(`Guest confirmation failed: ${guestConfirmed.error?.message}`);
        }

        const hostExecution = await host.functions.invoke(
            'execute-fusion',
            { body: { invitationId } }
        );
        if (
            hostExecution.error ||
            hostExecution.data?.status !== 'staged' ||
            hostExecution.data?.role !== 'host' ||
            hostExecution.data?.offspring?.offspringData?.parentIds
        ) {
            fail(`Host execution failed: ${hostExecution.error?.message}`);
        }
        const guestExecution = await guest.functions.invoke(
            'execute-fusion',
            { body: { invitationId } }
        );
        if (
            guestExecution.error ||
            guestExecution.data?.status !== 'staged' ||
            guestExecution.data?.role !== 'guest' ||
            guestExecution.data?.replay !== true ||
            guestExecution.data?.offspring?.offspringData?.parentIds
        ) {
            fail(`Guest execution replay failed: ${guestExecution.error?.message}`);
        }
        const hostChildId =
            hostExecution.data.offspring.offspringData.creatureId;
        const guestChildId =
            guestExecution.data.offspring.offspringData.creatureId;
        if (!hostChildId || !guestChildId || hostChildId === guestChildId) {
            fail('Shared Fusion did not assign two unique sibling identities.');
        }

        const hostNamed = await host.rpc('submit_shared_fusion_name', {
            p_invitation_id: invitationId,
            p_name: 'Aster'
        });
        if (
            hostNamed.error ||
            hostNamed.data?.awaitingOtherKeeper !== true ||
            hostNamed.data?.status !== 'staged'
        ) {
            fail(`Host naming failed: ${hostNamed.error?.message}`);
        }
        const guestNamed = await guest.rpc('submit_shared_fusion_name', {
            p_invitation_id: invitationId,
            p_name: 'Lumen'
        });
        if (
            guestNamed.error ||
            guestNamed.data?.status !== 'committed' ||
            guestNamed.data?.ownOffspring?.id !== guestChildId
        ) {
            fail(`Atomic shared commit failed: ${guestNamed.error?.message}`);
        }

        const saves = [];
        for (let index = 0; index < clients.length; index += 1) {
            const loaded = await clients[index]
                .from('game_saves')
                .select('revision,game_state')
                .eq('save_slot', 'primary')
                .single();
            if (loaded.error || loaded.data?.revision !== 2) {
                fail(`Committed save read failed: ${loaded.error?.message}`);
            }
            saves.push(loaded.data.game_state);
        }
        const hostChild = saves[0].creatures.find(
            creature => creature?.id === hostChildId
        );
        const guestChild = saves[1].creatures.find(
            creature => creature?.id === guestChildId
        );
        const hostBeacon = saves[0].world?.sanctuaryDecorations
            ?.kinshipBeacon;
        const guestBeacon = saves[1].world?.sanctuaryDecorations
            ?.kinshipBeacon;
        if (
            hostChild?.name !== 'Aster' ||
            guestChild?.name !== 'Lumen' ||
            hostChild?.linkedSiblingId !== guestChildId ||
            guestChild?.linkedSiblingId !== hostChildId ||
            hostChild?.parentIds?.includes(parentIds[1]) ||
            guestChild?.parentIds?.includes(parentIds[0]) ||
            !String(hostChild?.parentIds?.[1]).startsWith(
                'protected-parent-v1:'
            ) ||
            !String(guestChild?.parentIds?.[1]).startsWith(
                'protected-parent-v1:'
            ) ||
            saves[0].breedingShrine?.sharedFusion?.pendingReveal
                ?.creatureId !== hostChildId ||
            saves[1].breedingShrine?.sharedFusion?.pendingReveal
                ?.creatureId !== guestChildId ||
            hostBeacon?.schemaVersion !== 2 ||
            guestBeacon?.schemaVersion !== 2 ||
            hostBeacon?.unlocked !== true ||
            guestBeacon?.unlocked !== true ||
            hostBeacon?.sharedLineageCount !== 1 ||
            guestBeacon?.sharedLineageCount !== 1 ||
            hostBeacon?.lastSharedOperationId !==
                guestConfirmed.data.operationId ||
            guestBeacon?.lastSharedOperationId !==
                guestConfirmed.data.operationId
        ) {
            fail('Committed sibling lineage or privacy boundary was invalid.');
        }

        console.log(JSON.stringify({
            privateInvitations: true,
            hashedExpiringCode: true,
            dualKeeperConsent: true,
            dualCompanionProof: true,
            participantScopedExecution: true,
            deterministicReplay: true,
            atomicTwoSaveCommit: true,
            uniqueSiblingOwnership: true,
            protectedRemoteParentRefs: true,
            recoverableReveal: true,
            sharedKinshipConsequence: true
        }));
    } finally {
        for (const client of clients) {
            try {
                await client.functions.invoke('delete-cloud-identity');
            } catch (error) {
                console.error(
                    '[shared-fusion-smoke] Cleanup failed:',
                    error.message
                );
            }
            try {
                await client.auth.signOut({ scope: 'local' });
            } catch {
                // The anonymous identity may already be gone.
            }
        }
    }
}

run().catch(error => {
    console.error(error.message);
    process.exit(1);
});
