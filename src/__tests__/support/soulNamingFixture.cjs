const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const GameStateManager = require('../../systems/GameState.js');
const source = fs.readFileSync(path.join(__dirname, '../../scenes/SoulRevealScene.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ExportDefaultDeclaration').declaration;

function attach(scene, name, globals = {}) {
    const node = declaration.body.body.find(method => method.key?.name === name);
    if (!node) throw Error(`MISSING_NAMING_METHOD:${name}`);
    scene[name] = vm.runInNewContext(`({${source.slice(node.start, node.end)}}).${name}`, {
        window, document, localStorage, console, devLog() {}, Math, Date,
        requestAnimationFrame: callback => callback(), ...globals
    }).bind(scene);
}

function fixture() {
    const state = new GameStateManager();
    state.set('session.gameStarted', true);
    state.set('creature.hatched', true);
    state.set('creature.named', false);
    state.set('creature.id', 'fictional-active-creature');
    state.set('creature.genes', { id: 'fictional-hatched-genes', species: 'nebulaSprite', rarity: 'rare' });
    state.set('creature.hatchTime', Date.now() - 1000);
    state.state = state.prepareSaveCandidate(state.createSaveSnapshot()).state;
    expect(state.save()).toBe(true);
    window.GameState = state;
    const states = [state];
    const input = document.createElement('input');
    document.body.append(input);
    const scene = {
        canProceed: true, inputActive: true, nameInput: 'Fictional Glow',
        htmlInput: input, nameDomElement: { destroy: jest.fn() },
        nameSubmitDomElement: null, compactNamingScrim: null, compactNamingPrompt: null,
        hasAncientLineage: false, soulPhrase: { phrase: 'Fictional creature phrase' },
        personalityPreview: 'Fictional curiosity', rarityContext: 'Fictional rarity context',
        creatureData: { personalityCore: 'curious', cosmicAffinity: 'nebula', powerLevel: 0.5,
            rarity: 'rare', mutations: [], isShiny: false, shinyType: null },
        innateAbility: { name: 'Fictional light', icon: '*', description: 'Fictional ability',
            benefit: 'Fictional benefit', range: 'near' },
        elements: [],
        getRevealLayout: () => ({ buttonTop: 710, inputWidth: 320, buttonHeight: 48 }),
        layoutNativeNamingControls: jest.fn(),
        add: { dom(x, y, element) {
            document.body.append(element);
            return { setOrigin() { return this; }, setDepth() { return this; } };
        } },
        showLivingPortraitHandoff: jest.fn(), scene: { start: jest.fn() }
    };
    for (const name of ['finalizeName', 'retryNamingSave', 'finishNamingPresentation', 'clearNamingSaveRecovery',
        'showNamingSaveRecovery', 'showNamingServiceRecovery', 'buildSoulDataForProfile', 'saveSoulDataForProfile', 'showBeginButton',
        'init', 'shutdown', 'restoreDomContainerStyles']) attach(scene, name);
    attach(scene, 'retireLivingFormHandoff');
    scene.showBeginButton(390, 844);
    return { state, scene, input, button: scene.nameSubmitButton, states,
        raw: () => localStorage.getItem(state.saveKey),
        replaceManager() {
            const next = new GameStateManager(); states.push(next); window.GameState = next; return next;
        },
        close() { scene.clearNamingSaveRecovery(); for (const owner of states) owner.stopAutoSave(); } };
}

module.exports = { fixture, GameStateManager, attach };
