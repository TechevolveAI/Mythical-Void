const fs = require('fs');
const path = require('path');
const vm = require('vm');

const invitationId = '824363b2-d374-4b44-bf7f-1d7a177fa074';
const creatureId = '0ba73666-fc6f-4af2-9138-12cc47c034ae';

function loadModule() {
    const filePath = path.join(__dirname, '../systems/SharedGuardianshipService.js');
    const contract = JSON.parse(fs.readFileSync(
        path.join(__dirname, '../config/sharedGuardianship.json'),
        'utf8'
    ));
    contract.enabled = true;
    const source = fs.readFileSync(filePath, 'utf8')
        .replace("import contract from '../config/sharedGuardianship.json';", `const contract = ${JSON.stringify(contract)};`)
        .replace('export class SharedGuardianshipError', 'class SharedGuardianshipError')
        .replace('export function getSharedGuardianshipAvailability', 'function getSharedGuardianshipAvailability')
        .replace('export function getSharedGuardianshipEntryAvailability', 'function getSharedGuardianshipEntryAvailability')
        .replace('export class SharedGuardianshipService', 'class SharedGuardianshipService')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat('\nmodule.exports = { SharedGuardianshipService, SharedGuardianshipError, normalizeCode, normalizeInvitation, normalizeProjection, getSharedGuardianshipAvailability, getSharedGuardianshipEntryAvailability, isSharedGuardianshipEnabled, contract };');
    const sandbox = {
        module: { exports: {} }, exports: {}, console, Date, Promise, Map, Set,
        Object, Array, Number, String, Math, JSON, Error, Uint8Array,
        crypto: {
            randomUUID: () => 'f7d62d73-663f-4f31-95e6-d0175eb00b2a'
        },
        window: {
            location: { hostname: 'mythicalvoid.com', search: '' },
            FusionConsent: {
                getFusionCompanionReadiness: parent => ({ willing: parent?.lifecycle?.stage === 'adult' })
            },
            setInterval,
            clearInterval
        }
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

const {
    SharedGuardianshipService,
    getSharedGuardianshipAvailability,
    getSharedGuardianshipEntryAvailability,
    normalizeCode,
    normalizeProjection
} = loadModule();

function projection(overrides = {}) {
    return {
        sharedCreatureId: creatureId,
        runtimeId: 'creature_guardianship_demo',
        name: 'Aster',
        genes: { species: 'nebulaSprite' },
        lifecycle: { stage: 'baby' },
        care: { comfort: 80, curiosity: 60, energy: 70 },
        revision: 3,
        status: 'active',
        guardianCount: 2,
        guardianRole: 'host',
        guardianLabel: 'Guardian A',
        notificationsMuted: false,
        history: [],
        ...overrides
    };
}

function harness(rpcImpl = null) {
    const rpc = jest.fn(rpcImpl || (async name => {
        if (name === 'attest_shared_guardianship_eligibility') {
            return { data: { eligible: true }, error: null };
        }
        if (name === 'list_shared_guardianship_creatures') {
            return { data: [projection()], error: null };
        }
        if (name === 'get_shared_guardianship_projection' || name === 'perform_shared_guardianship_care' || name === 'set_shared_guardianship_notifications') {
            return { data: projection(), error: null };
        }
        return { data: {
            invitationId, role: 'host', status: 'waiting', ownParentId: 'parent-1',
            hostConfirmed: false, guestConfirmed: false, code: '12AB-34CD-56EF'
        }, error: null };
    }));
    const cloudSave = {
        remoteRevision: 7,
        isAgeEligible: jest.fn(() => true),
        isEnabled: jest.fn(() => true),
        isConfigured: jest.fn(() => true),
        getAgeGroup: jest.fn(() => 'age_18_plus'),
        synchronize: jest.fn(async () => undefined),
        client: {
            rpc,
            auth: {
                getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
                getUser: jest.fn(async () => ({ data: { user: { id: 'guardian-a' } }, error: null }))
            },
            functions: { invoke: jest.fn(async () => ({ data: { status: 'staged' }, error: null })) }
        }
    };
    const gameState = {
        values: { 'sharedGuardianship.projections': [] },
        get: jest.fn(key => gameState.values[key]),
        set: jest.fn((key, value) => { gameState.values[key] = value; })
    };
    const account = { getStatus: jest.fn(async () => ({ permanent: true })) };
    return {
        rpc, cloudSave, gameState,
        service: new SharedGuardianshipService({ cloudSave, gameState, account })
    };
}

describe('SharedGuardianshipService', () => {
    test('keeps under-age, disabled-cloud and anonymous profiles outside the feature', () => {
        const base = harness().cloudSave;
        expect(getSharedGuardianshipAvailability({ ...base, isAgeEligible: () => false })).toMatchObject({ available: false, reason: 'age_restricted' });
        expect(getSharedGuardianshipAvailability({ ...base, isEnabled: () => false })).toMatchObject({ available: false, reason: 'cloud_save_required' });
        expect(getSharedGuardianshipAvailability(base, { permanent: false })).toMatchObject({ available: false, reason: 'account_required' });
    });

    test('lets an eligible player reach the explanation before Cloud Save is enabled', () => {
        const base = harness().cloudSave;
        expect(getSharedGuardianshipEntryAvailability({
            ...base,
            isEnabled: () => false
        })).toMatchObject({ available: true, reason: null });
        expect(getSharedGuardianshipEntryAvailability({
            ...base,
            isAgeEligible: () => false
        })).toMatchObject({ available: false, reason: 'age_restricted' });
    });

    test('normalizes the 48-bit code and rejects malformed values', () => {
        expect(normalizeCode('12ab 34cd 56ef')).toBe('12AB-34CD-56EF');
        expect(normalizeCode('wrong')).toBeNull();
    });

    test('attests once and creates only from a willing adult at the current cloud revision', async () => {
        const { service, rpc } = harness();
        const parent = { id: 'parent-1', lifecycle: { stage: 'adult' } };
        await service.create(parent);
        await service.create(parent);
        expect(rpc).toHaveBeenCalledWith('attest_shared_guardianship_eligibility', {
            p_age_band: 'age_18_plus',
            p_terms_version: 'shared-guardianship-2026-08-31',
            p_privacy_version: 'shared-guardianship-2026-08-31'
        });
        expect(rpc.mock.calls.filter(([name]) => name === 'attest_shared_guardianship_eligibility')).toHaveLength(1);
        expect(rpc).toHaveBeenCalledWith('create_shared_guardianship_invitation', {
            p_parent_id: 'parent-1',
            p_expected_revision: 7,
            p_idempotency_key: 'invite_f7d62d73663f4f3195e6d0175eb00b2a'
        });
    });

    test('uses an idempotency key and expected canonical revision for care', async () => {
        const { service, rpc } = harness();
        await service.care(creatureId, 'tend', 3);
        expect(rpc).toHaveBeenCalledWith('perform_shared_guardianship_care', {
            p_creature_id: creatureId,
            p_action: 'tend',
            p_idempotency_key: 'care_tend_f7d62d73663f4f3195e6d0175eb00b2a',
            p_expected_revision: 3
        });
    });

    test('caches only validated participant projections', async () => {
        const { service, gameState } = harness();
        const values = await service.refreshAll();
        expect(values).toHaveLength(1);
        expect(gameState.values['sharedGuardianship.projections']).toHaveLength(1);
        expect(normalizeProjection({ ...projection(), sharedCreatureId: 'forged' })).toBeNull();
    });

    test('keeps an invitation key across an ambiguous network retry', async () => {
        let attempts = 0;
        const { service, rpc } = harness(async name => {
            if (name === 'attest_shared_guardianship_eligibility') {
                return { data: { eligible: true }, error: null };
            }
            attempts += 1;
            if (attempts === 1) {
                return { data: null, error: { message: 'network unavailable' } };
            }
            return {
                data: {
                    invitationId,
                    role: 'host',
                    status: 'waiting',
                    ownParentId: 'parent-1',
                    code: '12AB-34CD-56EF'
                },
                error: null
            };
        });
        const parent = { id: 'parent-1', lifecycle: { stage: 'adult' } };
        await expect(service.create(parent)).rejects.toMatchObject({
            code: 'shared_guardianship_service_error'
        });
        await service.create(parent);
        const creates = rpc.mock.calls.filter(([name]) => (
            name === 'create_shared_guardianship_invitation'
        ));
        expect(creates).toHaveLength(2);
        expect(creates[0][1].p_idempotency_key).toBe(
            creates[1][1].p_idempotency_key
        );
    });

    test('turns a server conflict projection into a friendly refresh error', async () => {
        const { service, gameState } = harness(async name => {
            if (name === 'attest_shared_guardianship_eligibility') {
                return { data: { eligible: true }, error: null };
            }
            return {
                data: projection({ revision: 8, conflict: true }),
                error: null
            };
        });
        await expect(service.care(creatureId, 'rest', 3)).rejects.toMatchObject({
            code: 'shared_guardianship_revision_conflict',
            latestProjection: expect.objectContaining({ revision: 8 })
        });
        expect(gameState.values['sharedGuardianship.projections'][0].revision).toBe(8);
    });

    test('maps committed rate-limit responses as errors rather than invitations', async () => {
        const { service } = harness(async name => {
            if (name === 'attest_shared_guardianship_eligibility') {
                return { data: { eligible: true }, error: null };
            }
            return {
                data: { errorCode: 'shared_guardianship_join_rate_limited' },
                error: null
            };
        });
        await expect(service.join('12AB-34CD-56EF', {
            id: 'parent-1', lifecycle: { stage: 'adult' }
        })).rejects.toMatchObject({ code: 'shared_guardianship_join_rate_limited' });
    });

    test('maps stale-command errors to safe player language', () => {
        const { service } = harness();
        const error = service.mapError({ message: 'shared_guardianship_revision_conflict' });
        expect(error.code).toBe('shared_guardianship_revision_conflict');
        expect(error.message).not.toMatch(/database|rpc|postgres/i);
    });
});
