#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'src/scenes/VictoryScene.js'), 'utf8')
    .replace(/^import .*$/gm, '')
    .replace('export default class VictoryScene', 'class VictoryScene')
    .concat('\nmodule.exports = VictoryScene;\n');

function loadVictoryScene(sceneWindow) {
    class PhaserScene {
        constructor(config) { this.scene = { key: config?.key }; }
    }
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: sceneWindow,
        Phaser: { Scene: PhaserScene },
        devLog() {},
        SceneTransitionHelper: {},
        CAMPAIGN_INTENTS: ['remain_and_defend', 'prepare_homecoming', 'prepare_first_contact'],
        recordCampaignLegacyCapsule() {},
        recordCampaignPriority() {},
        Date,
        Math,
        Object,
        Array,
        Number,
        String,
        Boolean,
        Set
    };
    vm.runInNewContext(source, sandbox, { filename: 'VictoryScene.js' });
    return sandbox.module.exports;
}

function label() {
    return { text: 'SHARE THE GAME', setText(value) { this.text = value; } };
}

async function run() {
    let cases = 0;
    const expectedUrl = 'https://mythicalvoid.com/playable-now/#find-your-way/story';

    cases += 1;
    let shared;
    let VictoryScene = loadVictoryScene({ navigator: { share: async value => { shared = value; } } });
    let scene = new VictoryScene();
    let shareLabel = label();
    assert.strictEqual(await scene.shareCompletedAdventure(shareLabel), 'shared');
    assert.strictEqual(shared.url, expectedUrl);
    assert.strictEqual(shareLabel.text, 'SHARED ✓');
    assert(!JSON.stringify(shared).includes('creatureName'));

    cases += 1;
    let copied;
    VictoryScene = loadVictoryScene({ navigator: { clipboard: { writeText: async value => { copied = value; } } } });
    scene = new VictoryScene();
    shareLabel = label();
    assert.strictEqual(await scene.shareCompletedAdventure(shareLabel), 'copied');
    assert.strictEqual(copied, expectedUrl);
    assert.strictEqual(shareLabel.text, 'LINK COPIED ✓');

    cases += 1;
    VictoryScene = loadVictoryScene({ navigator: { share: async () => { const error = new Error('cancelled'); error.name = 'AbortError'; throw error; } } });
    scene = new VictoryScene();
    shareLabel = label();
    assert.strictEqual(await scene.shareCompletedAdventure(shareLabel), 'cancelled');
    assert.strictEqual(shareLabel.text, 'SHARE THE GAME');

    cases += 1;
    VictoryScene = loadVictoryScene({ navigator: {} });
    scene = new VictoryScene();
    shareLabel = label();
    assert.strictEqual(await scene.shareCompletedAdventure(shareLabel), 'shown');
    assert.strictEqual(shareLabel.text, 'MYTHICALVOID.COM');

    cases += 1;
    VictoryScene = loadVictoryScene({ navigator: { share: async () => { throw new Error('unavailable'); } } });
    scene = new VictoryScene();
    shareLabel = label();
    assert.strictEqual(await scene.shareCompletedAdventure(shareLabel), 'shown');
    assert.strictEqual(shareLabel.text, 'MYTHICALVOID.COM');

    assert.strictEqual(cases, 5);
    console.log('Completion sharing loop checks passed (5 scenarios).');
}

run().catch(error => {
    console.error(error);
    process.exit(1);
});
