const fs = require('fs');
const path = require('path');
const vm = require('vm');

const gameSource = fs.readFileSync(
    path.join(__dirname, '../game.js'),
    'utf8'
);
const hatchingSource = fs.readFileSync(
    path.join(__dirname, '../scenes/HatchingScene.js'),
    'utf8'
);
const sceneSource = fs.readFileSync(
    path.join(__dirname, '../scenes/GameScene.js'),
    'utf8'
);

function loadCheckInModule() {
    const filePath = path.join(
        __dirname,
        '../systems/SanctuaryCheckIn.js'
    );
    const source = fs.readFileSync(filePath, 'utf8')
        .replace('export function getSanctuaryCheckInCopy', 'function getSanctuaryCheckInCopy')
        .replace('export function getSanctuaryReturnSummary', 'function getSanctuaryReturnSummary')
        .replace(
            'export { CHECK_IN_LINES };',
            'module.exports = { CHECK_IN_LINES, getSanctuaryCheckInCopy, getSanctuaryReturnSummary };'
        );
    const sandbox = { module: { exports: {} }, exports: {} };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

const {
    CHECK_IN_LINES,
    getSanctuaryCheckInCopy,
    getSanctuaryReturnSummary
} = loadCheckInModule();

describe('Sanctuary return-session tone', () => {
    test.each([
        ['curious', 8, 'MORNING CYCLE'],
        ['playful', 13, 'MIDDAY CYCLE'],
        ['gentle', 20, 'EVENING CYCLE'],
        ['wise', 23, 'EVENING CYCLE'],
        ['energetic', 0, 'MORNING CYCLE']
    ])('authors a grounded %s check-in', (personalityCore, hour, cycleLabel) => {
        const copy = getSanctuaryCheckInCopy({
            name: 'Nova',
            personalityCore,
            hour
        });

        expect(copy.title).toBe('SANCTUARY CHECK-IN');
        expect(copy.cycleLabel).toBe(cycleLabel);
        expect(copy.statusLine).toContain('BOND LINK RESTORED');
        expect(copy.line).toContain('Nova');
        expect(copy.line).not.toMatch(/happy wiggle|bounces excitedly|chirps with joy/i);
    });

    test('keeps multiple authored observations per personality', () => {
        Object.values(CHECK_IN_LINES).forEach(lines => {
            expect(lines).toHaveLength(3);
            expect(new Set(lines).size).toBe(lines.length);
        });
    });

    test('sanitizes the companion name and falls back to a supported voice', () => {
        const copy = getSanctuaryCheckInCopy({
            name: '  Nova\u0000  ',
            personalityCore: 'unsupported',
            hour: 12
        });

        expect(copy.personalityCore).toBe('curious');
        expect(copy.line).toContain('Nova');
        expect(copy.line).not.toContain('\u0000');
    });

    test('provides a local non-saving mobile preview route', () => {
        expect(gameSource).toContain("urlParams.get('testCheckIn')");
        expect(gameSource).toContain('checkInPreview: testCheckIn');
        expect(hatchingSource).toContain("previewParams.has('testCheckIn')");
        expect(sceneSource).toContain('this.checkInPreview');
        expect(sceneSource).toContain('Sanctuary check-in preview created successfully');
    });

    test('turns resident production into a named, actionable world return', () => {
        const worker = {
            id: 'forager_1',
            plotId: 'root_01',
            status: 'complete',
            creature: { id: 'lyra', name: 'Lyra' },
            definition: {
                shortLabel: 'Forager Hut',
                production: { resource: 'food' }
            }
        };
        const summary = getSanctuaryReturnSummary({
            previousVillage: {
                resources: { food: 10, wood: 4, stone: 2 },
                buildings: [worker]
            },
            nextVillage: {
                resources: { food: 18, wood: 4, stone: 2 },
                buildings: [worker],
                worldState: {
                    nextAction: {
                        type: 'build',
                        plotId: 'root_02',
                        label: 'BUILD LIVING SAWMILL'
                    }
                }
            },
            offlineMinutes: 47,
            companionName: 'Nova'
        });

        expect(summary.title).toBe('LYRA RETURNED');
        expect(summary.detail).toBe('+8 FOOD');
        expect(summary.workerReturns[0]).toMatchObject({
            name: 'Lyra',
            id: 'food',
            amount: 8,
            plotId: 'root_01'
        });
        expect(summary.nextAction.label).toBe('BUILD LIVING SAWMILL');
    });

    test('prioritizes a newly completed structure over routine production', () => {
        const constructing = {
            id: 'habitat_1',
            plotId: 'root_04',
            status: 'constructing',
            definition: { shortLabel: 'Shared Habitat' }
        };
        const complete = {
            ...constructing,
            status: 'complete',
            definition: {
                shortLabel: 'Shared Habitat',
                completionCopy: 'A safe home now holds the glade together.'
            }
        };
        const summary = getSanctuaryReturnSummary({
            previousVillage: {
                resources: { food: 0, wood: 0, stone: 0 },
                buildings: [constructing]
            },
            nextVillage: {
                resources: { food: 0, wood: 0, stone: 0 },
                buildings: [complete],
                worldState: { nextAction: { type: 'review', label: 'REVIEW THE VILLAGE' } }
            }
        });

        expect(summary.title).toBe('SHARED HABITAT TOOK ROOT');
        expect(summary.detail).toBe('A safe home now holds the glade together.');
        expect(summary.completedBuildings).toHaveLength(1);
    });

    test('falls back to a companion watch event without inventing village gains', () => {
        const village = {
            resources: { food: 2, wood: 2, stone: 2 },
            buildings: [],
            worldState: { nextAction: { type: 'supplies', label: 'GATHER 8 WOOD' } }
        };
        const summary = getSanctuaryReturnSummary({
            previousVillage: village,
            nextVillage: village,
            events: [{ creatureName: 'Nova', result: 'Mapped a quiet signal near the hull.' }]
        });

        expect(summary.title).toBe('NOVA KEPT WATCH');
        expect(summary.detail).toBe('Mapped a quiet signal near the hull.');
        expect(summary.gains).toHaveLength(0);
    });

    test('keeps return reporting in the Sanctuary world instead of stopping play', () => {
        expect(sceneSource).toContain('getSanctuaryReturnSummary({');
        expect(sceneSource).toContain('playVillageCycleReturnMoment(');
        expect(sceneSource).not.toContain("this.scene.start('WelcomeBackScene'");
        expect(gameSource).toContain("urlParams.get('testVillageReturn') === '1'");
        expect(sceneSource).toContain('this.villageReturnPreview');
    });
});
