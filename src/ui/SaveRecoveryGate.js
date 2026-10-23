/** A DOM gate also works before Phaser has started. No save bytes enter the markup. */
export default class SaveRecoveryGate {
    constructor(gameState, options = {}) {
        this.gameState = gameState;
        this.document = options.document || document;
        this.reload = options.reload || (() => window.location.reload());
        this.onNewAdventure = options.onNewAdventure;
        this.onChooseAdventure = options.onChooseAdventure;
        this.pause = options.pause || (() => {
            const game = window.mythicalGame;
            game?.scene?.getScenes?.(true).forEach(scene => {
                const key = scene.scene?.key;
                if (key) {
                    window.errorHandler?.setIntentionalPause?.(key, true);
                    game.scene.pause(key);
                }
            });
            game?.sound?.pauseAll?.();
        });
        this.unsubscribe = gameState.on('saveAdmissionChanged', () => this.render());
        this.render();
    }

    waitUntilReady() {
        if (this.gameState.getSaveAdmission().status !== 'held') return Promise.resolve();
        return new Promise(resolve => {
            const off = this.gameState.on('saveAdmissionChanged', admission => {
                if (admission.status !== 'held') {
                    off();
                    resolve();
                }
            });
        });
    }

    render(message = '') {
        this.element?.remove();
        const admission = this.gameState.getSaveAdmission();
        if (admission.status !== 'held') return;
        this.pause();
        const doc = this.document;
        const overlay = doc.createElement('div');
        overlay.className = 'save-recovery-gate';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'save-recovery-title');
        const panel = doc.createElement('section');
        const title = doc.createElement('h1');
        title.id = 'save-recovery-title';
        title.textContent = 'This adventure needs a little help';
        const summary = doc.createElement('p');
        const cloudRecovery = this.gameState.getCloudRecoveryStatus?.();
        const cloudHold = cloudRecovery?.pending === true;
        const localSummary = ['commit_failed', 'save_unreadable'].includes(admission.reason)
            ? 'The saved game could not be verified. Playing and Cloud Save are paused. Do not clear this browser\'s data. Ask a grown-up to help.'
            : 'This build cannot safely open your saved progress. Playing and Cloud Save are paused. Keep this browser\'s data and ask a grown-up to help.';
        summary.textContent = this.onNewAdventure
            ? 'This adventure could not be opened. Try it again, or hatch a new creature. This adventure and its recovery copies will stay here.'
            : cloudHold
            ? 'A Cloud Save or Fusion result has not been confirmed. Playing and cloud changes are paused so neither version is overwritten. Keep this browser\'s data and ask a grown-up to help. Starting again or choosing a copy cannot confirm what happened in the cloud.'
            : localSummary;
        panel.append(title, summary);
        const action = (label, callback, parent = panel) => {
            const button = doc.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.addEventListener('click', () => {
                try { callback(); } catch (error) {
                    this.render('That did not finish. Your other adventures are still here. Check that this browser has space to save, then try again.');
                }
            });
            parent.append(button);
            return button;
        };
        if (this.onNewAdventure) {
            action('Start a new adventure', () => this.onNewAdventure()).className = 'adventure-primary';
        }
        const retry = action('Try saved game again', () => {
            if (this.gameState.load()) this.reload();
            else this.render(this.onNewAdventure
                ? 'This adventure still needs help. You can start a new one while keeping it here.'
                : cloudHold
                ? 'Still protected. Recovery needs confirmed cloud evidence, not another Fusion request.'
                : 'This save cannot be opened safely yet. Keep this browser\'s data.');
        });
        if (this.onChooseAdventure) action('Choose another adventure', () => this.onChooseAdventure());
        if (cloudHold && !this.onNewAdventure) {
            const notice = doc.createElement('p');
            notice.setAttribute('role', 'status');
            notice.textContent = message || (cloudRecovery.damaged || cloudRecovery.evidenceLimited
                ? 'Some recovery information is missing, unreadable or could not be saved. Keep this page open and ask a grown-up to help. Nothing will be automatically reset.'
                : 'Recovery needs a confirmed cloud outcome. This build will not repeat Fusion or choose a version for you.');
            panel.append(notice);
            overlay.append(panel);
            this.element = overlay;
            doc.body.append(overlay);
            overlay.addEventListener('keydown', event => {
                if (event.key === 'Tab') { event.preventDefault(); retry.focus(); }
            });
            retry.focus();
            return;
        }
        let recoveryPanel = panel;
        if (this.onNewAdventure) {
            recoveryPanel = doc.createElement('details');
            const label = doc.createElement('summary');
            label.textContent = 'Recovery options';
            const explanation = doc.createElement('p');
            explanation.textContent = cloudHold
                ? 'An online save or Fusion result is still unconfirmed. We have paused changes to this adventure. Keep this site’s browser data so its recovery copies remain available.'
                : 'Keep this site’s browser data. You can try an earlier recovery copy below; restoring one replaces the progress in this adventure.';
            recoveryPanel.append(label, explanation);
            panel.append(recoveryPanel);
        }
        const backups = cloudHold ? [] : this.gameState.getLocalSaveBackups();
        if (backups.length) {
            const label = doc.createElement('label');
            label.textContent = 'Recovery copy';
            const select = doc.createElement('select');
            backups.forEach((backup, index) => {
                const option = doc.createElement('option');
                option.value = backup.id;
                option.textContent = `Copy ${index + 1} - ${new Date(backup.createdAt).toLocaleString()}`;
                select.append(option);
            });
            label.append(select);
            recoveryPanel.append(label);
            action('Restore selected copy...', () => this.confirm('Restore this recovery copy?', () => {
                if (this.gameState.restoreLocalSaveBackup(select.value)) this.reload();
                else this.render('That copy could not be restored safely. Your game is still paused.');
            }), recoveryPanel);
        }
        if (!this.onNewAdventure) action('Start a new game...', () => this.confirm('Start again from a new egg?', () => {
            this.gameState.startFreshGame();
            this.reload();
        }));
        const notice = doc.createElement('p');
        notice.setAttribute('role', 'status');
        notice.textContent = message;
        panel.append(notice);
        overlay.append(panel);
        this.element = overlay;
        doc.body.append(overlay);
        overlay.addEventListener('keydown', event => {
            if (event.key !== 'Tab') return;
            const controls = [...overlay.querySelectorAll('button, select, summary')].filter(control =>
                !control.closest('details:not([open])') || control.tagName === 'SUMMARY');
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && doc.activeElement === first) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && doc.activeElement === last) {
                event.preventDefault(); first.focus();
            }
        });
        panel.querySelector('button')?.focus();
    }

    confirm(title, commit) {
        const panel = this.element.querySelector('section');
        panel.replaceChildren();
        const heading = this.document.createElement('h1');
        heading.id = 'save-recovery-title';
        heading.textContent = title;
        const warning = this.document.createElement('p');
        warning.textContent = 'This replaces the active game. A recovery copy must be saved first. Unsupported copies are kept, and Cloud Save stays paused for a new game.';
        panel.append(heading, warning);
        const cancel = this.document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Keep my saved game';
        cancel.onclick = () => this.render();
        const proceed = this.document.createElement('button');
        proceed.type = 'button';
        proceed.textContent = 'Confirm replacement';
        proceed.onclick = () => {
            try { commit(); } catch (error) {
                this.render('The replacement could not be confirmed safely. Keep this browser\'s data. Your game is still paused.');
            }
        };
        panel.append(cancel, proceed);
        cancel.focus();
    }

    destroy() {
        this.unsubscribe();
        this.element?.remove();
    }
}
