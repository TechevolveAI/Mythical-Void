const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('@babel/parser');
const { fixture, attach } = require('./soulNamingFixture.cjs');

function loadLivingFormHandoff() {
    const file = path.join(__dirname, '../../ui/LivingFormHandoff.js');
    const source = fs.readFileSync(file, 'utf8');
    const nodes = parse(source, { sourceType: 'module' }).program.body;
    const body = nodes.filter(node => node.type !== 'ImportDeclaration').map(node =>
        source.slice(node.type === 'ExportDefaultDeclaration' ? node.declaration.start : node.start, node.end)).join('\n');
    const context = { window, document, console, Date, Math, module: { exports: {} },
        shareHatchChallenge: jest.fn(), requestAnimationFrame: callback => callback() };
    vm.runInNewContext(`${body}\nmodule.exports = LivingFormHandoff;`, context, { filename: file });
    return context.module.exports;
}

function livingHandoffFixture({ resume = false, sourceFixture = null, finalize = true } = {}) {
    const f = sourceFixture || fixture();
    if (finalize) f.scene.finalizeName();
    if (resume) f.scene.init({ resumeLivingForm: true });
    const captured = [];
    f.scene.scale = { width: 390, height: 844 };
    f.scene.livingFormHandoff = null;
    f.scene.cameras = { main: { zoom: 1, fadeOut: jest.fn() } };
    f.scene.time = { removeAllEvents: jest.fn(), delayedCall: jest.fn((delay, callback) => {
        const handle = window.setTimeout(callback, delay);
        const timer = { remove: jest.fn(() => window.clearTimeout(handle)) };
        captured.push({ callback, timer, delay }); return timer;
    }) };
    f.scene.tweens = { killAll: jest.fn() };
    f.scene.prepareDomContainerForHandoff = jest.fn();
    f.scene.add.dom = (_x, _y, root) => {
        document.body.append(root);
        return { setOrigin() { return this; }, setDepth() { return this; }, setScrollFactor() { return this; },
            setPosition() { return this; }, setScale() { return this; }, destroy: jest.fn(() => root.remove()) };
    };
    const LivingFormHandoff = loadLivingFormHandoff();
    for (const name of ['captureLivingFormHandoffOwner', 'saveLivingFormProgress', 'canPresentLivingForm',
        'showLivingFormRecovery', 'transitionToGame', 'resumeLivingFormHandoff', 'showLivingPortraitHandoff']) {
        attach(f.scene, name, { LivingFormHandoff });
    }
    const close = f.close;
    f.close = () => {
        f.scene.retireLivingFormHandoff();
        f.scene.livingFormHandoff?.destroy();
        close();
    };
    return { ...f, captured, show() { f.scene.showLivingPortraitHandoff('Fictional Glow'); return f.scene.livingFormHandoff; } };
}

module.exports = { livingHandoffFixture, loadLivingFormHandoff };
