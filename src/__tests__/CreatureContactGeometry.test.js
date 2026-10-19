const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGeometry() {
    const filePath = path.join(__dirname, '../systems/CreatureContactGeometry.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/export function /g, 'function ')
        .concat('\nmodule.exports = { findVisibleContactBounds, resolveTextureContactGeometry, measureDrawnBodyContact };');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        Uint32Array,
        document: undefined
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

const {
    findVisibleContactBounds,
    resolveTextureContactGeometry,
    measureDrawnBodyContact
} = loadGeometry();

function alphaCanvas(width, height, points) {
    const data = new Uint8ClampedArray(width * height * 4);
    points.forEach(({ x, y, alpha = 255 }) => {
        data[(y * width + x) * 4 + 3] = alpha;
    });
    return data;
}

describe('CreatureContactGeometry', () => {
    function measuredFixture() {
        const data = alphaCanvas(12, 10, Array.from({ length: 20 }, (_, index) => ({
            x: 3 + index % 5, y: 2 + Math.floor(index / 5)
        })));
        const context = { getImageData: jest.fn(() => ({ data })) };
        const canvas = { getContext: jest.fn(() => context) };
        const original = [11, 22, 33];
        const graphics = { commandBuffer: original, scene: { sys: { game: { canvas: { ownerDocument: {
            createElement: jest.fn(() => canvas)
        } } } } }, generateTexture: jest.fn(() => {
            expect(graphics.commandBuffer).toEqual([1, 2, 3, 4]);
        }) };
        const request = { prefix: [1], body: [2, 3], suffix: [4], width: 12, height: 10 };
        return { graphics, request, original, canvas, context };
    }

    test('measures existing body commands without changing the visible command buffer', () => {
        const { graphics, request, original, canvas } = measuredFixture();
        expect(measureDrawnBodyContact(graphics, request)).toMatchObject({ version: 1,
            textureWidth: 12, textureHeight: 10, bounds: { contactY: 6, centerX: 5.5 } });
        expect(graphics.generateTexture).toHaveBeenCalledWith(canvas, 12, 10);
        expect(graphics.commandBuffer).toBe(original);
        expect(original).toEqual([11, 22, 33]);
    });

    test('the body metadata is used without reading decorative pixels and cannot be changed through its result', () => {
        const { graphics, request } = measuredFixture();
        const measured = measureDrawnBodyContact(graphics, request);
        const source = { width: 12, height: 10, getContext: jest.fn(() => { throw Error('decorative pixels must not be scanned'); }) };
        const texture = { getSourceImage: () => source, customData: { creatureBodyContact: measured } };
        const textureManager = { get: () => texture };
        const result = resolveTextureContactGeometry(textureManager, 'synthetic');
        expect(result.contactY).toBe(6);
        result.contactY = 999;
        expect(resolveTextureContactGeometry(textureManager, 'synthetic').contactY).toBe(6);
        expect(source.getContext).not.toHaveBeenCalled();
    });

    test.each([false, true])('temporary measurement retires only its own shared-camera reference, failure %s', fail => {
        const { graphics, request, original } = measuredFixture();
        const retained = { name: 'earlier-render' }, renderList = [retained];
        graphics.constructor = { TargetCamera: { renderList } };
        graphics.generateTexture.mockImplementation(() => {
            renderList.push(graphics);
            if (fail) throw Error('synthetic drawing interruption');
        });
        const result = measureDrawnBodyContact(graphics, request);
        expect(result === null).toBe(fail);
        expect(renderList).toEqual([retained]);
        expect(graphics.commandBuffer).toBe(original);
    });

    test.each(['unsupported-canvas', 'draw-failure', 'read-failure', 'empty-body', 'zero-size'])(
        '%s restores commands and falls back without changing visible artwork', fault => {
            const { graphics, request, original, context } = measuredFixture();
            if (fault === 'unsupported-canvas') graphics.scene.sys.game.canvas = null;
            if (fault === 'draw-failure') graphics.generateTexture.mockImplementation(() => { throw Error('synthetic draw failure'); });
            if (fault === 'read-failure') context.getImageData.mockImplementation(() => { throw Error('synthetic read failure'); });
            if (fault === 'empty-body') request.body = [];
            if (fault === 'zero-size') request.width = 0;
            expect(measureDrawnBodyContact(graphics, request)).toBeNull();
            expect(graphics.commandBuffer).toBe(original);
        }
    );

    test.each(['unknown-version', 'stale-dimensions', 'out-of-bounds', 'inconsistent-contact', 'custom-options'])(
        '%s uses the established scan instead of stale body metadata', fault => {
            const { graphics, request } = measuredFixture();
            const measured = measureDrawnBodyContact(graphics, request);
            if (fault === 'unknown-version') measured.version = 2;
            if (fault === 'stale-dimensions') measured.textureWidth = 13;
            if (fault === 'out-of-bounds') measured.bounds.right = 99;
            if (fault === 'inconsistent-contact') measured.bounds.contactY = 9;
            const data = alphaCanvas(12, 10, Array.from({ length: 20 }, (_, index) => ({ x: 3 + index % 5, y: 4 + Math.floor(index / 5) })));
            const context = { getImageData: jest.fn(() => ({ data })) };
            const source = { width: 12, height: 10, getContext: () => context };
            const textureManager = { get: () => ({ getSourceImage: () => source, customData: { creatureBodyContact: measured } }) };
            expect(resolveTextureContactGeometry(textureManager, 'synthetic', fault === 'custom-options' ? { alphaThreshold: 200 } : {}))
                .toMatchObject({ contactY: 8 });
            expect(context.getImageData).toHaveBeenCalledTimes(1);
        }
    );

    test('uses substantial visible rows as the contact edge and ignores sparkles', () => {
        const body = [];
        for (let y = 3; y <= 8; y++) {
            for (let x = 4; x <= 10; x++) body.push({ x, y });
        }
        const data = alphaCanvas(16, 14, [
            { x: 1, y: 0 },
            ...body,
            { x: 14, y: 12 }
        ]);

        expect(findVisibleContactBounds({ data, width: 16, height: 14 })).toEqual({
            left: 4,
            right: 10,
            top: 3,
            bottom: 8,
            width: 7,
            height: 6,
            contactY: 9,
            centerX: 7.5,
            requiredRowPixels: 4
        });
    });

    test('rejects empty and malformed texture data', () => {
        expect(findVisibleContactBounds()).toBeNull();
        expect(findVisibleContactBounds({
            data: new Uint8ClampedArray(3),
            width: 10,
            height: 10
        })).toBeNull();
    });

    test('reads the same contact geometry through the Phaser texture boundary', () => {
        const data = alphaCanvas(12, 10, Array.from({ length: 20 }, (_, index) => ({
            x: 3 + index % 5,
            y: 4 + Math.floor(index / 5)
        })));
        const context = { getImageData: jest.fn(() => ({ data })) };
        const source = {
            width: 12,
            height: 10,
            getContext: jest.fn(() => context)
        };
        const textureManager = {
            get: jest.fn(() => ({ getSourceImage: () => source }))
        };

        expect(resolveTextureContactGeometry(textureManager, 'creature')).toMatchObject({
            top: 4,
            bottom: 7,
            contactY: 8,
            centerX: 5.5
        });
    });
});
