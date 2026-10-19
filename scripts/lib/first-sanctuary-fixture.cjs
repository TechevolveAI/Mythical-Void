// Browser-test fixture only. This function is serialised into a fresh test page.
function stageFirstSanctuaryHatchFixture(state, quests = null) {
    if (!state?.canCommitHatchSave?.() || !state.get('creature.genes')?.id) return false;
    if (quests && (!quests.initialized || quests.loadedGameState !== state ||
        quests.loadedAdmissionEpoch !== state.getSaveAdmission().epoch ||
        quests.activeQuests !== state.get('quests.active') ||
        quests.completedQuests !== state.get('quests.completed'))) return false;
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
    if (result.success !== true) return false;
    // Unlike the real hatch, a direct preview emits no quest notifications.
    // Reload only this fixture's already loaded manager after adopting its draft.
    if (quests && (quests.loadQuestState() !== true || quests.loadedGameState !== state ||
        quests.activeQuests !== state.get('quests.active') ||
        quests.completedQuests !== state.get('quests.completed'))) return false;
    return state.get('creature.hatched') === true && state.get('creature.named') === false &&
        Boolean(state.get('creature.id'));
}

function stageFirstSanctuaryLatePortraitFixture(state) {
    if (!state?.canCommitHatchSave?.() || !state.get('creature.hatched') ||
        !state.get('creature.named') || !state.get('creature.id')) return null;
    const stage = state.get('creature.lifecycle.stage') || 'baby';
    const record = { identityKey: `synthetic-late-portrait:${state.get('creature.id')}:${stage}`,
        stage, assetRef: 'portrait-job-v1:00000000-0000-4000-8000-000000000077',
        status: 'ready', provider: 'synthetic-fixture' };
    if (!state.saveCreaturePortrait(record)) return null;
    const current = state.getCreaturePortrait(stage);
    if (current?.identityKey !== record.identityKey || current.assetRef !== record.assetRef) return null;
    // The fake reference is never resolved; texture loading uses a local image.
    return { ...current, imageUrl: '/marketing/nova.webp' };
}

module.exports = { stageFirstSanctuaryHatchFixture, stageFirstSanctuaryLatePortraitFixture };
