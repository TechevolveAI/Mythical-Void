const fs = require('fs');
const path = require('path');
const GameStateManager = require('../systems/GameState.js');

function companion(id, level = 1) {
    return {
        id,
        name: id === 'signal_alpha' ? 'Alpha' : 'Beta',
        level,
        experience: 0,
        stats: { happiness: 100, energy: 100, health: 100 },
        genes: { id: `genes_${id}`, rarity: 'common' },
        portraits: { schemaVersion: 1, activeStage: null, byStage: {} },
        lifecycle: {
            stage: 'baby',
            birthDate: Date.now()
        },
        bond: { level: 1, experience: 0 },
        powerHistory: [],
        generation: 1,
        parentIds: []
    };
}

describe('Fusion story integration', () => {
    let manager;

    beforeEach(() => {
        localStorage.clear();
        manager = new GameStateManager();
    });

    afterEach(() => {
        manager.stopAutoSave();
    });

    test('discovers the dormant Fend protocol when a second family record arrives', () => {
        manager.set('creatures', [companion('signal_alpha')]);
        const discoveries = [];
        manager.on('fusionPodDiscovered', event => discoveries.push(event));

        expect(
            manager.addCreatureToCollection(companion('signal_beta')).success
        ).toBe(true);

        expect(manager.get('breedingShrine.discovery')).toEqual(
            expect.objectContaining({
                schemaVersion: 1,
                state: 'two_signals',
                source: 'fend_current_archive',
                introductionAcknowledged: false
            })
        );
        expect(discoveries).toHaveLength(1);
        expect(discoveries[0]).toEqual(expect.objectContaining({
            creatureCount: 2,
            creatures: [
                expect.objectContaining({ id: 'signal_alpha' }),
                expect.objectContaining({ id: 'signal_beta' })
            ]
        }));
    });

    test('keeps discovery separate from operational level readiness', () => {
        manager.set('creatures', [
            companion('signal_alpha'),
            companion('signal_beta')
        ]);
        manager.syncFusionDiscovery();

        expect(manager.get('breedingShrine.discovery.state')).toBe('two_signals');
        expect(manager.get('breedingShrine.unlocked')).toBe(false);

        manager.set('creature.level', 5);
        expect(manager.checkBreedingShrineUnlock()).toBe(true);
        expect(manager.get('breedingShrine.discovery.state')).toBe('stable');
    });

    test('acknowledges the new story record independently of the legacy tutorial', () => {
        manager.set('creatures', [
            companion('signal_alpha'),
            companion('signal_beta')
        ]);
        manager.set('tutorial.breedingUnlockSeen', true);

        const pending = manager.syncFusionDiscovery();
        expect(pending.shouldIntroduce).toBe(true);
        expect(manager.acknowledgeFusionDiscovery()).toBe(true);
        expect(
            manager.get('breedingShrine.discovery.introductionAcknowledged')
        ).toBe(true);
        expect(manager.syncFusionDiscovery().shouldIntroduce).toBe(false);
    });

    test('repairs a shared lineage beacon from portable history on load', () => {
        const save = {
            breedingShrine: {
                breedingHistory: [{
                    operationId: 'fusion_local_23',
                    origin: 'fusion',
                    completedAt: 1000
                }, {
                    operationId: 'fusion_shared_77',
                    origin: 'shared_fusion',
                    completedAt: 2000
                }]
            },
            world: {
                sanctuaryDecorations: {
                    kinshipBeacon: {
                        unlocked: false
                    }
                }
            }
        };

        manager.migrateFusionPortability(save);

        expect(
            save.world.sanctuaryDecorations.kinshipBeacon
        ).toEqual(expect.objectContaining({
            schemaVersion: 2,
            unlocked: true,
            lineageCount: 2,
            sharedLineageCount: 1,
            firstSharedOperationId: 'fusion_shared_77',
            lastSharedOperationId: 'fusion_shared_77'
        }));
        expect(save.breedingShrine.discovery.state).toBe(
            'first_lineage'
        );
    });
});

describe('Fusion presentation contracts', () => {
    const gameSource = fs.readFileSync(
        path.join(__dirname, '../scenes/GameScene.js'),
        'utf8'
    );
    const worldSource = fs.readFileSync(
        path.join(__dirname, '../systems/world/WorldBuilder.js'),
        'utf8'
    );
    const bootstrapSource = fs.readFileSync(
        path.join(__dirname, '../game.js'),
        'utf8'
    );
    const podSource = fs.readFileSync(
        path.join(__dirname, '../scenes/FusionPodScene.js'),
        'utf8'
    );

    test('places Fusion inside the Fend story and states parent continuity', () => {
        expect(gameSource).toContain('FEND CURRENT ARCHIVE');
        expect(gameSource).toContain('TWO SIGNALS // KINSHIP PROTOCOL');
        expect(gameSource).toContain('FUSION PRESERVES BOTH PARENTS');
        expect(gameSource).toContain(
            'Your first lineage will light a permanent Kinship Beacon here.'
        );
    });

    test('defers the Fusion introduction until onboarding and first trust are clear', () => {
        expect(gameSource).toContain(
            'scheduleFusionDiscoveryIntroduction(data)'
        );
        expect(gameSource).toContain(
            'isFusionDiscoveryIntroductionBlocked()'
        );
        expect(gameSource).toContain("'beacon_first_contact'");
        expect(gameSource).toContain(
            'window.OnboardingManager?.isProcessing'
        );
        expect(gameSource).toContain(
            'this.mobileControls?.suspend?.() === true'
        );
        expect(gameSource).toContain(
            'this.mobileControls?.resume?.()'
        );
    });

    test('renders the persistent Kinship Beacon from save-backed lineage state', () => {
        expect(worldSource).toContain('createKinshipBeacon(stateOverride = null)');
        expect(worldSource).toContain(
            "'world.sanctuaryDecorations.kinshipBeacon'"
        );
        expect(worldSource).toContain('KINSHIP BEACON // FIRST LINEAGE');
        expect(worldSource).toContain(
            'KINSHIP BEACON // LINKED SANCTUARIES'
        );
        expect(worldSource).toContain('PEER IDENTITY PROTECTED');
        expect(worldSource).toContain('refreshKinshipBeacon(beacon, stateOverride = null)');
    });

    test('provides local non-saving visual regression routes', () => {
        expect(bootstrapSource).toContain("urlParams.has('testFusionStory')");
        expect(bootstrapSource).toContain(
            "urlParams.get(\n            'testFusionLandmark'"
        );
        expect(bootstrapSource).toContain(
            'fusionLandmarkPreview: testFusionLandmark'
        );
        expect(bootstrapSource).toContain(
            "urlParams.get(\n            'testKinshipBeacon'"
        );
        expect(bootstrapSource).toContain('fusionStoryPreview: true');
        expect(bootstrapSource).toContain(
            "testKinshipBeacon === 'shared'"
        );
    });

    test('resumes an exact server reservation instead of discarding it', () => {
        expect(podSource).toContain('getPendingReservedFusion');
        expect(podSource).toContain('resumeReservedFusion');
        expect(podSource).toContain('Reserved Lineage Safe');
        expect(podSource).toContain(
            '!serverReserved'
        );
    });
});
