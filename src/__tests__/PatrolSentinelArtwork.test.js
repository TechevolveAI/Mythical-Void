/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildSync } = require('esbuild');
const { parse } = require('@babel/parser');

const root = path.join(__dirname, '../..');
const compiled = buildSync({ absWorkingDir: root, entryPoints: ['src/systems/PatrolSentinelArtwork.js'],
    bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent' }).outputFiles[0].text;
const context = { module: { exports: {} } };
vm.runInNewContext(compiled, context);
const { PATROL_SENTINEL_FRAME: frame, drawPatrolSentinelArtwork: draw } = context.module.exports;

function method(file, name) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const body = parse(source, { sourceType: 'module' }).program.body;
    const exported = body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
    const declaration = exported.type === 'ClassDeclaration' ? exported
        : body.find(node => node.type === 'ClassDeclaration' && node.id?.name === exported.name);
    const node = declaration.body.body.find(item => item.key?.name === name);
    return vm.runInNewContext(`({${source.slice(node.start, node.end)}}).${name}`, {
        PATROL_SENTINEL_FRAME: frame, drawPatrolSentinelArtwork: draw
    });
}
function graphics() {
    const shapes = [];
    let lineWidth = 0;
    const g = {
        shapes, generateTexture: jest.fn(), destroy: jest.fn(),
        fillStyle: jest.fn(() => g),
        lineStyle(width) { lineWidth = width; return g; },
        fillRoundedRect(x, y, width, height) { shapes.push({ left: x, top: y, right: x + width, bottom: y + height }); return g; },
        strokeRoundedRect(x, y, width, height) {
            shapes.push({ left: x - lineWidth / 2, top: y - lineWidth / 2,
                right: x + width + lineWidth / 2, bottom: y + height + lineWidth / 2 }); return g;
        },
        fillEllipse(x, y, width, height) { shapes.push({ left: x - width / 2, top: y - height / 2,
            right: x + width / 2, bottom: y + height / 2 }); return g; },
        strokeEllipse(x, y, width, height) { shapes.push({ left: x - width / 2 - lineWidth / 2,
            top: y - height / 2 - lineWidth / 2, right: x + width / 2 + lineWidth / 2,
            bottom: y + height / 2 + lineWidth / 2 }); return g; },
        lineBetween(x1, y1, x2, y2) {
            shapes.push({ left: Math.min(x1, x2) - lineWidth / 2, top: Math.min(y1, y2) - lineWidth / 2,
                right: Math.max(x1, x2) + lineWidth / 2, bottom: Math.max(y1, y2) + lineWidth / 2 }); return g;
        },
        fillTriangle() { throw Error('Stompable sentinel must not have a pointed crown'); }
    };
    return g;
}

describe('shared stompable patrol silhouette', () => {
    test('keeps the existing centred physics dimensions and meets the ground at its feet', () => {
        expect(frame.bodyWidth).toBe(44); expect(frame.bodyHeight).toBe(52);
        expect(frame.bodyLeft).toBe((frame.width - frame.bodyWidth) / 2);
        expect(frame.bodyTop).toBe((frame.height - frame.bodyHeight) / 2);
        expect(frame.landingCap.y).toBe(frame.bodyTop);
        for (const foot of frame.feet) expect(foot.y + foot.height).toBe(frame.bodyTop + frame.bodyHeight);
    });
    test.each([
        [0x275B68, 0x9400D3, 0xFFFFFF], [0x8B3658, 0x9400D3, 0xFFFFFF], [0x4B0082, 0x9400D3, 0xFFFFFF],
        [0x173D49, 0x7FFFD4, 0xF2C94C], [0x260B38, 0xDA70D6, 0xA9F3E4]
    ])('draws body %s with a soft gold landing surface inside its existing collision frame', (bodyColor, accentColor, eyeColor) => {
        const g = graphics();
        expect(draw(g, { bodyColor, accentColor, eyeColor })).toBe(frame);
        expect(g.fillStyle).toHaveBeenCalledWith(bodyColor, 1);
        expect(g.fillStyle).toHaveBeenCalledWith(0xF2C94C, 1);
        for (const shape of g.shapes) {
            expect(shape.left).toBeGreaterThanOrEqual(frame.bodyLeft);
            expect(shape.top).toBeGreaterThanOrEqual(frame.bodyTop);
            expect(shape.right).toBeLessThanOrEqual(frame.bodyLeft + frame.bodyWidth);
            expect(shape.bottom).toBeLessThanOrEqual(frame.bodyTop + frame.bodyHeight);
        }
    });
    test('shared scene bakes the current drawing once with the established texture size', () => {
        const create = method('src/scenes/PlatformerLevelScene.js', 'createPatrolSentinelTexture');
        const g = graphics(), exists = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
        const scene = { textures: { exists }, make: { graphics: jest.fn(() => g) } };
        const palette = { bodyColor: 0x275B68, accentColor: 0x9400D3, eyeColor: 0xFFFFFF };
        create.call(scene, 'fixture-sentinel', palette);
        create.call(scene, 'fixture-sentinel', palette);
        expect(g.generateTexture).toHaveBeenCalledTimes(1);
        expect(g.generateTexture).toHaveBeenCalledWith('fixture-sentinel', 64, 70);
        expect(g.destroy).toHaveBeenCalledTimes(1);
        expect(scene.make.graphics).toHaveBeenCalledTimes(1);
    });
    test('Void Peaks delegates to the same artwork while preserving its regional palette', () => {
        const create = method('src/scenes/levels/VoidPeaksLevel.js', 'createSentinelTexture');
        const scene = { createPatrolSentinelTexture: jest.fn() };
        create.call(scene, 'peak-fixture', 0x4B0082);
        expect(scene.createPatrolSentinelTexture).toHaveBeenCalledWith('peak-fixture', {
            bodyColor: 0x4B0082, accentColor: 0x9400D3, eyeColor: 0xFFFFFF
        });
    });
});
