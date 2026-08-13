const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadTraversalTopology() {
    const filePath = path.join(__dirname, '../systems/TraversalTopology.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(
            /export \{[\s\S]*?\};/,
            'module.exports = { analyzeTraversalTopology, calculateBallisticLaunchVelocity, calculateJumpEnvelope, canTraverseSupport };'
        );
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Number,
        Math,
        Set,
        Array,
        Object
    };

    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function support(id, left, right, top, { enabled = true } = {}) {
    return {
        traversalId: id,
        body: {
            enable: enabled,
            left,
            right,
            top,
            bottom: top + 30,
            width: right - left,
            height: 30,
            center: {
                x: (left + right) / 2,
                y: top + 15
            }
        }
    };
}

describe('campaign traversal topology', () => {
    const {
        analyzeTraversalTopology,
        calculateBallisticLaunchVelocity,
        calculateJumpEnvelope,
        canTraverseSupport
    } = loadTraversalTopology();
    const movement = {
        gravityY: 500,
        jumpVelocity: -450,
        playerSpeed: 200
    };

    test('derives a conservative movement envelope from authored physics', () => {
        const envelope = calculateJumpEnvelope(movement);

        expect(envelope.maxRise).toBeGreaterThan(190);
        expect(envelope.maxRise).toBeLessThan(195);
        expect(envelope.horizontalEfficiency).toBeLessThan(1);
    });

    test('derives reusable lift velocity from authored gravity and rise', () => {
        expect(calculateBallisticLaunchVelocity({
            gravityY: 500,
            rise: 500
        })).toBe(-748);
        expect(calculateBallisticLaunchVelocity({
            gravityY: -500,
            rise: -10,
            minimumSpeed: 320
        })).toBe(-320);
    });

    test('accepts readable forward steps and rejects impossible rises', () => {
        const envelope = calculateJumpEnvelope(movement);
        const start = { left: 0, right: 220, top: 700 };
        const step = { left: 330, right: 520, top: 610 };
        const impossible = { left: 330, right: 520, top: 480 };

        expect(canTraverseSupport(start, step, envelope)).toBe(true);
        expect(canTraverseSupport(start, impossible, envelope)).toBe(false);
    });

    test('rejects an ascending jump through a thin solid platform', () => {
        const envelope = calculateJumpEnvelope(movement);
        const start = { left: 0, right: 250, top: 700, bottom: 730, width: 250 };
        const finish = { left: 0, right: 250, top: 540, bottom: 570, width: 250 };
        const ceiling = {
            left: -80,
            right: 330,
            top: 600,
            bottom: 620,
            width: 410,
            height: 20,
            type: 'solid'
        };

        expect(canTraverseSupport(start, finish, envelope, {
            obstacles: [start, finish, ceiling],
            playerHalfWidth: 18,
            playerHeight: 58
        })).toBe(false);
    });

    test('allows the same ascending jump through an explicit one-way platform', () => {
        const envelope = calculateJumpEnvelope(movement);
        const start = { left: 0, right: 250, top: 700, bottom: 730, width: 250 };
        const finish = { left: 0, right: 250, top: 540, bottom: 570, width: 250 };
        const oneWay = {
            left: -80,
            right: 330,
            top: 600,
            bottom: 620,
            width: 410,
            height: 20,
            type: 'one-way'
        };

        expect(canTraverseSupport(start, finish, envelope, {
            obstacles: [start, finish, oneWay],
            playerHalfWidth: 18,
            playerHeight: 58
        })).toBe(true);
    });

    test('can require an objective to be activated from an authored support', () => {
        const supports = [
            support('start', 0, 220, 700),
            support('main-nearby', 280, 500, 700),
            {
                ...support('optional-exit', 540, 760, 700),
                traversalLinks: ['finish']
            },
            support('finish', 820, 1040, 700)
        ];
        const result = analyzeTraversalTopology({
            supports,
            spawn: { x: 100, y: 650 },
            movement,
            targets: [{
                id: 'optional-objective',
                x: 480,
                y: 650,
                optional: true,
                activationSupportIds: ['optional-exit']
            }, {
                id: 'finish-objective',
                x: 930,
                y: 650
            }]
        });

        expect(result.targets[0].reachable).toBe(true);
        expect(result.targets[0].pathSupportIds.at(-1)).toBe('optional-exit');
        expect(result.flow.strandingSupportCount).toBe(0);
    });

    test('uses authored acceleration and available run-up in horizontal reach', () => {
        const responsive = calculateJumpEnvelope({
            ...movement,
            playerAcceleration: 0.35
        });
        const sticky = calculateJumpEnvelope({
            ...movement,
            playerAcceleration: 0.05
        });
        const narrowStart = { left: 0, right: 70, top: 700, width: 70 };
        const finish = { left: 350, right: 585, top: 700, width: 235 };

        expect(canTraverseSupport(narrowStart, finish, responsive)).toBe(true);
        expect(canTraverseSupport(narrowStart, finish, sticky)).toBe(false);
    });

    test('proves every ordered target is connected from the real spawn', () => {
        const result = analyzeTraversalTopology({
            movement,
            spawn: { x: 80, y: 650 },
            supports: [
                support('start', 0, 240, 700),
                support('step-one', 315, 520, 620),
                support('step-two', 590, 800, 540),
                support('finish', 850, 1160, 700)
            ],
            targets: [
                {
                    id: 'signal-1',
                    label: { text: 'FIRST SIGNAL' },
                    x: 430,
                    y: 590,
                    width: 140,
                    height: 190
                },
                { id: 'signal-2', x: 980, y: 610, width: 140, height: 190 }
            ]
        });

        expect(result.passed).toBe(true);
        expect(result.coverage).toBe(1);
        expect(result.unreachableTargets).toEqual([]);
        expect(result.targets[0].label).toBe('FIRST SIGNAL');
        expect(result.flow.strandingSupportCount).toBe(0);
    });

    test('rejects a reachable platform that cannot recover to the final objective', () => {
        const result = analyzeTraversalTopology({
            movement,
            spawn: { x: 80, y: 650 },
            supports: [
                support('start', 0, 320, 700),
                support('finish', 390, 760, 700),
                support('deep-side-route', 800, 1040, 1000)
            ],
            targets: [
                { id: 'guardian-gate', x: 620, y: 610, width: 140, height: 190 }
            ]
        });

        expect(result.unreachableTargets).toEqual([]);
        expect(result.flow.strandingSupportIds).toEqual(['deep-side-route']);
        expect(result.flow.strandingSupportCount).toBe(1);
        expect(result.passed).toBe(false);
        expect(result.reason).toBe('stranded-supports');
    });

    test('models an authored recovery mechanic as a named traversal link', () => {
        const recoveryFloor = support('recovery-floor', 0, 340, 900);
        recoveryFloor.traversalLinks = ['warning-line'];
        const result = analyzeTraversalTopology({
            movement,
            spawn: { x: 80, y: 850 },
            supports: [
                recoveryFloor,
                support('warning-line', 0, 340, 500),
                support('guardian-floor', 410, 820, 700)
            ],
            targets: [
                { id: 'guardian-gate', x: 680, y: 610, width: 140, height: 190 }
            ]
        });

        expect(result.passed).toBe(true);
        expect(result.unreachableTargets).toEqual([]);
        expect(result.flow.strandingSupportCount).toBe(0);
        expect(result.targets[0].pathSupportIds).toEqual([
            'recovery-floor',
            'warning-line',
            'guardian-floor'
        ]);
    });

    test('continues ordered flow from the reached support instead of every nearby support', () => {
        const result = analyzeTraversalTopology({
            movement,
            spawn: { x: 80, y: 650 },
            supports: [
                support('start', 0, 320, 700),
                support('signal-floor', 390, 700, 700),
                support('near-signal-shortcut', 760, 900, 570),
                support('finish', 970, 1260, 700)
            ],
            targets: [
                { id: 'signal', x: 560, y: 610, width: 260, height: 190 },
                { id: 'guardian', x: 1120, y: 610, width: 140, height: 190 }
            ]
        });

        expect(result.passed).toBe(true);
        expect(result.targets[0].pathSupportIds).toEqual(['start']);
        expect(result.targets[1].pathSupportIds[0]).toBe('start');
    });

    test('audits an optional branch without making it part of required ordered flow', () => {
        const result = analyzeTraversalTopology({
            movement,
            spawn: { x: 80, y: 650 },
            supports: [
                support('start', 0, 320, 700),
                support('signal-floor', 390, 700, 700),
                support('optional-high-route', 390, 700, 520),
                support('finish', 820, 1180, 700)
            ],
            targets: [
                { id: 'signal', x: 550, y: 610, width: 80, height: 190 },
                {
                    id: 'optional-reward',
                    x: 550,
                    y: 430,
                    width: 100,
                    height: 150,
                    optional: true
                },
                { id: 'guardian', x: 1050, y: 610, width: 100, height: 190 }
            ]
        });

        expect(result.passed).toBe(true);
        expect(result.targets[1]).toEqual(expect.objectContaining({
            optional: true,
            reachable: true
        }));
        expect(result.targets[2].pathSupportIds).toEqual([
            'signal-floor',
            'finish'
        ]);
        expect(result.flow.requiredJumpCount).toBe(2);
        expect(result.flow.targets[1]).toEqual(expect.objectContaining({
            id: 'optional-reward',
            optional: true,
            reachable: false
        }));
    });

    test('reports an isolated required objective even when most ground is usable', () => {
        const result = analyzeTraversalTopology({
            movement,
            spawn: { x: 80, y: 650 },
            supports: [
                support('start', 0, 320, 700),
                support('path', 390, 760, 650),
                support('isolated-objective', 1200, 1420, 380)
            ],
            targets: [
                { id: 'guardian-gate', x: 1300, y: 320, width: 140, height: 180 }
            ]
        });

        expect(result.passed).toBe(false);
        expect(result.reason).toBe('unreachable-targets');
        expect(result.unreachableTargets).toEqual(['guardian-gate']);
    });

    test('keeps decorative side geometry informational when the route is sound', () => {
        const result = analyzeTraversalTopology({
            movement,
            spawn: { x: 80, y: 650 },
            supports: [
                support('start', 0, 320, 700),
                support('route', 390, 760, 650),
                support('finish', 820, 1160, 700),
                support('optional-crown', 1400, 1500, 300)
            ],
            targets: [
                { id: 'finish', x: 980, y: 610, width: 140, height: 190 }
            ]
        });

        expect(result.passed).toBe(true);
        expect(result.coverage).toBe(0.75);
        expect(result.unreachableSupportIds).toEqual(['optional-crown']);
    });

    test('validates targets in authored order after an irreversible drop', () => {
        const result = analyzeTraversalTopology({
            movement,
            spawn: { x: 100, y: 340 },
            supports: [
                support('high-start', 0, 340, 400),
                support('low-finish', 420, 850, 700)
            ],
            targets: [
                { id: 'lower-signal', x: 650, y: 610, width: 140, height: 190 },
                { id: 'return-high', x: 150, y: 330, width: 140, height: 190 }
            ]
        });

        expect(result.passed).toBe(false);
        expect(result.targets[0].reachable).toBe(true);
        expect(result.targets[1].reachable).toBe(false);
        expect(result.unreachableTargets).toEqual(['return-high']);
    });

    test('reindexes filtered Phaser bodies so disabled supports cannot corrupt the graph', () => {
        const result = analyzeTraversalTopology({
            movement,
            spawn: { x: 80, y: 650 },
            supports: [
                support('disabled', 0, 50, 100, { enabled: false }),
                support('start', 0, 320, 700),
                support('finish', 385, 760, 650)
            ],
            targets: [
                { id: 'finish', x: 650, y: 610, width: 120, height: 170 }
            ]
        });

        expect(result.passed).toBe(true);
        expect(result.spawnSupportId).toBe('start');
        expect(result.reachableSupportCount).toBe(2);
    });

    test('does not rely on collapsing platforms for required progression', () => {
        const result = analyzeTraversalTopology({
            movement,
            spawn: { x: 80, y: 650 },
            supports: [
                support('start', 0, 300, 700),
                {
                    ...support('collapse', 360, 590, 610),
                    platformType: 'collapsing'
                },
                support('finish', 680, 960, 520)
            ],
            targets: [
                { id: 'finish', x: 820, y: 460, width: 140, height: 180 }
            ]
        });

        expect(result.passed).toBe(false);
        expect(result.transientSupportIds).toEqual(['collapse']);
    });
});
