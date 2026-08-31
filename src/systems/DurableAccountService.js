const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

export class DurableAccountError extends Error {
    constructor(code, message, cause = null) {
        super(message, cause ? { cause } : undefined);
        this.name = 'DurableAccountError';
        this.code = code;
    }
}

function normalizedEmail(value) {
    const email = String(value || '').trim().toLowerCase();
    return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

function normalizedPassword(value) {
    const password = String(value || '');
    return password.length >= MIN_PASSWORD_LENGTH && password.length <= 128
        ? password
        : null;
}

export class DurableAccountService {
    constructor(options = {}) {
        this.client = options.client || window.CloudSave?.client || null;
        this.cloudSave = options.cloudSave || window.CloudSave || null;
    }

    isConfigured() {
        return Boolean(this.client?.auth);
    }

    normalizeError(error, fallback = 'Account service is unavailable.') {
        const source = String(error?.message || error?.code || '').toLowerCase();
        if (source.includes('manual linking')) {
            return new DurableAccountError(
                'manual_linking_unavailable',
                'Account creation is not ready yet. Your local game is safe.',
                error
            );
        }
        if (source.includes('rate limit') || source.includes('email rate')) {
            return new DurableAccountError(
                'email_rate_limited',
                'Too many email requests. Wait a few minutes and try again.',
                error
            );
        }
        if (source.includes('already') || source.includes('registered')) {
            return new DurableAccountError(
                'account_exists',
                'That email already has an account. Choose Sign in instead.',
                error
            );
        }
        if (source.includes('invalid login')) {
            return new DurableAccountError(
                'invalid_login',
                'The email or password was not accepted.',
                error
            );
        }
        if (source.includes('expired') || source.includes('token')) {
            return new DurableAccountError(
                'verification_invalid',
                'That verification code has expired or is not valid.',
                error
            );
        }
        if (source.includes('password')) {
            return new DurableAccountError(
                'password_invalid',
                `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
                error
            );
        }
        return new DurableAccountError('account_service_error', fallback, error);
    }

    async getStatus({ refresh = false } = {}) {
        if (!this.isConfigured()) {
            return {
                configured: false,
                authenticated: false,
                permanent: false,
                verified: false,
                anonymous: false
            };
        }
        const result = refresh
            ? await this.client.auth.getUser()
            : await this.client.auth.getSession();
        if (result.error) throw this.normalizeError(result.error);
        const user = refresh
            ? result.data?.user
            : result.data?.session?.user;
        return {
            configured: true,
            authenticated: Boolean(user?.id),
            permanent: Boolean(
                user?.id &&
                user.is_anonymous !== true &&
                user.email &&
                user.email_confirmed_at
            ),
            verified: Boolean(user?.email_confirmed_at),
            anonymous: user?.is_anonymous === true,
            userId: user?.id || null
        };
    }

    async beginUpgrade(value) {
        const email = normalizedEmail(value);
        if (!email) {
            throw new DurableAccountError(
                'email_invalid',
                'Enter a valid email address.'
            );
        }
        const user = await this.cloudSave?.ensureSession?.();
        if (!user?.id) {
            throw new DurableAccountError(
                'anonymous_identity_missing',
                'Enable Cloud Save before creating an account.'
            );
        }
        const status = await this.getStatus({ refresh: true });
        if (status.permanent) return { emailSent: false, alreadyPermanent: true };
        const { error } = await this.client.auth.updateUser({ email });
        if (error) throw this.normalizeError(error, 'Verification email could not be sent.');
        return { emailSent: true, alreadyPermanent: false };
    }

    async verifyEmailCode(value, tokenValue) {
        const email = normalizedEmail(value);
        const token = String(tokenValue || '').trim();
        if (!email || !/^\d{6,10}$/.test(token)) {
            throw new DurableAccountError(
                'verification_invalid',
                'Enter the verification code from the email.'
            );
        }
        const { error } = await this.client.auth.verifyOtp({
            email,
            token,
            type: 'email_change'
        });
        if (error) throw this.normalizeError(error);
        return this.getStatus({ refresh: true });
    }

    async finishUpgrade(passwordValue) {
        const password = normalizedPassword(passwordValue);
        if (!password) {
            throw new DurableAccountError(
                'password_invalid',
                `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`
            );
        }
        const status = await this.getStatus({ refresh: true });
        if (!status.verified || status.anonymous) {
            throw new DurableAccountError(
                'email_not_verified',
                'Verify the email before choosing a password.'
            );
        }
        const { data, error } = await this.client.auth.updateUser({ password });
        if (error) throw this.normalizeError(error);
        if (data?.user?.id && this.cloudSave?.adoptAuthenticatedSession) {
            await this.cloudSave.adoptAuthenticatedSession(data.user, {
                preferRemote: false
            });
        } else {
            await this.cloudSave?.synchronize?.();
        }
        return this.getStatus({ refresh: true });
    }

    async signIn(value, passwordValue) {
        const email = normalizedEmail(value);
        const password = normalizedPassword(passwordValue);
        if (!email || !password) {
            throw new DurableAccountError(
                'invalid_login',
                'Enter the account email and password.'
            );
        }
        const { data, error } = await this.client.auth.signInWithPassword({
            email,
            password
        });
        if (error || !data?.user?.id) throw this.normalizeError(error);
        if (this.cloudSave?.adoptAuthenticatedSession) {
            await this.cloudSave.adoptAuthenticatedSession(data.user, {
                preferRemote: true
            });
        } else {
            if (this.cloudSave) this.cloudSave.currentUser = data.user;
            await this.cloudSave?.synchronize?.();
        }
        return this.getStatus({ refresh: true });
    }

    async requestPasswordReset(value) {
        const email = normalizedEmail(value);
        if (!email) {
            throw new DurableAccountError('email_invalid', 'Enter a valid email address.');
        }
        const redirectTo = `${window.location.origin}/play/?accountRecovery=1`;
        const { error } = await this.client.auth.resetPasswordForEmail(email, {
            redirectTo
        });
        if (error) throw this.normalizeError(error);
        return { requested: true };
    }

    clearSharedCreatureCache() {
        const gameState = this.cloudSave?.gameState ||
            (typeof window !== 'undefined' ? window.GameState : null);
        gameState?.set?.('sharedGuardianship.projections', []);
        gameState?.set?.('sharedGuardianship.lastSyncedAt', 0);
    }

    async signOut() {
        if (!this.isConfigured()) return { signedOut: true };
        const { error } = await this.client.auth.signOut({ scope: 'local' });
        if (error) throw this.normalizeError(error, 'This device could not sign out.');
        this.clearSharedCreatureCache();
        this.cloudSave?.disable?.();
        if (this.cloudSave) this.cloudSave.currentUser = null;
        return { signedOut: true };
    }

    static installRecoveryFlow(options = {}) {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        const url = new URL(window.location.href);
        if (url.searchParams.get('accountRecovery') !== '1') return;
        if (document.querySelector('[data-durable-account-recovery]')) return;

        const service = new DurableAccountService(options);
        const root = document.createElement('div');
        root.className = 'durable-account-recovery';
        root.dataset.durableAccountRecovery = 'true';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', 'Choose a new account password');
        root.innerHTML = `
            <section class="durable-account-recovery__panel">
                <p class="shared-guardianship-eyebrow">ACCOUNT RECOVERY</p>
                <h1>Choose a new password</h1>
                <p data-recovery-status>Checking the secure reset link...</p>
                <div data-recovery-form hidden>
                    <label>New password<input type="password" autocomplete="new-password" minlength="${MIN_PASSWORD_LENGTH}" maxlength="128"></label>
                    <label>Confirm password<input type="password" autocomplete="new-password" minlength="${MIN_PASSWORD_LENGTH}" maxlength="128"></label>
                    <button type="button" class="shared-guardianship-primary">SAVE NEW PASSWORD</button>
                </div>
                <button type="button" class="shared-guardianship-text-button" data-recovery-close>CLOSE</button>
            </section>`;
        document.body.append(root);

        const status = root.querySelector('[data-recovery-status]');
        const form = root.querySelector('[data-recovery-form]');
        const inputs = [...root.querySelectorAll('input')];
        const save = root.querySelector('.shared-guardianship-primary');
        const cleanUrl = () => {
            const next = new URL(window.location.href);
            ['accountRecovery', 'code', 'token_hash', 'type'].forEach(key => next.searchParams.delete(key));
            window.history.replaceState({}, '', `${next.pathname}${next.search}${next.hash}`);
        };
        const close = () => {
            cleanUrl();
            root.remove();
        };
        root.querySelector('[data-recovery-close]').addEventListener('click', close);

        service.client?.auth?.getSession().then(({ data, error }) => {
            cleanUrl();
            if (error || !data?.session?.user?.id) {
                status.textContent = 'This reset link is invalid or expired. Request a new one from Shared Guardianship.';
                return;
            }
            status.textContent = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
            form.hidden = false;
            inputs[0]?.focus();
        }).catch(() => {
            cleanUrl();
            status.textContent = 'Account recovery is unavailable right now. Request a new reset link later.';
        });

        save.addEventListener('click', async () => {
            if (inputs[0].value !== inputs[1].value) {
                status.textContent = 'The two passwords do not match.';
                return;
            }
            const password = normalizedPassword(inputs[0].value);
            if (!password) {
                status.textContent = `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
                return;
            }
            save.disabled = true;
            status.textContent = 'Saving the new password...';
            try {
                const { data, error } = await service.client.auth.updateUser({ password });
                if (error) throw service.normalizeError(error);
                if (data?.user?.id && service.cloudSave?.adoptAuthenticatedSession) {
                    await service.cloudSave.adoptAuthenticatedSession(data.user, {
                        preferRemote: true
                    });
                }
                status.textContent = 'Password updated. Your Sanctuary is ready.';
                form.hidden = true;
            } catch (error) {
                status.textContent = error.message || 'The password could not be updated.';
                save.disabled = false;
            }
        });
    }
}

if (typeof window !== 'undefined') {
    window.DurableAccountService = DurableAccountService;
}
