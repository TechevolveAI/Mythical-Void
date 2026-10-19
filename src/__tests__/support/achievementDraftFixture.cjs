const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const GameStateManager = require('../../systems/GameState.js');
const { compiledModuleSource } = require('./compiledInventorySource.cjs');
const dataModule = { exports: {} };
vm.runInNewContext(compiledModuleSource('utils/DetachedJsonData.js'), { module: dataModule });
const { copyDetachedJsonData, freezeDetachedJsonData } = dataModule.exports;
const root = path.resolve(__dirname, '../../..');
const clone = value => JSON.parse(JSON.stringify(value));

function loadAchievementSystem(gameState, { source, noGlobalState = false, initialize = true, sceneWindow } = {}) {
    const code = (source || fs.readFileSync(path.join(root, 'src/systems/AchievementSystem.js'), 'utf8'))
        .replace(/^import .*$/gm, '')
        .replace('export default achievementSystem;', '')
        .replace('export { TIERS, CATEGORIES, ACHIEVEMENT_DEFINITIONS };', 'module.exports = achievementSystem;');
    const sandbox = { module: { exports: {} }, console, Date, Math, Object, Array, Number, String,
        Boolean, Set, copyDetachedJsonData, freezeDetachedJsonData, devLog: jest.fn(), devWarn: jest.fn() };
    if (!noGlobalState) sandbox.window = sceneWindow || { GameState: gameState };
    vm.runInNewContext(code, sandbox, { filename: 'actual-AchievementSystem.js' });
    const system = sandbox.module.exports;
    if (!noGlobalState && initialize) system.initialize();
    return { system, sandbox };
}

function fixture({ seed = () => {}, source } = {}) {
    const state = new GameStateManager();
    seed(state);
    window.GameState = state;
    const { system, sandbox } = loadAchievementSystem(state, { source });
    const events = [];
    const emit = state.emit.bind(state);
    state.emit = (event, data) => { events.push(clone({ kind: 'state', event, data })); emit(event, data); };
    jest.spyOn(state, 'save').mockImplementation(() => {
        events.push({ kind: 'save-request' }); return true;
    });
    system.events = { emit: (event, data) => events.push(clone({ kind: 'achievement', event, data })) };
    return { state, system, sandbox, events, close: () => state.stopAutoSave() };
}

const progress = system => Object.fromEntries(Object.entries(system.definitions).map(([id, definition]) => [id, {
    progress: clone(definition.progress || {}), claimed: clone(definition.claimed || {})
}]));

module.exports = { fixture, loadAchievementSystem, progress, clone };
