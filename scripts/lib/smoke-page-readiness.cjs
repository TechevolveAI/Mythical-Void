// Serialized into the browser: do not close over Node state.
function smokePageSnapshot(scope) {
    const game = scope.mythicalGame;
    if (scope.__mythicalSmokeLeavingDocument
        || scope.document?.readyState !== 'complete'
        || !game?.scene || !game?.renderer || !game?.scale || !scope.Phaser) return null;
    const gl = game.renderer.gl;
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
        webgl: game.renderer.type === scope.Phaser.WEBGL,
        name: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null,
        width: game.scale.width,
        height: game.scale.height
    };
}

// Read the real Continue control. Never substitute Start new or mutate a save.
function smokeAdventureContinuePoint(scope) {
    if (scope.__mythicalSmokeLeavingDocument || scope.document?.readyState !== 'complete') return null;
    const dialog = scope.document.querySelector?.('.adventure-menu[role="dialog"]');
    if (!dialog) return null;
    const buttons = [...dialog.querySelectorAll('button')].filter(button =>
        /^Continue(?: adventure$| with )/.test(button.textContent.trim()) && !button.disabled);
    if (buttons.length !== 1) throw new Error('Saved adventure has no unambiguous Continue action');
    const bounds = buttons[0].getBoundingClientRect();
    const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
    if (bounds.width <= 0 || bounds.height <= 0 || x < 0 || y < 0 ||
        x >= scope.innerWidth || y >= scope.innerHeight) {
        throw new Error('Saved adventure Continue action is not visible');
    }
    return { x, y };
}

module.exports = { smokePageSnapshot, smokeAdventureContinuePoint };
