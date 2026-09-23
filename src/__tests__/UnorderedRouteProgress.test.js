const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const source = fs.readFileSync(path.join(__dirname, '../scenes/PlatformerLevelScene.js'), 'utf8');
const cls = parse(source, { sourceType: 'module' }).program.body.find(n => n.type === 'ClassDeclaration');
const method = name => {
    const n = cls.body.body.find(n => n.key?.name === name);
    return new Function(`return ({${source.slice(n.start, n.end)}}).${name}`)();
};
const signals = () => [0, 1, 2].map(index => ({ index, id: `place-${index}`, x: index * 100, y: 0,
    activated: false, label: { setColor: jest.fn(), setAlpha: jest.fn() },
    visual: { setAlpha: jest.fn() }, zone: { destroy: jest.fn() } }));

test.each([[0,1,2], [0,2,1], [1,0,2], [1,2,0], [2,0,1], [2,1,0]])('activation order %j survives each restore without granting unvisited places', (...order) => {
    const live = signals();
    const scene = {};
    for (let count = 0; count < 3; count++) {
        const index = order[count];
        expect(method('canActivateOrderedRouteSignal').call(scene, live[index], live, count)).toBe(true);
        live[index].activated = true;
        const restored = signals();
        const mask = live.reduce((mask, s, i) => mask | (s.activated ? 1 << i : 0), 0);
        expect(method('restoreExpeditionRouteSignals').call(scene, {
            version: 2, checkpointIndex: index, checkpointId: live[index].id, routeSignalMask: mask
        }, { signals: restored, countProperty: 'count', readyProperty: 'ready', drawSignal: jest.fn() })).toBe(true);
        expect(restored.map(s => s.activated)).toEqual(live.map(s => s.activated));
        expect(scene.count).toBe(count + 1);
        expect(scene.ready).toBe(count === 2);
    }
});

test('legacy sequential saves still restore; corrupt explicit masks never award progress', () => {
    const options = { signals: signals(), countProperty: 'count', readyProperty: 'ready', drawSignal: jest.fn() };
    expect(method('restoreExpeditionRouteSignals').call({}, { checkpointIndex: 1, checkpointId: 'place-1' }, options)).toBe(true);
    expect(options.signals.map(s => s.activated)).toEqual([true,true,false]);
    expect(method('restoreExpeditionRouteSignals').call({}, {
        version: 2, checkpointIndex: 1, checkpointId: 'place-1'
    }, { ...options, signals: signals() })).toBe(false);
    for (const mask of [-1, 8, 1, 1.5, null]) {
        expect(method('restoreExpeditionRouteSignals').call({}, {
            checkpointIndex: 1, checkpointId: 'place-1', routeSignalMask: mask
        }, { ...options, signals: signals() })).toBe(false);
    }
});

test('every unfinished objective is equally visible and guidance chooses a nearby unfinished place', () => {
    const s = { orderedRouteSignals: signals(), player: { x: 180, y: 0 }, setOrderedRouteGuidance: jest.fn() };
    method('refreshOrderedRouteSignals').call(s, s.orderedRouteSignals, 0);
    for (const place of s.orderedRouteSignals) {
        expect(place.visual.setAlpha).toHaveBeenCalledWith(1);
        expect(place.label.setColor).toHaveBeenCalledWith('#F2C94C');
    }
    expect(method('getNextOrderedRouteSignal').call(s).index).toBe(2);
    s.orderedRouteSignals[2].activated = true;
    expect(method('getNextOrderedRouteSignal').call(s).index).toBe(1);
});
