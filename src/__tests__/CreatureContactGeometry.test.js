const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGeometry() {
    const filePath = path.join(__dirname, '../systems/CreatureContactGeometry.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/export function /g, 'function ')
        .concat('\nmodule.exports = { findVisibleContactBounds, resolveTextureContactGeometry };');
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
    resolveTextureContactGeometry
} = loadGeometry();

function alphaCanvas(width, height, points) {
    const data = new Uint8ClampedArray(width * height * 4);
    points.forEach(({ x, y, alpha = 255 }) => {
        data[(y * width + x) * 4 + 3] = alpha;
    });
    return data;
}

describe('CreatureContactGeometry', () => {
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
