const fs = require('node:fs'), path = require('node:path'), { parse } = require('@babel/parser');
const { EventEmitter } = require('node:events');
const GameStateManager = require('../../systems/GameState.js');
const root = path.join(__dirname, '../..');
function load(file, names, dependencies = {}) {
    const source = fs.readFileSync(path.join(root, 'systems', file), 'utf8');
    const body = parse(source, { sourceType: 'module' }).program.body.map(node => {
        if (node.type === 'ImportDeclaration' || node.type === 'ExportDefaultDeclaration') return '';
        if (node.type === 'ExportNamedDeclaration') return node.declaration ? source.slice(node.declaration.start, node.declaration.end) : '';
        return source.slice(node.start, node.end);
    }).join('\n');
    return new Function('window', ...Object.keys(dependencies), `${body}\nreturn {${names.join(',')}};`)(window, ...Object.values(dependencies));
}
const dependencies = {
    bossConfigs: require('../../config/bosses.json'),
    ...load('GuardianOutcomes.js', ['getGuardianOutcomeSnapshot']),
    ...load('CurrentEcology.js', ['recordCurrentRegionRestoration']),
    ...load('RescuedResidents.js', ['recordRescuedResident']),
    ...load('ProjectBeaconStory.js', ['queueProjectBeaconDebrief'], { projectBeacon: require('../../config/project-beacon.json') }),
    ...load('FinalVoidApproach.js', ['validApproachCheckpoint'])
};
const progress = load('TrumptopusProgress.js', ['beginTrumptopusRun', 'checkpointTrumptopusRun', 'checkpointTrumptopusApproach',
    'recordTrumptopusVictory', 'getTrumptopusRun'], dependencies);
function fixture({ phase = 2, withApproach = false, beforeConstruct, inventoryManager } = {}) {
    const state = new GameStateManager(); window.GameState = state;
    state.set('creature.genes', { id: 'synthetic_finale_genes', rarity: 'rare', species: 'synthetic_crystal' });
    state.set('creature.dna', { id: 'synthetic_finale_dna', seed: 42 });
    state.set('creature.lifecycle.stage', 'adult'); state.set('creature.hatched', true);
    if (!state.save()) throw Error('SYNTHETIC_INITIAL_SAVE_FAILED');
    const startFight = () => {
        const run = progress.beginTrumptopusRun(state).run;
        progress.checkpointTrumptopusRun(state, run.sequence, 1);
        progress.checkpointTrumptopusRun(state, run.sequence, 2); return run.sequence;
    };
    if (phase === 2) startFight();
    const scene = { events: new EventEmitter(), clearInput: jest.fn(), enterLevelCompletionState: jest.fn(), scene: { start: jest.fn() } };
    const films = { prepare: jest.fn(() => Promise.resolve(false)), dispose: jest.fn() };
    const panel = { close: jest.fn() }, createPanel = jest.fn(() => panel);
    const recovery = jest.fn(() => ({ status: 'repair' }));
    const { TrumptopusCompletion } = load('TrumptopusCompletion.js', ['TrumptopusCompletion'], {
        ...progress, getCampaignFinaleRecovery: recovery
    });
    beforeConstruct?.({ state, scene });
    const controller = new TrumptopusCompletion(scene, { gameState: state, films, createPanel, withApproach, inventoryManager });
    const encounter = { snapshot: jest.fn(() => ({ phaseIndex: 2, completionReady: true })) };
    const snapshot = () => ({ root: state.state, raw: localStorage.getItem(state.saveKey), bytes: JSON.stringify(state.state) });
    return { state, scene, films, panel, createPanel, recovery, controller, encounter, startFight, snapshot, progress,
        win: () => controller.observe(encounter),
        close() { controller.retire(); state.stopAutoSave(); delete window.GameState; } };
}
module.exports = { fixture, GameStateManager, progress };
