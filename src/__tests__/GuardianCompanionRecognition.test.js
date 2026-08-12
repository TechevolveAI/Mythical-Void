const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadRecognition() {
    const filePath = path.join(
        __dirname,
        '../systems/GuardianCompanionRecognition.js'
    );
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/export \{[^}]+\};?\s*$/g, '')
        .concat(`
            module.exports = {
                GUARDIAN_COMPANION_RECOGNITION_SCHEMA_VERSION,
                GUARDIAN_OBSERVATIONS,
                getGuardianCompanionRecognition
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Object,
        Array,
        Set,
        String,
        Math
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState({
    id = 'companion_23',
    name = 'Kira',
    personality = 'curious',
    affinity = 'nebula',
    body = 'serpentine',
    mutations = [],
    features = []
} = {}) {
    const state = {
        creature: {
            name,
            personality,
            genes: {
                id,
                personality: { core: personality },
                cosmicAffinity: { element: affinity },
                traits: {
                    bodyShape: { type: body },
                    features: {
                        wackyMutations: mutations,
                        specialFeatures: features
                    }
                }
            },
            dna: {
                id: `${id}_dna`,
                bodyArchetype: body,
                hybridTag: 'single-species'
            }
        }
    };
    return {
        get(propertyPath) {
            return propertyPath.split('.').reduce(
                (value, key) => value?.[key],
                state
            );
        }
    };
}

describe('GuardianCompanionRecognition', () => {
    const {
        GUARDIAN_OBSERVATIONS,
        getGuardianCompanionRecognition
    } = loadRecognition();

    test('recognizes the exact companion name, personality, affinity, and mutation', () => {
        const recognition = getGuardianCompanionRecognition(
            createGameState({
                mutations: [{ type: 'extra_eyes' }]
            }),
            'elder_treant'
        );

        expect(recognition).toMatchObject({
            companionId: 'companion_23',
            companionName: 'Kira',
            personality: 'curious',
            affinity: 'nebula',
            affinityLabel: 'Nebula',
            signatureKind: 'mutation',
            signatureTrait: 'extra eyes'
        });
        expect(recognition.cue).toBe('CURIOUS // NEBULA // EXTRA EYES');
        expect(recognition.line).toContain('Kira');
        expect(recognition.line).toContain('extra eyes');
    });

    test('each guardian responds in a distinct authored voice', () => {
        const gameState = createGameState({
            features: [{ type: 'crystal_growth' }]
        });
        const lines = Object.keys(GUARDIAN_OBSERVATIONS).map(guardianId => (
            getGuardianCompanionRecognition(gameState, guardianId).line
        ));

        expect(new Set(lines).size).toBe(6);
        expect(lines.every(line => line.includes('crystal growth'))).toBe(true);
    });

    test('different inherited signatures produce different recognition', () => {
        const first = getGuardianCompanionRecognition(
            createGameState({
                id: 'first',
                mutations: [{ type: 'floating_hands' }]
            }),
            'void_empress'
        );
        const second = getGuardianCompanionRecognition(
            createGameState({
                id: 'second',
                mutations: [{ type: 'three_tails' }]
            }),
            'void_empress'
        );

        expect(first.signatureTrait).toBe('floating hands');
        expect(second.signatureTrait).toBe('three tails');
        expect(first.line).not.toBe(second.line);
    });

    test('falls back to real morphology when no rare feature exists', () => {
        const recognition = getGuardianCompanionRecognition(
            createGameState({ body: 'quadruped' }),
            'cosmic_titan'
        );

        expect(recognition.signatureKind).toBe('body');
        expect(recognition.signatureTrait).toBe('quadruped form');
        expect(recognition.line).toContain('quadruped form');
    });

    test('rejects unknown guardians and bounds imported display fields', () => {
        expect(getGuardianCompanionRecognition(
            createGameState(),
            'unknown_guardian'
        )).toBe(null);
        const recognition = getGuardianCompanionRecognition(
            createGameState({
                name: `Signal\n${'x'.repeat(100)}`,
                personality: 'untrusted',
                affinity: 'untrusted'
            }),
            'nyxvoral'
        );

        expect(recognition.companionName).not.toContain('\n');
        expect(recognition.companionName.length).toBeLessThanOrEqual(24);
        expect(recognition.personality).toBe('curious');
        expect(recognition.affinity).toBe('star');
        expect(recognition.line.length).toBeLessThanOrEqual(160);
    });
});
