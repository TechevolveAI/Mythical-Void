const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadModule() {
    const filePath = path.join(
        __dirname,
        '../systems/SharedFusionInvitationService.js'
    );
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(
            'export class SharedFusionInvitationError',
            'class SharedFusionInvitationError'
        )
        .replace(
            'export class SharedFusionInvitationService',
            'class SharedFusionInvitationService'
        )
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                SharedFusionInvitationService,
                SharedFusionInvitationError,
                normalizeSharedFusionCode,
                normalizeSharedFusionInvitation,
                normalizeSharedFusionSaveState,
                normalizeSharedFusionExecution,
                getSharedFusionAvailability
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        Date,
        Promise,
        Map,
        Set,
        Object,
        Array,
        Number,
        String,
        Math,
        JSON,
        Error,
        window: {
            FusionConsent: {
                getFusionCompanionReadiness: jest.fn(parent => ({
                    creatureId: parent?.id || null,
                    willing: parent?.lifecycle?.stage === 'adult'
                }))
            }
        }
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

const {
    SharedFusionInvitationService,
    normalizeSharedFusionCode,
    normalizeSharedFusionInvitation,
    normalizeSharedFusionSaveState,
    normalizeSharedFusionExecution,
    getSharedFusionAvailability
} = loadModule();

const invitationId = '824363b2-d374-4b44-bf7f-1d7a177fa074';

function invitation(overrides = {}) {
    return {
        schemaVersion: 1,
        invitationId,
        role: 'host',
        status: 'waiting',
        ownParentId: 'creature_alpha',
        peerSignal: null,
        hostConfirmed: false,
        guestConfirmed: false,
        createdAt: '2026-07-31T00:00:00.000Z',
        expiresAt: '2026-07-31T00:15:00.000Z',
        operationId: null,
        ownOffspringId: null,
        ownNameSubmitted: false,
        code: '12AB-34CD-56EF',
        ...overrides
    };
}

function harness({
    ageEligible = true,
    enabled = true,
    remoteRevision = 7,
    rpcImpl = null,
    functionImpl = null
} = {}) {
    const state = {
        schemaVersion: 1,
        activeInvitation: null,
        completedOperationIds: []
    };
    const rpc = jest.fn(rpcImpl || (async name => {
        if (name === 'attest_shared_fusion_eligibility') {
            return { data: { eligible: true }, error: null };
        }
        return { data: invitation(), error: null };
    }));
    const cloudSave = {
        remoteRevision,
        isAgeEligible: jest.fn(() => ageEligible),
        isEnabled: jest.fn(() => enabled),
        isConfigured: jest.fn(() => true),
        getAgeGroup: jest.fn(() => (
            ageEligible ? 'age_18_plus' : 'under_13'
        )),
        ensureSession: jest.fn(async () => ({
            id: '79d09052-73bd-4c07-b074-02a45523c3da'
        })),
        synchronize: jest.fn(async () => {
            cloudSave.remoteRevision = 1;
        }),
        client: {
            rpc,
            functions: {
                invoke: jest.fn(functionImpl || (async () => ({
                    data: null,
                    error: null
                })))
            }
        }
    };
    const gameState = {
        get: jest.fn(() => state),
        set: jest.fn((_path, value) => {
            Object.assign(state, value);
        }),
        save: jest.fn()
    };
    const service = new SharedFusionInvitationService({
        cloudSave,
        gameState,
        logger: { warn: jest.fn() }
    });
    return { service, cloudSave, gameState, rpc, state };
}

describe('SharedFusionInvitationService', () => {
    test('normalizes a human-readable 48-bit invitation code', () => {
        expect(normalizeSharedFusionCode('12ab 34cd-56ef')).toBe(
            '12AB-34CD-56EF'
        );
        expect(normalizeSharedFusionCode('short')).toBeNull();
        expect(normalizeSharedFusionCode('ZZZZ-ZZZZ-ZZZZ')).toBeNull();
    });

    test('keeps under-16 and cloud-disabled profiles outside the boundary', () => {
        expect(getSharedFusionAvailability(
            harness({ ageEligible: false }).cloudSave
        )).toEqual(expect.objectContaining({
            available: false,
            reason: 'age_restricted'
        }));
        expect(getSharedFusionAvailability(
            harness({ enabled: false }).cloudSave
        )).toEqual(expect.objectContaining({
            available: false,
            reason: 'cloud_save_required'
        }));
    });

    test('attests once, creates against the current revision, and never saves the code', async () => {
        const { service, rpc, gameState, state } = harness();
        const created = await service.create({
            id: 'creature_alpha',
            lifecycle: { stage: 'adult' }
        });

        expect(created.code).toBe('12AB-34CD-56EF');
        expect(rpc).toHaveBeenNthCalledWith(
            1,
            'attest_shared_fusion_eligibility',
            {
                p_age_band: 'age_18_plus',
                p_policy_version: '2026-07-31'
            }
        );
        expect(rpc).toHaveBeenNthCalledWith(
            2,
            'create_shared_fusion_invitation',
            {
                p_parent_id: 'creature_alpha',
                p_expected_revision: 7
            }
        );
        expect(gameState.save).toHaveBeenCalledTimes(1);
        expect(state.activeInvitation.invitationId).toBe(invitationId);
        expect(state.activeInvitation.code).toBeNull();
        expect(JSON.stringify(state)).not.toContain('12AB-34CD-56EF');
    });

    test('requires companion willingness before contacting the server', async () => {
        const { service, rpc } = harness();

        await expect(service.create({
            id: 'creature_baby',
            lifecycle: { stage: 'baby' }
        })).rejects.toEqual(expect.objectContaining({
            code: 'companion_not_ready'
        }));
        expect(rpc).not.toHaveBeenCalled();
    });

    test('joins with a normalized code and a server-verified save revision', async () => {
        const { service, rpc } = harness({
            rpcImpl: async name => ({
                data: name === 'attest_shared_fusion_eligibility'
                    ? { eligible: true }
                    : invitation({
                        role: 'guest',
                        status: 'paired',
                        code: null,
                        peerSignal: {
                            rarity: 'rare',
                            affinity: 'void',
                            generation: 3,
                            stage: 'elder',
                            customName: 'must not survive'
                        }
                    }),
                error: null
            })
        });

        const joined = await service.join(
            '12ab 34cd 56ef',
            {
                id: 'creature_beta',
                lifecycle: { stage: 'adult' }
            }
        );

        expect(rpc).toHaveBeenLastCalledWith(
            'join_shared_fusion_invitation',
            {
                p_code: '12AB-34CD-56EF',
                p_parent_id: 'creature_beta',
                p_expected_revision: 7
            }
        );
        expect(joined.peerSignal).toEqual({
            rarity: 'rare',
            affinity: 'void',
            generation: 3,
            stage: 'elder'
        });
        expect(JSON.stringify(joined)).not.toContain('must not survive');
    });

    test('deduplicates simultaneous participant-scoped status reads', async () => {
        let resolveRead;
        const pendingRead = new Promise(resolve => {
            resolveRead = resolve;
        });
        const { service, rpc } = harness({
            rpcImpl: async name => {
                if (name === 'attest_shared_fusion_eligibility') {
                    return { data: { eligible: true }, error: null };
                }
                await pendingRead;
                return { data: invitation({ code: null }), error: null };
            }
        });

        const first = service.get(invitationId);
        const second = service.get(invitationId);
        resolveRead();
        await expect(Promise.all([first, second])).resolves.toHaveLength(2);
        expect(rpc.mock.calls.filter(
            ([name]) => name === 'get_shared_fusion_invitation'
        )).toHaveLength(1);
    });

    test('keeps terminal invitations out of portable active state', () => {
        const normalized = normalizeSharedFusionSaveState({
            activeInvitation: invitation({
                status: 'cancelled',
                code: '12AB-34CD-56EF'
            }),
            completedOperationIds: [
                'fusion_shared_23',
                'fusion_shared_23',
                'not valid'
            ],
            playerHandle: 'must not survive'
        });

        expect(normalized).toEqual({
            schemaVersion: 1,
            activeInvitation: null,
            completedOperationIds: ['fusion_shared_23'],
            pendingReveal: null
        });
        expect(JSON.stringify(normalized)).not.toContain('playerHandle');
    });

    test('rejects malformed server responses instead of trusting peer data', () => {
        expect(normalizeSharedFusionInvitation({
            ...invitation(),
            invitationId: 'not-an-invitation',
            hostUserId: 'private-account'
        })).toBeNull();
    });

    test('executes through the protected invitation and removes parent IDs from reveal data', async () => {
        const operationId = 'fusion_shared_23';
        const { service, cloudSave } = harness({
            rpcImpl: async name => ({
                data: name === 'attest_shared_fusion_eligibility'
                    ? { eligible: true }
                    : invitation({
                        status: 'staged',
                        code: null,
                        operationId,
                        ownOffspringId: 'creature_shared_alpha'
                    }),
                error: null
            }),
            functionImpl: async () => ({
                data: {
                    invitationId,
                    operationId,
                    role: 'host',
                    status: 'staged',
                    offspring: {
                        offspringGenes: {
                            id: 'genes_creature_shared_alpha',
                            species: 'currentHybrid'
                        },
                        offspringData: {
                            creatureId: 'creature_shared_alpha',
                            rarity: 'rare',
                            parentIds: [
                                'private_alpha',
                                'private_beta'
                            ]
                        }
                    },
                    compatibilityScore: 77,
                    birthEvents: [],
                    receipt: { authority: 'server_generated' },
                    replay: false
                },
                error: null
            })
        });

        const result = await service.execute(invitationId);

        expect(
            cloudSave.client.functions.invoke
        ).toHaveBeenCalledWith('execute-fusion', {
            body: { invitationId }
        });
        expect(result.offspring.offspringData.parentIds).toBeUndefined();
        expect(JSON.stringify(result)).not.toContain('private_alpha');
        expect(normalizeSharedFusionExecution(result)).toEqual(
            expect.objectContaining({
                invitationId,
                operationId,
                role: 'host'
            })
        );
    });

    test('submits only the local name and synchronizes an atomic commit', async () => {
        const operationId = 'fusion_shared_23';
        const committed = invitation({
            status: 'committed',
            code: null,
            operationId,
            ownOffspringId: 'creature_shared_alpha',
            ownNameSubmitted: true,
            ownOffspring: {
                id: 'creature_shared_alpha',
                name: 'Nova'
            }
        });
        const { service, cloudSave, rpc } = harness({
            rpcImpl: async name => ({
                data: name === 'attest_shared_fusion_eligibility'
                    ? { eligible: true }
                    : committed,
                error: null
            })
        });

        const result = await service.submitName(invitationId, ' Nova ');

        expect(rpc).toHaveBeenLastCalledWith(
            'submit_shared_fusion_name',
            {
                p_invitation_id: invitationId,
                p_name: 'Nova'
            }
        );
        expect(cloudSave.synchronize).toHaveBeenCalled();
        expect(result.invitation.status).toBe('committed');
        expect(result.ownOffspring).toEqual({
            id: 'creature_shared_alpha',
            name: 'Nova'
        });
    });
});
