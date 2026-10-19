// Direct boss fixtures skip the Sanctuary's normal thought-context initialisation.
// Load that real service before entering combat, never during a reward retry.
function stageGuardianHandoffThoughtFixture(state, thoughts) {
    if (!state || state.getSaveAdmission?.().status !== 'ready' ||
        typeof thoughts?.initialize !== 'function' || typeof thoughts.captureCompletionContextSource !== 'function') return false;
    thoughts.initialize();
    return thoughts.captureCompletionContextSource({ state }).status === 'captured';
}

module.exports = { stageGuardianHandoffThoughtFixture };
