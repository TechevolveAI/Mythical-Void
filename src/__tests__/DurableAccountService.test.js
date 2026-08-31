const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadModule() {
    const filePath = path.join(__dirname, '../systems/DurableAccountService.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace('export class DurableAccountError', 'class DurableAccountError')
        .replace('export class DurableAccountService', 'class DurableAccountService')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat('\nmodule.exports = { DurableAccountService, DurableAccountError };');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        URL,
        Promise,
        String,
        Error,
        window: { location: { origin: 'https://mythicalvoid.com' } }
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

const { DurableAccountService } = loadModule();

function harness(options = {}) {
    const sessionUser = options.sessionUser || {
        id: 'verified-user',
        email: 'guardian@example.test',
        email_confirmed_at: '2026-08-31T12:00:00Z',
        is_anonymous: false
    };
    const auth = {
        getSession: jest.fn(async () => ({
            data: { session: { user: sessionUser } },
            error: null
        })),
        getUser: jest.fn(async () => ({ data: { user: sessionUser }, error: null })),
        updateUser: jest.fn(async payload => ({ data: { user: sessionUser }, error: null, payload })),
        verifyOtp: jest.fn(async () => ({ data: {}, error: null })),
        signInWithPassword: jest.fn(async () => ({ data: { user: sessionUser }, error: null })),
        resetPasswordForEmail: jest.fn(async () => ({ data: {}, error: null }))
    };
    const cloudSave = {
        client: { auth },
        ensureSession: jest.fn(async () => ({ id: 'anonymous-user', is_anonymous: true })),
        adoptAuthenticatedSession: jest.fn(async () => ({ status: 'synced' })),
        synchronize: jest.fn(async () => ({ status: 'synced' }))
    };
    return {
        auth,
        cloudSave,
        service: new DurableAccountService({ client: { auth }, cloudSave })
    };
}

describe('DurableAccountService', () => {
    test('requires a verified non-anonymous email identity', async () => {
        const { service } = harness();
        await expect(service.getStatus({ refresh: true })).resolves.toEqual(
            expect.objectContaining({ permanent: true, verified: true, anonymous: false })
        );

        const anonymous = harness({ sessionUser: {
            id: 'anonymous-user', is_anonymous: true, email: null, email_confirmed_at: null
        }});
        await expect(anonymous.service.getStatus({ refresh: true })).resolves.toEqual(
            expect.objectContaining({ permanent: false, anonymous: true })
        );
    });

    test('converts the existing anonymous identity instead of creating a second user', async () => {
        const { service, auth, cloudSave } = harness({ sessionUser: {
            id: 'anonymous-user', is_anonymous: true, email: null, email_confirmed_at: null
        }});
        await service.beginUpgrade('Guardian@Example.test');

        expect(cloudSave.ensureSession).toHaveBeenCalledTimes(1);
        expect(auth.updateUser).toHaveBeenCalledWith({ email: 'guardian@example.test' });
        expect(auth.signInWithPassword).not.toHaveBeenCalled();
    });

    test('verified upgrade keeps the same cloud identity and does not prefer an older remote save', async () => {
        const { service, auth, cloudSave } = harness();
        await service.finishUpgrade('a-long-safe-password');

        expect(auth.updateUser).toHaveBeenCalledWith({ password: 'a-long-safe-password' });
        expect(cloudSave.adoptAuthenticatedSession).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'verified-user' }),
            { preferRemote: false }
        );
    });

    test('sign-in adopts the durable account and prefers its canonical remote save', async () => {
        const { service, cloudSave } = harness();
        await service.signIn('guardian@example.test', 'a-long-safe-password');
        expect(cloudSave.adoptAuthenticatedSession).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'verified-user' }),
            { preferRemote: true }
        );
    });

    test('password reset returns to the dedicated recovery flow without revealing account existence', async () => {
        const { service, auth } = harness();
        await service.requestPasswordReset('guardian@example.test');
        expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
            'guardian@example.test',
            { redirectTo: 'https://mythicalvoid.com/play/?accountRecovery=1' }
        );
    });

    test('rejects invalid email and short passwords before an auth request', async () => {
        const { service, auth } = harness();
        await expect(service.beginUpgrade('not-email')).rejects.toMatchObject({ code: 'email_invalid' });
        await expect(service.signIn('guardian@example.test', 'short')).rejects.toMatchObject({ code: 'invalid_login' });
        expect(auth.signInWithPassword).not.toHaveBeenCalled();
    });
});
