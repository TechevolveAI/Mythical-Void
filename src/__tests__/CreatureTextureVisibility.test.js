const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');
const { loadModule } = require('../test-support/endingRigFixture.cjs');

const source = fs.readFileSync(path.join(__dirname, '../systems/GraphicsEngine.js'), 'utf8');
const executable = parse(source, { sourceType: 'module' }).program.body
    .filter(node => node.type !== 'ImportDeclaration').map(node => source.slice(node.start, node.end)).join('\n');
const appearance = loadModule('../systems/BreedingAppearance.js', 'resolveBreedingAppearance, drawBreedingAppendages');
const contact = loadModule('../systems/CreatureContactGeometry.js', 'measureDrawnBodyContact');
const fixtures = require('../../public/press/gameplay/real-creature-showcase/source-profiles.json').profiles;
const evolution = require('../config/evolution.json');

function engineWithTextures() {
    const textures = new Map();
    const window = { CreatureLifecycle: { getStageVisualConfig: stage => evolution.stages[stage].visual } };
    vm.runInNewContext(executable, { ...appearance, ...contact, window, console: { log() {}, warn() {}, error() {} } });
    const scene = { textures: { exists: key => textures.has(key), get: key => textures.get(key) } };
    return { engine: new window.GraphicsEngine(scene), textures };
}

describe('baked creature visibility', () => {
    test('redraw replaces contact metadata or clears stale contact without erasing other texture metadata', () => {
        const { engine, textures } = engineWithTextures();
        const texture = { customData: { other: 'retained', creatureBodyContact: { old: true } } };
        textures.set('existing', texture);
        const graphics = () => ({ generateTexture: jest.fn(), destroy: jest.fn() });
        const contact = { version: 1, bounds: { contactY: 25 } };
        engine.finalizeTexture(graphics(), 'existing', 80, 90, contact);
        expect(texture.customData).toEqual({ other: 'retained', creatureBodyContact: contact });
        engine.finalizeTexture(graphics(), 'existing', 80, 90, null);
        expect(texture.customData).toEqual({ other: 'retained' });
    });

    test('a legacy Fusion profile in the DNA slot uses the same renderer after a texture rebuild', () => {
        const { engine } = engineWithTextures();
        const genes = { id: 'synthetic-fused-child', traits: { colorGenome: {}, bodyShape: {}, features: {},
            breedingVisuals: { eyeColor: 0x123456 } } };
        const before = JSON.stringify(genes), expected = { textureName: 'same-fusion-identity' };
        engine.createRandomizedSpaceMythicCreature = jest.fn(() => expected);
        engine.createScratchGraphics = jest.fn(() => { throw Error('wrong anatomy renderer'); });
        expect(engine.createCreatureFromDNA(genes, 2, 'juvenile', genes)).toBe(expected);
        expect(engine.createRandomizedSpaceMythicCreature).toHaveBeenCalledWith(genes, 2, 'juvenile');
        expect(engine.createScratchGraphics).not.toHaveBeenCalled();
        expect(JSON.stringify(genes)).toBe(before);
    });

    test('both aura helpers explicitly set translucent Canvas-supported fills', () => {
        const { engine } = engineWithTextures();
        let fill;
        const paints = [];
        const graphics = {
            fillStyle: (color, alpha) => { fill = { color, alpha }; },
            fillCircle: () => paints.push(fill),
            fillEllipse: () => paints.push(fill),
            fillGradientStyle: jest.fn()
        };
        graphics.fillStyle(0xff0000, 1);
        engine.addCosmicAura(graphics, { x: 50, y: 50 }, { intensity: 0.08 });
        engine.addAuroraAura(graphics, { x: 50, y: 50 }, [0x123456, 0xabcdef]);
        expect(graphics.fillGradientStyle).not.toHaveBeenCalled();
        expect(paints).toHaveLength(4);
        for (const paint of paints) {
            expect(paint.alpha).toBeGreaterThan(0);
            expect(paint.alpha).toBeLessThanOrEqual(0.1);
            expect(paint.color).not.toBe(0xff0000);
        }
    });

    test.each(['blob', 'quadruped', 'biped', 'serpentine', 'winged'])(
        '%s margins keep one centre and contain elder aura without shrinking anatomy', body => {
            const { engine } = engineWithTextures();
            const metrics = engine.getDNACanvasMetrics(body, 1.1);
            expect(metrics.baseCenter.x + metrics.padding.x).toBe(metrics.width / 2);
            expect(metrics.baseCenter.y + metrics.padding.y).toBe(metrics.height / 2);
            const auraRadius = metrics.size.width * 1.1 * 1.3;
            expect(metrics.width / 2).toBeGreaterThan(auraRadius);
            expect(metrics.height / 2).toBeGreaterThan(auraRadius);
        }
    );

    test('rebuilding a canvas clears it in place before painting, without destroying live references', () => {
        const { engine, textures } = engineWithTextures();
        const order = [];
        const texture = { setSize: (w, h) => order.push(['resize', w, h]), clear: () => order.push('clear') };
        textures.set('existing', texture);
        const graphics = { generateTexture: () => order.push('paint'), destroy: () => order.push('dispose') };
        expect(engine.finalizeTexture(graphics, 'existing', 240, 270)).toBe('existing');
        expect(order).toEqual([['resize', 240, 270], 'clear', 'paint', 'dispose']);
        expect(textures.get('existing')).toBe(texture);
    });

    test('DNA render separates atmosphere, keeps typed geometry, reuses identical pixels and never mutates identity', () => {
        const { engine, textures } = engineWithTextures();
        const p = JSON.parse(JSON.stringify(fixtures.find(profile => profile.id === 'MV-0153')));
        const before = JSON.stringify(p);
        const order = [];
        const graphics = { destroy: jest.fn() };
        engine.createScratchGraphics = jest.fn(() => graphics);
        engine.createRandomizedSpaceMythicCreature = jest.fn(() => { throw Error('ordinary DNA must keep its anatomy'); });
        engine.adjustColorSaturation = color => color;
        const methods = ['addElementalAuraToGraphics', 'addRarityEnhancements', 'addStageAura',
            'addRarityAura', 'addCosmicAffinityEffects', 'renderBodyArchetype', 'renderHeadArchetype',
            'addSpeciesIdentityFeatures', 'addStageEffects', 'addEnhancedMarkings', 'addRarityEffects',
            'addPersonalityEffects', 'renderWackyMutations', 'applyShinyEffects'];
        for (const method of methods) engine[method] = jest.fn((...args) => order.push({ method, args }));
        engine.finalizeTexture = jest.fn((g, name) => { textures.set(name, { customData: {} }); return name; });
        const first = engine.createCreatureFromDNA(p.dna, 0, 'adult', p.genes);
        const bodyIndex = order.findIndex(call => call.method === 'renderBodyArchetype');
        for (const name of ['addElementalAuraToGraphics', 'addStageAura', 'addRarityAura', 'addCosmicAffinityEffects']) {
            const index = order.findIndex(call => call.method === name);
            expect(index).toBeGreaterThanOrEqual(0);
            expect(index).toBeLessThan(bodyIndex);
        }
        const auraSize = engine.addElementalAuraToGraphics.mock.calls[0][2];
        expect(auraSize).toEqual({ width: 50, height: 80 });
        const affinityCenter = engine.addCosmicAffinityEffects.mock.calls[0][2];
        expect(Number.isFinite(affinityCenter.x)).toBe(true);
        expect(Number.isFinite(affinityCenter.y)).toBe(true);
        const repeat = engine.createCreatureFromDNA(p.dna, 0, 'adult', p.genes);
        expect(repeat.textureName).toBe(first.textureName);
        expect(repeat.metadata.cached).toBe(true);
        expect(engine.finalizeTexture).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(p)).toBe(before);
        engine.createCreatureFromDNA(p.dna, 0, 'elder', p.genes);
        expect(engine.finalizeTexture).toHaveBeenCalledTimes(2);
        const changedGenes = JSON.parse(JSON.stringify(p.genes));
        changedGenes.traits.colorGenome.primary = 0x123456;
        engine.createCreatureFromDNA(p.dna, 0, 'adult', changedGenes);
        expect(engine.finalizeTexture).toHaveBeenCalledTimes(3);
        expect(JSON.stringify(p)).toBe(before);
        expect(engine.createRandomizedSpaceMythicCreature).not.toHaveBeenCalled();
    });

    test('stage-aware anatomy receives inherited proportions and one tail without generic duplicate horns or buds', () => {
        const { engine } = engineWithTextures();
        for (const name of ['renderBodyByType', 'renderHead', 'renderHornNubs', 'renderTailBud', 'renderHorns']) engine[name] = jest.fn();
        const input = { breedingAppearance: { scaleX: 1.2, scaleY: 0.9, tailLength: 1, horns: { type: 'none', size: 0 } },
            eyes: { color: 0 }, resolvedBodyType: 'quadruped' };
        const before = JSON.stringify(input);
        engine.renderStageAwareCreatureBody({}, { x: 50, y: 50 }, { width: 50, height: 65 },
            { body: 0x123456, head: 0x234567 }, 0, input, { scale: 0.8 },
            { features: { showFeatureBuds: true, horns: { type: 'full' }, tail: {} } });
        const call = engine.renderBodyByType.mock.calls[0];
        expect(call[3].x).toBeCloseTo(0.96);
        expect(call[3].y).toBeCloseTo(0.72);
        expect(call[3].inheritedTailScale).toBeCloseTo(1 / 0.7);
        expect(call[5]).toBe('quadruped');
        expect(engine.renderHead.mock.calls[0][4]).toEqual({ color: 0 });
        expect(engine.renderHornNubs).not.toHaveBeenCalled();
        expect(engine.renderTailBud).not.toHaveBeenCalled();
        expect(engine.renderHorns).not.toHaveBeenCalled();
        expect(JSON.stringify(input)).toBe(before);
    });

    test('the actual head renderer preserves inherited black eyes instead of substituting purple', () => {
        const { engine } = engineWithTextures();
        engine.renderMoodEyes = jest.fn();
        engine.renderMoodExtras = jest.fn();
        engine.lightenColor = colour => colour;
        const graphics = { fillStyle: jest.fn(), fillCircle: jest.fn() };
        engine.renderHead(graphics, { x: 50, y: 50 }, 1, 0x123456, { color: 0 });
        expect(engine.renderMoodEyes.mock.calls[0][5]).toBe(0);
    });
});
