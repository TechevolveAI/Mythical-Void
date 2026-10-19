// Browser-test fixture only. This function is serialised into a fresh test page.
function stageFirstSanctuaryHatchFixture(state) {
    if (!state?.canCommitHatchSave?.() || !state.get('creature.genes')?.id) return false;
    const draft = { state: state.createSaveSnapshot(), get: state.get, set: state.set,
        recordOpeningMilestone: state.recordOpeningMilestone, emit() {},
        reportStateMutationError(error) { throw error; } };
    draft.set('session.gameStarted', true);
    draft.set('creature.hatched', true);
    draft.set('creature.named', false);
    draft.set('creature.id', state.get('creature.id') || 'smoke-first-creature');
    draft.set('creature.hatchTime', state.get('creature.hatchTime') || Date.now());
    draft.recordOpeningMilestone('creature_hatched');
    const result = state.commitHatchSaveDraft(draft.state);
    return result.success === true && state.get('creature.hatched') === true &&
        state.get('creature.named') === false && Boolean(state.get('creature.id'));
}

module.exports = { stageFirstSanctuaryHatchFixture };
