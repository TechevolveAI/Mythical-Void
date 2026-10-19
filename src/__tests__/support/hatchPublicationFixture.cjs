const GameStateManager = require('../../systems/GameState.js');
const CloudSaveManager = require('../../systems/CloudSaveManager.js');
const { loadAchievementSystem, clone } = require('./achievementDraftFixture.cjs');

function fixture({ withCloud = false } = {}) {
    const state = new GameStateManager(), states = [state];
    window.GameState = state;
    state.set('session.gameStarted', true);
    state.set('creature.hatched', true);
    state.set('creature.named', false);
    state.set('creature.genes', { id: 'fictional-publication-genes', species: 'nebulaSprite', rarity: 'rare' });
    state.set('creature.hatchTime', Date.now());
    state.state = state.prepareSaveCandidate(state.createSaveSnapshot()).state;
    expect(state.save()).toBe(true);
    const ownedCloud = withCloud ? new CloudSaveManager({ client: null, gameState: state,
        storage: localStorage, lockManager: null }) : null;
    if (ownedCloud) window.CloudSave = ownedCloud;
    const { system } = loadAchievementSystem(state);
    window.AchievementSystem = system;
    const input = clone(state.state);
    input.creature.name = 'Fictional Publication'; input.creature.named = true;
    const prepared = system.prepareHatchEventDraft(input, {
        hatchId: 'fictional-publication-genes', species: 'nebulaSprite', rarity: 'rare'
    });
    const staged = prepared.state, definitions = system.definitions;
    const ids = Object.keys(definitions), events = [];
    const initial = { entries: ids.map(id => ({ id, progress: definitions[id].progress, claimed: definitions[id].claimed })),
        claims: system.pendingClaims };
    const checkpoints = [initial], steps = [];
    let cursor = 0, assigning = false, phase = 'before', active = true;
    const describe = previous => ({ entries: previous.entries.map(entry => ({ ...entry })), claims: previous.claims });
    for (const id of ids) {
        for (const field of ['progress', 'claimed']) {
            const value = clone(prepared.achievements[id][field]);
            const next = describe(checkpoints.at(-1)); next.entries.find(entry => entry.id === id)[field] = value;
            steps.push(() => { definitions[id][field] = value; }); checkpoints.push(next);
        }
    }
    const claims = clone(prepared.pendingClaims), final = describe(checkpoints.at(-1)); final.claims = claims;
    steps.push(() => { system.pendingClaims = claims; }); checkpoints.push(final);
    const data = descriptor => JSON.stringify({ entries: descriptor.entries, claims: descriptor.claims });
    const signatures = checkpoints.map(data);
    const matches = index => {
        const expected = checkpoints[index];
        return system.definitions === definitions && system.pendingClaims === expected.claims &&
            expected.entries.every(entry => definitions[entry.id].progress === entry.progress &&
                definitions[entry.id].claimed === entry.claimed) &&
            data({ entries: ids.map(id => ({ id, progress: definitions[id].progress, claimed: definitions[id].claimed })),
                claims: system.pendingClaims }) === signatures[index];
    };
    const cloud = window.CloudSave, epoch = state.getSaveAdmission().epoch;
    const current = () => active && window.GameState === state && window.CloudSave === cloud &&
        window.AchievementSystem === system && state.getSaveAdmission().epoch === epoch &&
        (matches(cursor) || (assigning && matches(cursor + 1)));
    const publish = jest.fn(({ throwAfter = null } = {}) => {
        phase = 'publishing';
        while (cursor < steps.length) {
            assigning = true; steps[cursor](); cursor += 1; assigning = false;
            if (cursor === throwAfter) throw Error('fictional partial publication failure');
        }
        phase = 'published';
    });
    const emit = state.emit.bind(state);
    state.emit = (event, value) => { events.push({ event, value }); return emit(event, value); };
    const options = {
        isCurrentCampaign: current,
        isCurrentResult: (live, durable, serialized) =>
            JSON.stringify(state.createSaveSnapshot({ state: live })) === serialized && JSON.stringify(durable) === serialized,
        onPublished: () => { publish(); }
    };
    const f = { state, states, system, prepared, staged, events, publish, options, matches, cloud: ownedCloud,
        phase: () => phase, coherent: () => phase === 'published' && matches(steps.length),
        commit(overrides = {}) { return state.commitHatchSaveDraft(staged, { ...options, ...overrides }); },
        retireScene: () => { active = false; },
        replaceManager() {
            const next = new GameStateManager(); states.push(next); window.GameState = next;
            next.set('player.cosmicCoins', 77); expect(next.save()).toBe(true); return next;
        },
        raw: () => localStorage.getItem(state.saveKey),
        close() { ownedCloud?.destroy(); for (const owner of states) owner.stopAutoSave(); }
    };
    return f;
}

module.exports = { fixture, GameStateManager, clone };
