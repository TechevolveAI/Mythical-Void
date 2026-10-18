const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const EventEmitter = require('eventemitter3');
const Clock = require('phaser/src/time/Clock');
const GameObject = require('phaser/src/gameobjects/GameObject');
const Rectangle = require('phaser/src/geom/rectangle/Rectangle');
const Contains = require('phaser/src/geom/rectangle/Contains');
const GameStateManager = require('../../systems/GameState.js');
const root = path.join(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'scenes/PlatformerLevelScene.js'), 'utf8');
const cls = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const summary = new Function(read('systems/RegionalVictorySummary.js').replace(/export /g, '') + '\nreturn getRegionalVictorySummary;')();
const View = new Function('icons', read('ui/RegionalVictoryView.js')
    .replace(/import \{([^}]+)\} from 'lucide';/, 'const {$1} = icons;')
    .replace('export function', 'function') + '\nreturn renderRegionalVictory;')(require('lucide'));
const Panel = new Function('renderRegionalVictory', read('ui/ExpeditionDebriefPanel.js')
    .replace(/^import .*;$/gm, '').replace('export default class', 'class') + '\nreturn ExpeditionDebriefPanel;')(View);

// Actual source, Clock, GameObject destruction and DOM panel. Drawing and
// services stay fictional; no Phaser game, browser, audio or provider is opened.
function fixture({ width = 390, height = 844, media = () => null, PanelType = Panel } = {}) {
    const state = new GameStateManager(); state.save(); window.GameState = state;
    const scene = { events: new EventEmitter(), scene: {},
        sys: { isActive: () => scene.active, queueDepthSort() {}, input: { clear: jest.fn() } }, active: true,
        cameras: { main: { width, height } }, input: { enabled: true },
        residentReleaseElements: [], residentReleaseOpen: false,
        pendingResidentReleaseContinuation: null, residentReleaseClose: null,
        enterLevelCompletionState: jest.fn(), destroyGeneratedVideoReadyNotice: jest.fn(),
        presentLevelCompletion: jest.fn(), getVillageCompletionCopy: () => '',
        returnToHub: jest.fn(), replayForestBirthdayMessage: jest.fn(),
        textures: { exists: () => false }, tweens: { add: jest.fn() },
        levelCompletionResult: { levelId: 'mythicalForest', firstCompletion: true, coinsAwarded: 21,
            rescuedResident: { id: 'fictional-resident', name: 'Fictional Bloom', newlyRescued: true,
                role: 'Route keeper', releaseLine: 'The crossing is open.', supportLabel: 'One extra guard.' } } };
    scene.sys.events = scene.events;
    const objects = [];
    const object = text => {
        const value = new GameObject(scene, 'SyntheticReleaseObject'); value.text = text;
        for (const method of ['fillStyle', 'fillRect', 'setScrollFactor', 'setDepth', 'setOrigin',
            'setAlpha', 'lineStyle', 'lineBetween', 'setScale']) value[method] = () => value;
        value.setText = text => { value.text = text; return value; };
        value.setInteractive = () => { value.input = { enabled: true }; return value; };
        value.disableInteractive = () => { if (value.input) value.input.enabled = false; return value; };
        objects.push(value); return value;
    };
    scene.add = { graphics: () => object(), text: (_x, _y, text) => object(text) };
    const clock = scene.time = new Clock(scene);
    const acknowledge = jest.fn();
    const context = { window, document, console, Promise, Date,
        Phaser: { Geom: { Rectangle: Object.assign(Rectangle, { Contains }) } },
        createDecorativeFlag: () => object(), companionMediaService: { createCinematicStill: media },
        ExpeditionDebriefPanel: PanelType, getRegionalVictorySummary: summary,
        getProjectBeaconDebrief: () => null, acknowledgeProjectBeaconDebrief: acknowledge,
        shareGuardianRestoration: jest.fn() };
    for (const name of ['showRescuedResidentReleaseMoment', 'showRegionalVictorySummary', 'bindLevelCompletionReturn']) {
        const node = cls.body.body.find(item => item.key?.name === name);
        scene[name] = vm.runInNewContext(`({${source.slice(node.start, node.end)}}).${name}`, context).bind(scene);
    }
    const button = () => objects.findLast(value => value.active && value.input && value.text);
    return { scene, state, objects, clock, acknowledge, button,
        show() { return scene.showRescuedResidentReleaseMoment(scene.levelCompletionResult.rescuedResident); },
        advance(delta) { clock.preUpdate(); clock.update(clock.now + delta, delta); clock.preUpdate(); },
        close() {
            scene.residentReleasePresentation?.retire();
            scene.active = false; scene.regionalVictoryPanel?.destroy();
            if (scene.levelCompletionKeyHandler) window.removeEventListener('keydown', scene.levelCompletionKeyHandler);
            clock.destroy(); objects.forEach(value => value.destroy()); state.stopAutoSave();
        } };
}
module.exports = { fixture, Panel };
