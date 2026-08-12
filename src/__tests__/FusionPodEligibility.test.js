const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFusionPodScene() {
    const filePath = path.join(__dirname, '../scenes/FusionPodScene.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/^import .*$/gm, '')
        .replace(
            /export function (getCreatureFusionReadiness|isCreatureFusionEligible|formatFusionWaitTime|getFallbackFusionCompatibility)/g,
            'function $1'
        )
        .replace(
            /export default FusionPodScene;/,
            'module.exports = { FusionPodScene, getCreatureFusionReadiness, isCreatureFusionEligible, formatFusionWaitTime, getFallbackFusionCompatibility };'
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
    return {
        ...sandbox.module.exports,
        sandboxWindow: sandbox.window
    };
}

describe('Fusion Pod maturity requirements', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.parse('2026-07-27T12:00:00.000Z');
    const {
        FusionPodScene,
        getCreatureFusionReadiness,
        getFallbackFusionCompatibility,
        formatFusionWaitTime,
        isCreatureFusionEligible,
        sandboxWindow
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

    test('reports an exact maturity wait instead of presenting the pod as broken', () => {
        const readiness = getCreatureFusionReadiness({
            name: 'Sprig',
            lifecycle: {
                stage: 'juvenile',
                birthDate: now - DAY_MS
            }
        }, now);

        expect(readiness).toEqual(expect.objectContaining({
            eligible: false,
            reason: 'maturing',
            stage: 'juvenile',
            readyAt: now + DAY_MS,
            remainingMs: DAY_MS
        }));
        expect(formatFusionWaitTime(readiness.remainingMs)).toBe('1d');
        expect(formatFusionWaitTime(25 * 60 * 60 * 1000)).toBe('1d 1h');
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
        expect(isCreatureFusionEligible({
            lifecycle: {
                stage: 'adult',
                birthDate: now - 3 * DAY_MS,
                hasDeparted: true
            }
        }, now)).toBe(false);
        expect(isCreatureFusionEligible({
            lifecycle: {
                stage: 'elder',
                birthDate: now - 12 * DAY_MS,
                departureDate: now - DAY_MS
            }
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

    test('keeps fallback compatibility stable across reloads and parent order', () => {
        const alpha = { id: 'companion_alpha_23' };
        const beta = { id: 'companion_beta_77' };
        const first = getFallbackFusionCompatibility(alpha, beta);
        const replay = getFallbackFusionCompatibility(alpha, beta);
        const reversed = getFallbackFusionCompatibility(beta, alpha);

        expect(replay).toEqual(first);
        expect(reversed).toEqual(first);
        expect(first).toEqual(expect.objectContaining({
            percentage: expect.any(Number),
            score: expect.any(Number),
            maxScore: 100,
            source: 'stable_identity_fallback'
        }));
        expect(first.percentage).toBeGreaterThanOrEqual(50);
        expect(first.percentage).toBeLessThanOrEqual(90);
    });

    test('uses a two-column short-landscape layout without changing portrait geometry', () => {
        const scene = new FusionPodScene();
        const landscape = scene.getResponsiveLayout(844, 390);
        const portrait = scene.getResponsiveLayout(390, 844);

        expect(landscape).toEqual(expect.objectContaining({
            shortLandscape: true,
            panel: expect.objectContaining({
                width: 760,
                height: 370
            })
        }));
        expect(landscape.slots.centerX).toBeLessThan(
            landscape.compatibility.centerX
        );
        expect(landscape.action.y + landscape.action.height).toBeLessThanOrEqual(
            landscape.panel.y + landscape.panel.height
        );
        expect(portrait).toEqual(expect.objectContaining({
            shortLandscape: false,
            panel: expect.objectContaining({
                width: 360,
                height: 550
            }),
            slots: expect.objectContaining({
                width: 130,
                height: 160
            })
        }));
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

    test('calculates compatibility before refreshing after the second parent is selected', () => {
        const scene = new FusionPodScene();
        const firstParent = { id: 'first', name: 'First', lifecycle: { stage: 'adult' } };
        const secondParent = { id: 'second', name: 'Second', lifecycle: { stage: 'elder' } };
        const callOrder = [];

        scene.parent1Index = 0;
        scene.parent1Data = firstParent;
        scene.closeSelectionModal = jest.fn(() => callOrder.push('close'));
        scene.calculateCompatibility = jest.fn(() => {
            scene.compatibility = { percentage: 77 };
            callOrder.push('calculate');
        });
        scene.refreshUI = jest.fn(() => {
            expect(scene.compatibility).toEqual({ percentage: 77 });
            callOrder.push('refresh');
        });
        scene.animateSlotFill = jest.fn();
        scene.highlightEmptySlot = jest.fn();

        scene.selectCreatureForSlot(2, 1, secondParent);

        expect(callOrder).toEqual(['calculate', 'close', 'refresh']);
        expect(scene.parent2Data).toBe(secondParent);
    });

    test('paginates every eligible creature instead of truncating the roster', () => {
        const scene = new FusionPodScene();
        const creatures = Array.from({ length: 8 }, (_, index) => ({
            id: `creature_${index}`
        }));

        expect(scene.getCreatureSelectorPage(creatures, 0, 4)).toEqual({
            items: creatures.slice(0, 4),
            page: 0,
            totalPages: 2
        });
        expect(scene.getCreatureSelectorPage(creatures, 1, 4)).toEqual({
            items: creatures.slice(4),
            page: 1,
            totalPages: 2
        });
        expect(scene.getCreatureSelectorPage(creatures, 99, 4).page).toBe(1);
    });

    test('re-enables the fixed fusion hit target after both parents are selected', () => {
        const scene = new FusionPodScene();
        const hitZone = {
            setInteractive: jest.fn().mockReturnThis(),
            disableInteractive: jest.fn().mockReturnThis()
        };
        scene.previewCreatures = [{ id: 'first' }, { id: 'second' }];
        scene.breedButtonHitZone = hitZone;
        scene.breedButtonBounds = {
            x: 0,
            y: 0,
            width: 220,
            height: 50
        };
        scene.breedButtonBg = {};
        scene.breedButton = {
            setText: jest.fn(),
            setColor: jest.fn()
        };
        scene.drawBreedButtonBackground = jest.fn();

        scene.updateBreedButton();
        expect(scene.breedButtonEnabled).toBe(false);
        expect(hitZone.disableInteractive).toHaveBeenCalledTimes(1);

        scene.parent1Data = { id: 'first' };
        scene.parent2Data = { id: 'second' };
        scene.updateBreedButton();

        expect(scene.breedButtonEnabled).toBe(true);
        expect(hitZone.setInteractive).toHaveBeenCalledWith({
            useHandCursor: true
        });
        expect(scene.breedButton.setText).toHaveBeenLastCalledWith(
            'BEGIN CURRENT SYNTHESIS'
        );
    });

    test('resumes the exact server-reserved result and stages its hatch', async () => {
        const scene = new FusionPodScene();
        const transaction = {
            operationId: 'fusion_reserved_23',
            parentIds: ['parent_alpha', 'parent_beta'],
            authorityReservation: { reservationMode: 'server_reserved' }
        };
        const parents = [
            { id: 'parent_alpha', name: 'Alpha' },
            { id: 'parent_beta', name: 'Beta' }
        ];
        const execution = {
            outcome: {
                operationId: transaction.operationId,
                offspring: [{ offspringData: { creatureId: 'child_23' } }]
            }
        };
        const hatchData = {
            offspringData: { creatureId: 'child_23' }
        };
        sandboxWindow.GameState = {
            getCreatureCollection: jest.fn(() => parents)
        };
        sandboxWindow.UXEnhancements = {
            showLoading: jest.fn(),
            hideLoading: jest.fn()
        };
        scene.executeServerFusionOutcome = jest.fn(async () => ({
            success: true,
            execution,
            transaction: {
                ...transaction,
                authorityExecution: { receipt: { operationId: transaction.operationId } }
            }
        }));
        scene.buildServerHatchData = jest.fn(() => hatchData);
        scene.stageFusionHatchData = jest.fn(() => ({ success: true }));
        scene.shutdown = jest.fn();
        scene.scene = { start: jest.fn() };

        await scene.resumeReservedFusion(transaction, 390, 844);

        expect(scene.parent1Data).toBe(parents[0]);
        expect(scene.parent2Data).toBe(parents[1]);
        expect(scene.fusionOperationId).toBe(transaction.operationId);
        expect(scene.executeServerFusionOutcome).toHaveBeenCalledTimes(1);
        expect(scene.stageFusionHatchData).toHaveBeenCalledWith(hatchData);
        expect(scene.scene.start).toHaveBeenCalledWith(
            'BreedingHatchScene',
            hatchData
        );
    });

    test('destroys the complete parent render group before rebuilding it', () => {
        const scene = new FusionPodScene();
        const oldElements = [
            { active: true, destroy: jest.fn() },
            { active: true, destroy: jest.fn() },
            { active: true, destroy: jest.fn() }
        ];
        scene.scale = { width: 1280, height: 720 };
        scene.parentSlotElements = oldElements;
        scene.elements = [];
        scene.createParentSlots = jest.fn(() => {
            scene.parentSlotElements.push({ active: true });
        });
        scene.updateCompatibilityDisplay = jest.fn();
        scene.updateBreedButton = jest.fn();

        scene.refreshUI();

        oldElements.forEach(element => {
            expect(element.destroy).toHaveBeenCalledTimes(1);
        });
        expect(scene.parentSlotElements).toHaveLength(1);
        expect(scene.createParentSlots).toHaveBeenCalledWith(1280, 720);
    });

    test('documents that synthesis preserves both parents', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../scenes/FusionPodScene.js'),
            'utf8'
        );

        expect(source).toContain(
            'Two stable signatures form a new lineage. Both companions remain with you.'
        );
        expect(source).toContain('previewAutoSelect');
        expect(source).toContain("'generation_failed'");
        expect(source).toContain('enterDeterministicRandomScope');
        expect(source).toContain('attachFusionAuthorityRequest');
        expect(source).toContain('createLocalReceipt');
        expect(source).toContain('executeServerFusionOutcome');
        expect(source).toContain('buildServerHatchData');
        expect(source).toContain('serverGenerated: true');
    });
});
