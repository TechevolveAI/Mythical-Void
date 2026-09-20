// Serialized into the browser: do not close over Node state.
function smokePageReady(scope) {
    const game = scope.mythicalGame;
    return !scope.__mythicalSmokeLeavingDocument
        && scope.document?.readyState === 'complete'
        && Boolean(game?.scene && game?.renderer && game?.scale);
}

module.exports = { smokePageReady };
