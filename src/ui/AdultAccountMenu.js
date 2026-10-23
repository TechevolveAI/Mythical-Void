const messages = {
    adults_only: 'Email accounts are for adults aged 18 or over. You can keep playing without one.',
    consent_required: 'Please read and confirm how this optional account works.',
    invalid_email: 'Enter a complete email address.',
    invalid_or_expired_link: 'That link could not be used with this email. Check the address, or request a new link.',
    recent_sign_in_required: 'Please sign in again before deleting your account.',
    adventure_too_large: 'This adventure is too large to save online. Your copy is still safe in this browser.',
    email_unavailable: 'The email could not be sent right now. Try again later. Your adventure is still here.',
    wait_before_resending: 'Please wait a minute before requesting another link.',
    accounts_unavailable: 'Your account is temporarily unavailable. You can keep playing in this browser.',
    sign_in_required: 'Please sign in again. Your adventure is still saved in this browser.',
    adult_declaration_required: 'Please sign in again and confirm the adult account information.',
    open_adventure_first: 'Continue your adventure first, then open Your adventures to add it to your account.',
    save_in_progress: 'Your game is finishing a save. Try adding it again in a moment.',
    adventure_changed: 'Another device has a newer copy. Open that copy below, or keep playing this one locally.',
    adventure_removed: 'This adventure was removed from your account. The copy in this browser is still here.',
    different_account: 'This adventure is connected to a different account. Sign in to that account to update it.',
    library_full: 'Your account has reached its adventure limit. Remove an online copy before adding another.',
    sign_out_unavailable: 'Sign-out could not finish. Try again before leaving a shared device.'
};

export default class AdultAccountMenu {
    constructor(manager, { onChosen, document: doc = document } = {}) {
        this.manager = manager; this.document = doc; this.onChosen = onChosen;
        this.notice = ''; this.busy = false;
    }
    open(parent = null) {
        if (this.opened) return;
        this.opened = true; this.parent = parent; this.returnFocus = this.document.activeElement;
        if (parent) parent.inert = true;
        this.unsubscribe = this.manager.subscribe(() => this.render());
        this.render();
        if (this.manager.user) this.run(() => this.manager.refreshLibrary());
    }
    async run(task, success = '') {
        if (this.busy) return;
        this.busy = true; this.notice = ''; this.render();
        try { await task(); this.notice = success; }
        catch (error) { this.notice = messages[error.code] || 'That could not finish. Your local adventure has been kept.'; }
        finally { this.busy = false; this.render(); }
    }
    render() {
        if (!this.opened) return;
        const focused = this.document.activeElement?.getAttribute('name');
        const drafts = [...(this.element?.querySelectorAll('input') || [])].map(input => ({
            name: input.name, value: input.value, checked: input.checked
        }));
        this.element?.remove();
        const doc = this.document, manager = this.manager;
        const overlay = doc.createElement('div'); overlay.className = 'adventure-menu account-menu';
        overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'adult-account-title');
        const panel = doc.createElement('section');
        const egg = doc.createElement('div'); egg.className = 'adventure-egg'; egg.setAttribute('aria-hidden', 'true');
        const title = doc.createElement('h1'); title.id = 'adult-account-title'; title.textContent = 'Save across devices';
        panel.append(egg, title);
        const text = value => { const p = doc.createElement('p'); p.textContent = value; panel.append(p); return p; };
        const button = (label, action, primary = false, parent = panel) => {
            const b = doc.createElement('button'); b.type = 'button'; b.textContent = label;
            b.disabled = this.busy; if (primary) b.className = 'adventure-primary';
            b.onclick = action; parent.append(b); return b;
        };
        const field = (form, label, type, autocomplete) => {
            const wrapper = doc.createElement('label'); wrapper.textContent = label;
            const input = doc.createElement('input'); input.type = type; input.autocomplete = autocomplete;
            input.name = autocomplete;
            input.required = true; input.disabled = this.busy; wrapper.append(input); form.append(wrapper); return input;
        };
        const age = manager.ageGroup();
        if (age && age !== 'age_18_plus') {
            text(messages.adults_only);
        } else if (!age) {
            text('Optional accounts are for adults. Choose the age range that applies to you.');
            button('Under 18', () => { manager.declareAge(false); this.render(); });
            button('18 or over', () => { manager.declareAge(true); this.render(); });
        } else if (this.confirmation) {
            const deleting = this.confirmation === 'account';
            text(deleting ? 'Delete this email account and all its online adventure copies? Adventures already saved in this browser stay here.'
                : 'Remove this online copy? Copies already saved on your devices stay there.');
            button(deleting ? 'Delete account' : 'Remove online copy', () => this.run(async () => {
                if (deleting) await manager.deleteAccount();
                else await manager.removeAdventure(this.confirmation.id, this.confirmation.revision);
                this.confirmation = null;
            }));
            button('Cancel', () => { this.confirmation = null; this.render(); });
        } else if (manager.user && manager.phase === 'signed_in') {
            text(`Signed in as ${manager.maskedEmail()}`);
            const statuses = {
                saved: 'This adventure is saved to your account.', saving: 'Saving your adventure…',
                connected: 'This adventure is connected. New progress saves as you play.',
                offline: 'Your latest progress is in this browser. Online saving will retry when available.',
                conflict: messages.adventure_changed, removed: messages.adventure_removed
            };
            if (statuses[manager.syncStatus]) text(statuses[manager.syncStatus]).setAttribute('role', 'status');
            const bound = manager.binding();
            if (!bound || bound.disconnected || bound.accountId !== manager.user.id) {
                button('Add this adventure to my account', () => this.run(() => manager.attachCurrent()), true);
            }
            if (manager.syncStatus === 'offline') button('Try saving again', () => this.run(() => manager.flush()));
            if (['conflict', 'removed'].includes(manager.syncStatus)) {
                button('Save this as a separate adventure', () => this.run(() => manager.saveAsSeparateAdventure()));
            }
            if (!manager.library.length) text('Your saved adventures will appear here. Adding one keeps its copy in this browser.');
            for (const adventure of manager.library) {
                const row = doc.createElement('div'); row.className = 'account-adventure'; panel.append(row);
                button(`Continue with ${adventure.display_name || 'your creature'}`, () => this.run(async () => {
                    const key = await manager.openAdventure(adventure.id);
                    this.close(); this.onChosen?.(key);
                }), false, row);
                const details = doc.createElement('details'); const summary = doc.createElement('summary');
                summary.textContent = 'Manage this online copy'; details.append(summary); row.append(details);
                button('Remove online copy', () => { this.confirmation = adventure; this.render(); }, false, details);
            }
            button('Refresh saved adventures', () => this.run(() => manager.refreshLibrary()));
            button('Sign out', () => this.run(() => manager.signOut()));
            const details = doc.createElement('details'), summary = doc.createElement('summary');
            summary.textContent = 'Account settings'; details.append(summary); panel.append(details);
            button('Delete email account…', () => { this.confirmation = 'account'; this.render(); }, false, details);
        } else if (manager.user && manager.phase === 'finish_setup') {
            text('Your email is verified. Finish setting up your optional adult account to see your saved adventures.');
            button('Finish account setup', () => this.run(() => manager.finishSetup()), true);
            button('Sign out', () => this.run(() => manager.signOut()));
        } else if (manager.phase === 'email_link') {
            text('Confirm your email to finish signing in. This also works if the email opened in a different browser.');
            const form = doc.createElement('form'); panel.append(form);
            const email = field(form, 'Email address', 'email', 'email'); email.maxLength = 254;
            email.value = manager.client.auth.pendingEmail?.() || '';
            const label = doc.createElement('label'); label.className = 'account-consent';
            const consent = doc.createElement('input'); consent.type = 'checkbox'; consent.required = true; consent.name = 'consent';
            label.append(consent, doc.createTextNode('I am 18 or over. Sign me in to my optional creature account.'));
            form.append(label);
            const submit = button('Finish signing in', () => form.requestSubmit(), true, form);
            submit.type = 'submit'; submit.onclick = null;
            form.onsubmit = event => { event.preventDefault(); this.run(() => manager.completeLink(email.value, { consent: consent.checked })); };
            button('Request a new link', () => { manager.phase = 'signed_out'; this.render(); });
        } else if (manager.phase === 'link_sent') {
            text(`Check ${manager.maskedEmail()} and open the sign-in link. You can keep playing while you wait.`);
            button('Send a new link', () => this.run(() => manager.requestLink(manager.pendingEmail, { consent: true })));
            button('Use another email', () => { manager.phase = 'signed_out'; manager.pendingEmail = null; this.render(); });
        } else {
            text('Save your creatures and continue on another device. Use the same email to create an account or sign in. No password to remember.');
            const form = doc.createElement('form'); panel.append(form);
            const email = field(form, 'Email address', 'email', 'email'); email.maxLength = 254;
            const label = doc.createElement('label'); label.className = 'account-consent';
            const consent = doc.createElement('input'); consent.type = 'checkbox'; consent.required = true; consent.name = 'consent'; consent.disabled = this.busy;
            label.append(consent, doc.createTextNode('I am 18 or over. Use my email for sign-in and recovery, and keep the adventures I choose in my account.'));
            form.append(label);
            const submit = button(this.busy ? 'Sending…' : 'Send sign-in link', () => form.requestSubmit(), true, form);
            submit.type = 'submit'; submit.onclick = null;
            form.onsubmit = event => { event.preventDefault(); this.run(() => manager.requestLink(email.value, { consent: consent.checked })); };
        }
        if (this.notice) text(this.notice).setAttribute('role', 'status');
        const privacy = doc.createElement('details'), summary = doc.createElement('summary'), explanation = doc.createElement('p');
        summary.textContent = 'How account saving works';
        explanation.textContent = 'An account is optional. Google Firebase processes your email for sign-in and recovery. Only adventures you add are stored with your account. Your email is not part of your game save, analytics or creature artwork. You can remove online copies or delete the account here. Local copies stay on each device until you remove that site’s data.';
        privacy.append(summary, explanation); panel.append(privacy);
        const close = button('Keep playing', () => this.close()); close.disabled = false;
        overlay.append(panel);
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
            if (event.key !== 'Tab') return;
            const controls = [...panel.querySelectorAll('input, button, summary')].filter(el => !el.disabled &&
                (!el.closest('details:not([open])') || el.tagName === 'SUMMARY'));
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first?.focus(); }
        });
        this.element = overlay; doc.body.append(overlay);
        for (const input of panel.querySelectorAll('input')) {
            const draft = drafts.find(item => item.name === input.name);
            if (draft) { input.value = draft.value; input.checked = draft.checked; }
        }
        const sameInput = [...panel.querySelectorAll('input:not([disabled])')].find(input => input.name === focused);
        (sameInput || panel.querySelector('input:not([disabled]), button:not([disabled])'))?.focus();
    }
    close() {
        this.opened = false; this.unsubscribe?.(); this.element?.remove(); this.element = null;
        if (this.parent) this.parent.inert = false;
        this.returnFocus?.focus();
    }
}
