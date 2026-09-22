// Runs inside the proof browser, or against an injected event source in tests.
// Capture during postrender: a Playwright screenshot round-trip can miss the
// final 156ms of the animation even when the game completes correctly.
function startBanishmentCapture(options) {
    const {game, getScene} = options || {game:window.game, getScene:()=>window.prototypeScene};
    const targets = [.25, .55, .82, .94];
    const capture = {frames:[], error:null, dispose:()=>game.events.off('postrender', sample)};
    function sample() {
        const scene = getScene(), state = scene.encounter.snapshot();
        if (state.mode === 'aftermath') {
            capture.error = 'Banishment ended before all required frames were captured';
            capture.dispose(); return;
        }
        if (state.mode !== 'banishment') return;
        const index = capture.frames.length;
        if (state.progress < targets[index]) return;
        if (state.progress >= (targets[index + 1] || 1)) {
            capture.error = `Missed banishment frame at ${targets[index]}`;
            capture.dispose(); return;
        }
        const proof = scene.getProofState();
        capture.frames.push({target:targets[index], progress:state.progress, rig:proof.sourceArtRig,
            width:game.canvas.width, height:game.canvas.height,
            png:game.canvas.toDataURL('image/png').split(',')[1]});
        if (capture.frames.length === targets.length) capture.dispose();
    }
    game.events.on('postrender', sample);
    if (!options) window.banishmentCapture = capture;
    return capture;
}

module.exports = {startBanishmentCapture};
