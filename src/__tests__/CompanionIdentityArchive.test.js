const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadArchive() {
    const filePath = path.join(
        __dirname,
        '../systems/CompanionIdentityArchive.js'
    );
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(
            "import { buildCreaturePowerProfile } from './CreaturePowerProfile.js';",
            'const buildCreaturePowerProfile = BUILD_POWER_PROFILE;'
        )
        .replace(/export const /g, 'const ')
        .replace(/export function /g, 'function ')
        .replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*$/, '')
        .concat(`
            module.exports = {
                COMPANION_IDENTITY_ARCHIVE_SCHEMA_VERSION,
                PORTABLE_COMPANION_RECORD_SCHEMA_VERSION,
                COMPANION_IDENTITY_CHAPTERS,
                AUTHORED_COMPANION_STUDIES,
                createInitialCompanionIdentityArchiveState,
                normalizeCompanionIdentityArchiveState,
                buildPortableCompanionRecord,
                getCompanionFieldMemories,
                getCompanionIdentityArchiveSnapshot,
                recordCompanionIdentityChapter
            };
        `);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        BUILD_POWER_PROFILE: gameState => ({
            schemaVersion: 1,
            affinity: gameState?.get?.(
                'creature.genes.cosmicAffinity.element'
            ) || 'star',
            magnitudeClass: 'extreme',
            currentControl: 77,
            relationshipState: 'trusting',
            universalSense: { id: 'living_resonance' },
            affinityPower: { id: 'stellar_sense' },
            protectiveResponse: { id: 'solar_shelter' },
            partnershipMove: {
                id: 'beacon_flare_pair',
                unlocked: true
            },
            highPowerReveal: {
                id: 'daybreak_event',
                unlocked: false
            }
        }),
        Date,
        Map,
        Set,
        Object,
        Array,
        Number,
        String,
        Math
    };
    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createGameState({
    creatureId = 'companion_23',
    archive = {},
    portraitUrl = 'https://private.example/temporary.webp',
    portraitAssetRef =
        'portrait-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074'
} = {}) {
    const state = {
        stats: { levelsCompleted: 4 },
        creature: {
            id: creatureId,
            hatched: true,
            name: '  Nova\u0000  Player note  ',
            genes: {
                id: creatureId,
                species: 'nebulaSprite',
                rarity: 'epic',
                cosmicAffinity: {
                    element: 'star',
                    powerLevel: 0.8
                }
            },
            lifecycle: { stage: 'juvenile' },
            lineage: {
                origin: 'fusion',
                generation: 2,
                parentIds: ['parent_1', 'parent_2'],
                fusionOperationId: 'fusion:23'
            },
            portraits: {
                schemaVersion: 1,
                activeStage: 'juvenile',
                byStage: {
                    juvenile: {
                        status: 'ready',
                        identityKey: 'portrait:companion_23:juvenile',
                        imageUrl: portraitUrl,
                        assetRef: portraitAssetRef,
                        style: 'cinematic',
                        provider: 'replicate',
                        model: 'model-v1',
                        promptVersion: 'living-portrait-v1',
                        storage: 'supabase-private',
                        generatedAt: 1785453000000
                    }
                }
            },
            bond: {
                level: 9,
                totalInteractions: 77,
                careActions: 23,
                conversations: 8,
                levelsCompleted: 4
            },
            powerHistory: [{
                eventId: 'power:23',
                powerId: 'daybreak_event',
                context: 'fend',
                magnitude: 'extreme',
                outcome: 'network_saved'
            }],
            agencyHistory: [{
                type: 'autonomous_rescue'
            }, {
                type: 'high_power_rescue'
            }],
            identityArchive: archive
        },
        creatures: [{
            id: creatureId,
            name: 'Nova'
        }, {
            id: 'other_companion',
            name: 'Other',
            identityArchive: {
                reviewedChapterIds: ['identity']
            }
        }],
        story: {
            companionMedia: {
                appearances: {
                    hatch: {
                        momentId: 'first_living_form',
                        identityKey: `portrait:${creatureId}:juvenile`,
                        stage: 'juvenile',
                        renderMode: 'motion_still',
                        viewCount: 2,
                        lastViewedAt: 1785453000000
                    },
                    debrief: {
                        momentId: 'guardian_debrief_elder_treant',
                        identityKey: `${creatureId}:juvenile:genetic_hash`,
                        stage: 'juvenile',
                        renderMode: 'motion_still',
                        viewCount: 1,
                        lastViewedAt: 1785454000000
                    },
                    foreign: {
                        momentId: 'beacon_reflection',
                        identityKey: 'other_companion:baby:other_hash',
                        viewCount: 77,
                        lastViewedAt: 1785455000000
                    },
                    unknown: {
                        momentId: 'player_supplied_memory',
                        identityKey: `${creatureId}:juvenile:genetic_hash`,
                        viewCount: 23,
                        lastViewedAt: 1785456000000
                    }
                }
            },
            projectBeacon: {
                fieldKit: {
                    katana: {
                        id: 'earth_field_katana',
                        configuration: 'creature_tech_adapted',
                        installedUpgrades: [{
                            id: 'crystal_edge',
                            witnessCompanionId: creatureId
                        }, {
                            id: 'aurora_guard',
                            witnessCompanionId: 'other_companion'
                        }]
                    }
                },
                sensei: {
                    memoryLedger: {
                        history: [{
                            type: 'memory_recalled',
                            memoryId: 'begin_with_your_footing',
                            companionId: creatureId
                        }]
                    }
                },
                shipArchive: {
                    history: [{
                        type: 'section_reviewed',
                        sectionId: 'evidence',
                        companionId: creatureId
                    }]
                }
            }
        },
        world: {
            fendCulture: {
                firstListening: {
                    selectedPriority: 'restoration'
                }
            }
        }
    };
    return {
        state,
        get(propertyPath) {
            return propertyPath.split('.').reduce(
                (value, key) => value?.[key],
                state
            );
        },
        set: jest.fn((propertyPath, value) => {
            const keys = propertyPath.split('.');
            const finalKey = keys.pop();
            const target = keys.reduce((current, key) => {
                current[key] ||= {};
                return current[key];
            }, state);
            target[finalKey] = value;
        }),
        save: jest.fn(),
        emit: jest.fn()
    };
}

describe('CompanionIdentityArchive', () => {
    const {
        normalizeCompanionIdentityArchiveState,
        buildPortableCompanionRecord,
        getCompanionFieldMemories,
        getCompanionIdentityArchiveSnapshot,
        recordCompanionIdentityChapter
    } = loadArchive();

    test('builds one bounded record without temporary media or personal data', () => {
        const gameState = createGameState();
        const record = buildPortableCompanionRecord(gameState);
        const serialized = JSON.stringify(record);

        expect(record.schemaVersion).toBe(2);
        expect(record.creature.id).toBe('companion_23');
        expect(record.creature.name).toBe('Nova Player note');
        expect(record.visualIdentity.stages[0]).toEqual(
            expect.objectContaining({
                stage: 'juvenile',
                identityKey: 'portrait:companion_23:juvenile',
                assetRef:
                    'portrait-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074',
                storage: 'supabase-private'
            })
        );
        expect(serialized).not.toContain('private.example');
        expect(serialized).not.toContain('imageUrl');
        expect(serialized).not.toContain('@');
        expect(record.privacy.playerAuthoredFields).toEqual([
            'creature.name'
        ]);
    });

    test('records a shared sibling without exporting remote identity', () => {
        const gameState = createGameState();
        gameState.state.creature.lineage = {
            schemaVersion: 2,
            creatureId: 'companion_23',
            origin: 'shared_fusion',
            generation: 3,
            parentIds: [
                'parent_23',
                'protected-parent-v1:remote_parent_fingerprint'
            ],
            fusionOperationId: 'fusion_shared_23',
            linkedSiblingId: 'remote_sibling_77'
        };
        gameState.state.creature.linkedSiblingId =
            'remote_sibling_77';
        gameState.state.world.sanctuaryDecorations = {
            kinshipBeacon: {
                schemaVersion: 2,
                unlocked: true,
                lineageCount: 2,
                sharedLineageCount: 1
            }
        };

        const snapshot = getCompanionIdentityArchiveSnapshot(
            gameState
        );
        const record = snapshot.portableRecord;
        const serialized = JSON.stringify(record);
        const linkedRow = snapshot.chapters
            .find(chapter => chapter.id === 'inheritance')
            .rows.find(row => row.label === 'LINKED SIBLING');

        expect(record.creature.lineage).toEqual(
            expect.objectContaining({
                origin: 'shared_fusion',
                parentIds: ['parent_23'],
                parentRecordCount: 2,
                protectedParentCount: 1,
                hasLinkedSibling: true
            })
        );
        expect(record.sharedHistory.kinship).toEqual({
            isSharedLineage: true,
            linkedSiblingProtected: true,
            sanctuarySharedLineageCount: 1,
            peerDisclosure: 'bounded_signal_only',
            ownershipTransfer: false
        });
        expect(linkedRow.value).toBe('ANOTHER SANCTUARY');
        expect(serialized).not.toContain('remote_sibling_77');
        expect(serialized).not.toContain(
            'remote_parent_fingerprint'
        );
        expect(record.privacy.excludes).toContain(
            'remote_companion_name'
        );
    });

    test('attributes shared history only to the active companion witness', () => {
        const record = buildPortableCompanionRecord(createGameState());
        expect(record.sharedHistory.katana.witnessedUpgradeIds).toEqual([
            'crystal_edge'
        ]);
        expect(record.sharedHistory.senseiMemoryIds).toEqual([
            'begin_with_your_footing'
        ]);
        expect(record.sharedHistory.shipSectionIds).toEqual([
            'evidence'
        ]);
    });

    test('projects only known visual moments for the active companion', () => {
        const gameState = createGameState();
        const fieldMemories = getCompanionFieldMemories(
            gameState,
            'companion_23'
        );
        const snapshot = getCompanionIdentityArchiveSnapshot(gameState);
        const fieldMemoryRow = snapshot.chapters
            .find(chapter => chapter.id === 'shared_journey')
            .rows.find(row => row.label === 'FIELD MEMORIES');

        expect(fieldMemories).toEqual({
            count: 2,
            totalViews: 3,
            memories: [
                expect.objectContaining({
                    momentId: 'guardian_debrief_elder_treant',
                    label: 'ELDER TREANT DEBRIEF'
                }),
                expect.objectContaining({
                    momentId: 'first_living_form',
                    label: 'FIRST LIVING FORM'
                })
            ]
        });
        expect(fieldMemoryRow.value).toBe('2 VISUAL RECORDS');
        expect(fieldMemoryRow.detail).toBe(
            'ELDER TREANT DEBRIEF // FIRST LIVING FORM'
        );
        expect(JSON.stringify(fieldMemories)).not.toContain('other_companion');
        expect(JSON.stringify(fieldMemories)).not.toContain('player_supplied');
    });

    test('uses generated art locally without substituting stock species art', () => {
        const generated = getCompanionIdentityArchiveSnapshot(
            createGameState()
        );
        const authored = getCompanionIdentityArchiveSnapshot(
            createGameState({
                portraitUrl: null,
                portraitAssetRef: null
            })
        );
        expect(generated.displayPortrait.source).toBe('living_portrait');
        expect(generated.displayPortrait.imageUrl).toContain(
            'private.example'
        );
        expect(generated.displayPortrait.assetRef).toContain(
            'portrait-job-v1:'
        );
        expect(authored.displayPortrait.source).toBe('pixel_form');
        expect(authored.displayPortrait.imageUrl).toBeNull();
    });

    test('enforces ordered review and syncs only the matching collection record', () => {
        const gameState = createGameState();
        const skipped = recordCompanionIdentityChapter(
            gameState,
            'shared_journey'
        );
        expect(skipped.reason).toBe('prior_chapter_required');

        const first = recordCompanionIdentityChapter(
            gameState,
            'identity',
            { occurredAt: '2026-07-31T00:23:00.000Z' }
        );
        expect(first.changed).toBe(true);
        expect(gameState.state.creatures[0].identityArchive)
            .toEqual(gameState.state.creature.identityArchive);
        expect(
            gameState.state.creatures[1].identityArchive.reviewedChapterIds
        ).toEqual(['identity']);
        expect(gameState.save).toHaveBeenCalledTimes(1);
    });

    test('repairs non-contiguous imports and strips arbitrary history fields', () => {
        const normalized = normalizeCompanionIdentityArchiveState({
            creatureId: 'Companion 23',
            reviewedChapterIds: [
                'identity',
                'shared_journey',
                'unknown'
            ],
            arbitraryNote: 'private',
            history: [{
                operationId: 'Review Identity',
                chapterId: 'identity',
                creatureId: 'Companion 23',
                occurredAt: '2026-07-31T00:23:00.000Z',
                dialogue: 'do not keep'
            }]
        }, 'companion_23');
        expect(normalized.reviewedChapterIds).toEqual(['identity']);
        expect(normalized.history[0]).toEqual({
            operationId: 'review_identity',
            type: 'chapter_reviewed',
            chapterId: 'identity',
            creatureId: 'companion_23',
            occurredAt: '2026-07-31T00:23:00.000Z'
        });
        expect(JSON.stringify(normalized)).not.toContain('do not keep');
        expect(JSON.stringify(normalized)).not.toContain('arbitraryNote');
    });
});
