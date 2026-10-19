// Direct boss fixtures skip normal naming/Sanctuary service initialisation.
// Load those real services before entering combat, never during a reward retry.
function stageGuardianHandoffServicesFixture(state, thoughts, achievements) {
    if (!state || state.getSaveAdmission?.().status !== 'ready' ||
        typeof thoughts?.initialize !== 'function' || typeof thoughts.captureCompletionContextSource !== 'function' ||
        typeof achievements?.initialize !== 'function' || typeof achievements.hasHatchProgressSource !== 'function') return false;
    if (!achievements.initialized) achievements.initialize();
    if (!achievements.hasHatchProgressSource(state)) return false;
    thoughts.initialize();
    return thoughts.captureCompletionContextSource({ state }).status === 'captured';
}

module.exports = { stageGuardianHandoffServicesFixture };
