export function clearCompletionSaveRecovery(scene) {
    const owned = scene.completionSaveRecovery;
    scene.completionSaveRecovery = null;
    try { owned?.remove(); }
    catch { owned?.parentNode?.removeChild(owned); }
}

// Same layout as the existing hatch/naming recovery, with no gameplay controls
// behind it receiving the gesture that selects a retry or a safe exit.
export function showCompletionSaveRecovery(scene, { isCurrent, onRetry, onExit, committed = false, waiting = false }) {
    if (!isCurrent()) return false;
    clearCompletionSaveRecovery(scene);
    if (!isCurrent()) return false;
    const overlay = document.createElement('div');
    overlay.className = 'save-recovery-gate'; overlay.dataset.completionSaveRecovery = committed ? 'presentation' : 'save';
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Expedition paused');
    const panel = document.createElement('section'), title = document.createElement('h1'), message = document.createElement('p');
    title.textContent = committed ? 'Your rewards are saved' : waiting ? 'Finishing your save' : onRetry ? 'Keep your discovery here' : 'Your expedition is paused';
    message.textContent = committed ? 'The rewards screen could not open. Try again without fighting the Guardian again.'
        : waiting ? 'Your earlier save is still finishing. Keep this page open, then try again.'
        : onRetry ? 'We could not save yet. Keep this page open and try again.'
            : 'Progress changed while the expedition was finishing. Return to the Sanctuary without adding these rewards again.';
    panel.append(title, message);
    const buttons = [];
    for (const [text, action] of [[committed ? 'Open rewards' : 'Try saving again', onRetry], [committed ? 'Return to Sanctuary' : 'Leave without these rewards', onExit]]) {
        if (!action) continue;
        const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
        button.addEventListener('click', () => {
            if (scene.completionSaveRecovery !== overlay || !isCurrent() || button.disabled) return;
            button.disabled = true;
            try { action(); } finally { if (scene.completionSaveRecovery === overlay) button.disabled = false; }
        });
        buttons.push(button); panel.append(button);
    }
    if (!buttons.length) return false;
    for (const name of ['pointerdown', 'pointerup', 'click']) overlay.addEventListener(name, event => event.stopPropagation());
    overlay.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.key !== 'Tab') return;
        event.preventDefault();
        const index = buttons.indexOf(document.activeElement), next = index + (event.shiftKey ? -1 : 1);
        buttons[(next + buttons.length) % buttons.length].focus();
    });
    overlay.append(panel); scene.completionSaveRecovery = overlay; document.body.append(overlay); buttons[0].focus();
    return true;
}
