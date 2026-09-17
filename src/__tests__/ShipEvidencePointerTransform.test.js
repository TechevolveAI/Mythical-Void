const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse } = require('@babel/parser');

const source = fs.readFileSync(path.join(__dirname, '../ui/ShipEvidenceBoardModal.js'), 'utf8');
const ast = parse(source, { sourceType: 'module' });
const declaration = ast.program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
const method = declaration.body.body.find(node => node.key.name === 'activatePointerRegion');
const activatePointerRegion = vm.runInNewContext(`({ ${source.slice(method.start, method.end)} }).activatePointerRegion`);

describe.each([0.62, 0.85, 1, 1.05])('repair action at camera zoom %f', zoom => {
    const origin = { x: 195, y: 360 };
    function setup() {
        const onPress = jest.fn();
        const camera = {
            scrollX: 5000, scrollY: 800,
            getWorldPoint: (x, y) => ({
                x: (x - origin.x) / zoom + origin.x + 5000,
                y: (y - origin.y) / zoom + origin.y + 800
            })
        };
        const modal = {
            scene: { cameras: { main: camera } },
            pointerRegions: [{ left: 25, right: 365, top: 600, bottom: 650, onPress }]
        };
        return { modal, onPress };
    }
    test('the visible button centre activates exactly once', () => {
        const { modal, onPress } = setup();
        const pointer = { x: 195, y: origin.y + (625 - origin.y) * zoom };
        expect(activatePointerRegion.call(modal, pointer)).toBe(true);
        expect(onPress).toHaveBeenCalledTimes(1);
    });
    test('a tap outside the drawn button does not activate it', () => {
        const { modal, onPress } = setup();
        const pointer = { x: origin.x + (375 - origin.x) * zoom, y: origin.y + (625 - origin.y) * zoom };
        expect(activatePointerRegion.call(modal, pointer)).toBe(false);
        expect(onPress).not.toHaveBeenCalled();
    });
});
