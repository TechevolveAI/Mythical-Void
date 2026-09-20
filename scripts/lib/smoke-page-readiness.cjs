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

module.exports = { smokePageSnapshot };
