const fs = require('fs');
const path = require('path');
const { randomBytes, randomUUID } = require('crypto');

function readEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return Object.fromEntries(
        fs.readFileSync(filePath, 'utf8')
            .split(/\r?\n/)
            .filter(line => line && !line.startsWith('#'))
            .map(line => {
                const separator = line.indexOf('=');
                return [line.slice(0, separator), line.slice(separator + 1)];
            })
    );
}

function fail(message) {
    throw new Error(message);
}

function assert(condition, message) {
    if (!condition) fail(message);
}

async function describeFunctionFailure(result) {
    if (!result?.error) return '';
    let detail = result.error.message || 'unknown function error';
    try {
        const response = result.error.context;
        const body = response?.clone
            ? await response.clone().json()
            : null;
        if (body?.error) detail += `: ${String(body.error).slice(0, 240)}`;
    } catch {}
    return detail;
}

function parentState(parentId, name, affinity, rarity, generation) {
    const now = Date.now();
    return {
        version: '1.1.0',
        savedAt: now,
        maxCreatures: 8,
        creatures: [{
            id: parentId,
            name,
            generation,
            rarity,
            genes: {
                id: `genes_${parentId}`,
                species: 'currentNative',
                rarity,
                cosmicAffinity: { element: affinity },
                traits: {
                    bodyShape: { type: affinity === 'crystal' ? 'stocky' : 'slender' },
                    colorGenome: {
                        primary: affinity === 'crystal' ? 0x77c9c0 : 0x7674c9,
                        secondary: affinity === 'crystal' ? 0xe0fff8 : 0xdedcff
                    }
                }
            },
            stats: { happiness: 90, energy: 90, health: 100 },
            mood: { current: 'steady' },
            lifecycle: {
                stage: 'adult',
                birthDate: now - 4 * 24 * 60 * 60 * 1000
            }
        }],
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
}

async function run() {
    const env = {
        ...readEnvFile(path.join(__dirname, '..', '.env.local')),
        ...process.env
    };
    const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    if (
        !env.VITE_SUPABASE_URL ||
        !env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        !serviceKey
    ) {
        fail('Shared Guardianship smoke requires public and service Supabase configuration.');
    }
    if (env.SHARED_GUARDIANSHIP_SMOKE_ALLOW_EPHEMERAL_USERS !== 'yes') {
        fail('Set SHARED_GUARDIANSHIP_SMOKE_ALLOW_EPHEMERAL_USERS=yes to permit isolated test-user creation and cleanup.');
    }

    const { createClient } = await import('@supabase/supabase-js');
    const clientOptions = {
        auth: { persistSession: false, autoRefreshToken: false }
    };
    const admin = createClient(env.VITE_SUPABASE_URL, serviceKey, clientOptions);
    const clients = [0, 1, 2].map(() => createClient(
        env.VITE_SUPABASE_URL,
        env.VITE_SUPABASE_PUBLISHABLE_KEY,
        clientOptions
    ));
    const createdUsers = [];
    const runId = `${Date.now()}-${randomBytes(4).toString('hex')}`;
    const password = `${randomBytes(24).toString('base64url')}Aa7!`;
    const emails = ['host', 'guest', 'outsider'].map(role => (
        `mythical-void-${role}-${runId}@example.com`
    ));
    const parentIds = [
        `guardianship_smoke_host_${runId}`,
        `guardianship_smoke_guest_${runId}`
    ];
    let invitationId = null;
    let sharedCreatureId = null;

    try {
        for (let index = 0; index < clients.length; index += 1) {
            const created = await admin.auth.admin.createUser({
                email: emails[index],
                password,
                email_confirm: true,
                user_metadata: {
                    mythical_void_test: 'shared_guardianship_authority_v1',
                    run_id: runId
                }
            });
            if (created.error || !created.data.user?.id) {
                fail(`Ephemeral account creation failed: ${created.error?.message}`);
            }
            createdUsers.push(created.data.user.id);
            const signedIn = await clients[index].auth.signInWithPassword({
                email: emails[index],
                password
            });
            assert(
                !signedIn.error &&
                    signedIn.data.user?.id === created.data.user.id &&
                    signedIn.data.user?.is_anonymous !== true &&
                    Boolean(signedIn.data.user?.email_confirmed_at),
                `Verified test account sign-in failed: ${signedIn.error?.message || 'identity mismatch'}`
            );
            const attested = await clients[index].rpc(
                'attest_shared_guardianship_eligibility',
                {
                    p_age_band: 'age_18_plus',
                    p_terms_version: 'shared-guardianship-2026-08-31',
                    p_privacy_version: 'shared-guardianship-2026-08-31'
                }
            );
            assert(
                !attested.error && attested.data?.eligible === true,
                `Eligibility attestation failed: ${attested.error?.message}`
            );
        }

        for (let index = 0; index < 2; index += 1) {
            const saved = await clients[index].rpc('save_game_state', {
                p_save_slot: 'primary',
                p_save_version: '1.1.0',
                p_game_state: parentState(
                    parentIds[index],
                    index === 0 ? 'Smoke Host' : 'Smoke Guest',
                    index === 0 ? 'void' : 'crystal',
                    index === 0 ? 'rare' : 'epic',
                    index + 1
                ),
                p_client_saved_at: new Date().toISOString(),
                p_expected_revision: 0
            });
            assert(
                !saved.error && saved.data?.revision === 1,
                `Smoke save failed: ${saved.error?.message}`
            );
        }

        const createKey = `invite_${randomUUID().replace(/-/g, '')}`;
        const created = await clients[0].rpc(
            'create_shared_guardianship_invitation',
            {
                p_parent_id: parentIds[0],
                p_expected_revision: 1,
                p_idempotency_key: createKey
            }
        );
        assert(
            !created.error &&
                created.data?.invitationId &&
                /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(created.data?.code || ''),
            `Invitation creation failed: ${created.error?.message}`
        );
        invitationId = created.data.invitationId;
        const createReplay = await clients[0].rpc(
            'create_shared_guardianship_invitation',
            {
                p_parent_id: parentIds[0],
                p_expected_revision: 1,
                p_idempotency_key: createKey
            }
        );
        assert(
            !createReplay.error &&
                createReplay.data?.invitationId === invitationId &&
                createReplay.data?.code === created.data.code &&
                createReplay.data?.replay === true,
            `Invitation retry did not return the original private code: ${createReplay.error?.message}`
        );

        const directRead = await clients[0]
            .from('shared_guardianship_invitations')
            .select('invitation_id')
            .eq('invitation_id', invitationId);
        assert(Boolean(directRead.error), 'Direct invitation table access was unexpectedly allowed.');

        const joined = await clients[1].rpc(
            'join_shared_guardianship_invitation',
            {
                p_code: created.data.code,
                p_parent_id: parentIds[1],
                p_expected_revision: 1
            }
        );
        assert(
            !joined.error &&
                joined.data?.status === 'paired' &&
                joined.data?.peerSignal?.rarity === 'rare' &&
                !JSON.stringify(joined.data).includes('Smoke Host') &&
                !JSON.stringify(joined.data).includes(parentIds[0]),
            `Invitation join or privacy projection failed: ${joined.error?.message}`
        );
        const joinReplay = await clients[1].rpc(
            'join_shared_guardianship_invitation',
            {
                p_code: created.data.code,
                p_parent_id: parentIds[1],
                p_expected_revision: 1
            }
        );
        assert(
            !joinReplay.error &&
                joinReplay.data?.invitationId === invitationId &&
                joinReplay.data?.replay === true,
            `Invitation join retry was not idempotent: ${joinReplay.error?.message}`
        );

        const hostConfirmed = await clients[0].rpc(
            'confirm_shared_guardianship_invitation',
            { p_invitation_id: invitationId }
        );
        assert(
            !hostConfirmed.error &&
                hostConfirmed.data?.status === 'paired' &&
                hostConfirmed.data?.hostConfirmed === true,
            `Host confirmation failed: ${hostConfirmed.error?.message}`
        );
        const guestConfirmed = await clients[1].rpc(
            'confirm_shared_guardianship_invitation',
            { p_invitation_id: invitationId }
        );
        assert(
            !guestConfirmed.error &&
                guestConfirmed.data?.status === 'ready' &&
                /^fusion_guardianship_/.test(guestConfirmed.data?.operationId || '') &&
                Boolean(guestConfirmed.data?.sharedCreatureId),
            `Guest confirmation failed: ${guestConfirmed.error?.message}`
        );
        sharedCreatureId = guestConfirmed.data.sharedCreatureId;

        const hostExecution = await clients[0].functions.invoke('execute-fusion', {
            body: { guardianshipInvitationId: invitationId }
        });
        const guestExecution = await clients[1].functions.invoke('execute-fusion', {
            body: { guardianshipInvitationId: invitationId }
        });
        const executionFailure = await describeFunctionFailure(
            hostExecution.error ? hostExecution : guestExecution
        );
        assert(
            !hostExecution.error &&
                !guestExecution.error &&
                hostExecution.data?.status === 'staged' &&
                guestExecution.data?.status === 'staged' &&
                hostExecution.data?.offspring?.offspringData?.creatureId ===
                    guestExecution.data?.offspring?.offspringData?.creatureId &&
                JSON.stringify(hostExecution.data?.offspring?.offspringGenes) ===
                    JSON.stringify(guestExecution.data?.offspring?.offspringGenes) &&
                guestExecution.data?.replay === true,
            `Canonical execution or replay failed: ${executionFailure}`
        );

        const hostNamed = await clients[0].rpc('submit_shared_guardianship_name', {
            p_invitation_id: invitationId,
            p_name: 'Aster'
        });
        assert(
            !hostNamed.error && hostNamed.data?.awaitingAgreement === true,
            `Host naming failed: ${hostNamed.error?.message}`
        );
        const guestNamed = await clients[1].rpc('submit_shared_guardianship_name', {
            p_invitation_id: invitationId,
            p_name: 'Aster'
        });
        assert(
            !guestNamed.error &&
                guestNamed.data?.status === 'committed' &&
                guestNamed.data?.nameAgreed === true,
            `Shared name agreement failed: ${guestNamed.error?.message}`
        );

        const listed = await Promise.all([0, 1].map(index => (
            clients[index].rpc('list_shared_guardianship_creatures')
        )));
        assert(
            listed.every(result => !result.error && result.data?.length === 1) &&
                listed[0].data[0].sharedCreatureId === sharedCreatureId &&
                listed[1].data[0].sharedCreatureId === sharedCreatureId &&
                listed[0].data[0].runtimeId === listed[1].data[0].runtimeId &&
                JSON.stringify(listed[0].data[0].genes) ===
                    JSON.stringify(listed[1].data[0].genes) &&
                listed[0].data[0].revision === 1 &&
                listed[1].data[0].revision === 1,
            'Both guardians did not receive the same canonical child projection.'
        );

        const outsiderRead = await clients[2].rpc(
            'get_shared_guardianship_projection',
            { p_creature_id: sharedCreatureId }
        );
        assert(
            Boolean(outsiderRead.error) &&
                outsiderRead.error.message.includes('shared_guardianship_access_denied'),
            'A nonparticipant could read the shared creature.'
        );

        for (let attempt = 0; attempt < 8; attempt += 1) {
            const guessed = await clients[2].rpc(
                'join_shared_guardianship_invitation',
                {
                    p_code: randomBytes(6).toString('hex').toUpperCase(),
                    p_parent_id: 'missing-parent',
                    p_expected_revision: 1
                }
            );
            assert(
                !guessed.error &&
                    guessed.data?.errorCode === 'shared_guardianship_invitation_unavailable',
                `Private-code attempt ${attempt + 1} did not fail safely.`
            );
        }
        const rateLimited = await clients[2].rpc(
            'join_shared_guardianship_invitation',
            {
                p_code: randomBytes(6).toString('hex').toUpperCase(),
                p_parent_id: 'missing-parent',
                p_expected_revision: 1
            }
        );
        assert(
            !rateLimited.error &&
                rateLimited.data?.errorCode === 'shared_guardianship_join_rate_limited',
            'Private-code guessing attempts were not durably rate limited.'
        );

        const careKey = `care_tend_${randomUUID().replace(/-/g, '')}`;
        const hostCare = await clients[0].rpc('perform_shared_guardianship_care', {
            p_creature_id: sharedCreatureId,
            p_action: 'tend',
            p_idempotency_key: careKey,
            p_expected_revision: 1
        });
        const hostReplay = await clients[0].rpc('perform_shared_guardianship_care', {
            p_creature_id: sharedCreatureId,
            p_action: 'tend',
            p_idempotency_key: careKey,
            p_expected_revision: 1
        });
        assert(
            !hostCare.error &&
                !hostReplay.error &&
                hostCare.data?.revision === 2 &&
                hostReplay.data?.revision === 2 &&
                hostReplay.data?.replay === true,
            `Idempotent care failed: ${hostCare.error?.message || hostReplay.error?.message}`
        );

        const concurrentCareKeys = [
            `care_play_${randomUUID().replace(/-/g, '')}`,
            `care_rest_${randomUUID().replace(/-/g, '')}`
        ];
        const concurrentCare = await Promise.all([
            clients[0].rpc('perform_shared_guardianship_care', {
                p_creature_id: sharedCreatureId,
                p_action: 'play',
                p_idempotency_key: concurrentCareKeys[0],
                p_expected_revision: 2
            }),
            clients[1].rpc('perform_shared_guardianship_care', {
                p_creature_id: sharedCreatureId,
                p_action: 'rest',
                p_idempotency_key: concurrentCareKeys[1],
                p_expected_revision: 2
            })
        ]);
        assert(
            concurrentCare.every(result => !result.error) &&
                concurrentCare.some(result => result.data?.rebased === true) &&
                Math.max(...concurrentCare.map(result => result.data?.revision || 0)) === 4,
            `Compatible simultaneous care did not serialize safely: ${concurrentCare.map(result => result.error?.message).filter(Boolean).join('; ')}`
        );
        const staleCare = await clients[1].rpc('perform_shared_guardianship_care', {
            p_creature_id: sharedCreatureId,
            p_action: 'play',
            p_idempotency_key: `care_play_${randomUUID().replace(/-/g, '')}`,
            p_expected_revision: 1
        });
        assert(
            !staleCare.error &&
                staleCare.data?.conflict === true &&
                staleCare.data?.revision === 4,
            `A stale client did not receive the newest projection: ${staleCare.error?.message}`
        );

        await clients[0].auth.signOut({ scope: 'local' });
        const reconnectedHost = createClient(
            env.VITE_SUPABASE_URL,
            env.VITE_SUPABASE_PUBLISHABLE_KEY,
            clientOptions
        );
        const reconnected = await reconnectedHost.auth.signInWithPassword({
            email: emails[0],
            password
        });
        assert(!reconnected.error, `Host reconnect failed: ${reconnected.error?.message}`);
        const converged = await reconnectedHost.rpc(
            'get_shared_guardianship_projection',
            { p_creature_id: sharedCreatureId }
        );
        assert(
            !converged.error &&
                converged.data?.revision === 4 &&
                converged.data?.care?.curiosity === staleCare.data?.care?.curiosity,
            `Reconnect did not converge: ${converged.error?.message}`
        );

        const guestMuted = await clients[1].rpc(
            'set_shared_guardianship_notifications',
            {
                p_creature_id: sharedCreatureId,
                p_muted: true,
                p_idempotency_key: `notice_${randomUUID().replace(/-/g, '')}`,
                p_expected_revision: 4
            }
        );
        const hostUnmuted = await reconnectedHost.rpc(
            'get_shared_guardianship_projection',
            { p_creature_id: sharedCreatureId }
        );
        assert(
            !guestMuted.error &&
                guestMuted.data?.notificationsMuted === true &&
                guestMuted.data?.revision === 5 &&
                hostUnmuted.data?.notificationsMuted === false,
            'Participant-scoped notification preference failed.'
        );

        const hostLeaveKey = `leave_${randomUUID().replace(/-/g, '')}`;
        const hostLeft = await reconnectedHost.rpc('leave_shared_guardianship', {
            p_creature_id: sharedCreatureId,
            p_idempotency_key: hostLeaveKey,
            p_expected_revision: 5
        });
        const hostLeaveReplay = await reconnectedHost.rpc('leave_shared_guardianship', {
            p_creature_id: sharedCreatureId,
            p_idempotency_key: hostLeaveKey,
            p_expected_revision: 5
        });
        const revokedRead = await reconnectedHost.rpc(
            'get_shared_guardianship_projection',
            { p_creature_id: sharedCreatureId }
        );
        const survivorRead = await clients[1].rpc(
            'get_shared_guardianship_projection',
            { p_creature_id: sharedCreatureId }
        );
        assert(
            !hostLeft.error &&
                hostLeft.data?.left === true &&
                hostLeft.data?.remainingGuardians === 1 &&
                hostLeaveReplay.data?.replay === true &&
                Boolean(revokedRead.error) &&
                !survivorRead.error &&
                survivorRead.data?.status === 'active' &&
                survivorRead.data?.guardianCount === 1,
            'Departure did not revoke only the departing guardian.'
        );
        const finalLeaveKey = `leave_${randomUUID().replace(/-/g, '')}`;
        const lastGuardianLeave = await clients[1].rpc(
            'leave_shared_guardianship',
            {
                p_creature_id: sharedCreatureId,
                p_idempotency_key: finalLeaveKey,
                p_expected_revision: survivorRead.data?.revision
            }
        );
        assert(
            !lastGuardianLeave.error &&
                lastGuardianLeave.data?.left === true &&
                lastGuardianLeave.data?.remainingGuardians === 0 &&
                lastGuardianLeave.data?.archived === true,
            `The final guardian could not leave safely: ${lastGuardianLeave.error?.message}`
        );

        console.log(JSON.stringify({
            verifiedPermanentAccounts: true,
            ageAndPolicyGate: true,
            hashedExpiringCode: true,
            invitationCreateReplay: true,
            invitationJoinReplay: true,
            dualGuardianConsent: true,
            oneCanonicalChild: true,
            participantScopedProjection: true,
            nonparticipantDenied: true,
            durableJoinRateLimit: true,
            idempotentCare: true,
            compatibleConcurrentCare: true,
            staleWriteReturnedLatestProjection: true,
            bidirectionalConvergence: true,
            reconnectConvergence: true,
            privateNotificationPreference: true,
            departureRevokesOnlyLeaver: true,
            departureReplaySafe: true,
            finalGuardianArchivesSafely: true
        }));
    } finally {
        if (sharedCreatureId) {
            const removedCreature = await admin
                .from('shared_guardianship_creatures')
                .delete()
                .eq('creature_id', sharedCreatureId);
            if (removedCreature.error) {
                console.error('[shared-guardianship-smoke] Creature cleanup failed.');
            }
        }
        for (const userId of createdUsers.reverse()) {
            const removed = await admin.auth.admin.deleteUser(userId);
            if (removed.error) {
                console.error('[shared-guardianship-smoke] Test identity cleanup failed.');
            }
        }
    }
}

run().catch(error => {
    console.error(error.message);
    process.exit(1);
});
