const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFusionPodScene() {
    const filePath = path.join(__dirname, '../scenes/FusionPodScene.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/^import .*$/gm, '')
        .replace(
            /export function isCreatureFusionEligible/,
            'function isCreatureFusionEligible'
        )
        .replace(
            /export default FusionPodScene;/,
            'module.exports = { FusionPodScene, isCreatureFusionEligible };'
        );

    class PhaserScene {}

    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: {
            Phaser: {
                Scene: PhaserScene
            }
        },
        Date,
        Math,
        Number,
        Object,
        Set
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('Fusion Pod maturity requirements', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.parse('2026-07-27T12:00:00.000Z');
    const {
        FusionPodScene,
        isCreatureFusionEligible
    } = loadFusionPodScene();

    test('accepts adults and elders while rejecting younger stored stages', () => {
        expect(isCreatureFusionEligible({
            lifecycle: { stage: 'adult', birthDate: now }
        }, now)).toBe(true);
        expect(isCreatureFusionEligible({
            lifecycle: { stage: 'elder', birthDate: now }
        }, now)).toBe(true);
        expect(isCreatureFusionEligible({
            lifecycle: { stage: 'baby', birthDate: now - 10 * DAY_MS }
        }, now)).toBe(false);
        expect(isCreatureFusionEligible({
            lifecycle: { stage: 'juvenile', birthDate: now - 10 * DAY_MS }
        }, now)).toBe(false);
    });

    test('supports legacy creatures without a stored lifecycle stage', () => {
        expect(isCreatureFusionEligible({
            lifecycle: { birthDate: now - 2 * DAY_MS }
        }, now)).toBe(true);
        expect(isCreatureFusionEligible({
            hatchTime: new Date(now - 3 * DAY_MS).toISOString()
        }, now)).toBe(true);
        expect(isCreatureFusionEligible({
            hatchTime: now - DAY_MS
        }, now)).toBe(false);
    });

    test('rejects missing, malformed, and future lifecycle data', () => {
        expect(isCreatureFusionEligible(null, now)).toBe(false);
        expect(isCreatureFusionEligible({}, now)).toBe(false);
        expect(isCreatureFusionEligible({
            lifecycle: { birthDate: 'not-a-date' }
        }, now)).toBe(false);
        expect(isCreatureFusionEligible({
            lifecycle: { birthDate: now + DAY_MS }
        }, now)).toBe(false);
    });

    test('uses the same eligibility rule for collection requirements and selection', () => {
        const scene = new FusionPodScene();
        const creatures = [
            { id: 'hatchling', lifecycle: { stage: 'baby' } },
            { id: 'adult', lifecycle: { stage: 'adult' } },
            { id: 'elder', lifecycle: { stage: 'elder' } },
            { id: 'unknown', lifecycle: {} }
        ];

        expect(scene.getAdultCreatures(creatures).map(creature => creature.id)).toEqual([
            'adult',
            'elder'
        ]);
        expect(scene.isCreatureAdult(creatures[0])).toBe(false);
        expect(scene.isCreatureAdult(creatures[1])).toBe(true);
    });

    test('uses local preview creatures without requiring or changing GameState', () => {
        const scene = new FusionPodScene();
        const previewCreatures = [
            { id: 'preview-adult', lifecycle: { stage: 'adult' } },
            { id: 'preview-baby', lifecycle: { stage: 'baby' } }
        ];

        scene.init({ previewCreatures });

        expect(scene.getFusionCollection()).toBe(previewCreatures);
        expect(scene.getAdultCreatures(scene.getFusionCollection()).map(creature => creature.id))
            .toEqual(['preview-adult']);
    });
});
