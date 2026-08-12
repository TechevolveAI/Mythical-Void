const GameStateManager = require('../systems/GameState.js');

describe('creature portrait save state', () => {
    let manager;

    beforeEach(() => {
        localStorage.clear();
        manager = new GameStateManager();
    });

    test('starts with an empty stage-indexed portrait collection', () => {
        expect(manager.get('creature.portraits')).toEqual({
            schemaVersion: 2,
            activeStage: null,
            byStage: {}
        });
    });

    test('saves portrait provenance and keeps the collection entry synchronized', () => {
        manager.set('creature.hatched', true);
        manager.set('creature.name', 'Nova');
        manager.set('creature.genes', { id: 'STEL-CUR-001', rarity: 'common' });
        expect(manager.addCreatureToCollection().success).toBe(true);

        expect(manager.saveCreaturePortrait({
            identityKey: 'STEL-CUR-001:baby:12345678',
            stage: 'baby',
            style: 'cinematic',
            imageUrl: 'https://replicate.delivery/example.webp',
            provider: 'Replicate',
            model: 'openai/gpt-image-2',
            promptVersion: 'living-portrait-v1',
            generatedAt: 1000,
            generationDurationMs: 4823,
            pollCount: 2,
            expiresAt: Date.now() + 60000
        })).toBe(true);

        expect(manager.getCreaturePortrait('baby')).toEqual(expect.objectContaining({
            identityKey: 'STEL-CUR-001:baby:12345678',
            aiGenerated: true,
            storage: 'provider-temporary',
            generationDurationMs: 4823,
            pollCount: 2
        }));
        expect(manager.get('creatures.0.portraits.byStage.baby')).toEqual(
            expect.objectContaining({ style: 'cinematic' })
        );
    });

    test('does not expose expired temporary portrait links', () => {
        manager.saveCreaturePortrait({
            identityKey: 'STEL-CUR-001:baby:12345678',
            stage: 'baby',
            imageUrl: 'https://replicate.delivery/expired.webp',
            expiresAt: Date.now() - 1
        });

        expect(manager.getCreaturePortrait('baby')).toBeNull();
    });

    test('persists only a durable reference for a private portrait', () => {
        const assetRef =
            'portrait-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074';
        manager.set('creature.hatched', true);
        manager.set('creature.genes', {
            id: 'STEL-CUR-001',
            rarity: 'rare'
        });
        manager.addCreatureToCollection();
        expect(manager.saveCreaturePortrait({
            identityKey: 'STEL-CUR-001:baby:12345678',
            stage: 'baby',
            style: 'cinematic',
            imageUrl:
                'https://mkcmdbzcihjgidjuypqe.supabase.co/storage/signed',
            assetRef,
            storage: 'supabase-private',
            jobId: '824363b2-d374-4b44-bf7f-1d7a177fa074',
            expiresAt: Date.now() + 60000
        })).toBe(true);

        expect(manager.getCreaturePortrait('baby')).toEqual(
            expect.objectContaining({
                assetRef,
                imageUrl: expect.stringContaining('/storage/signed')
            })
        );
        const snapshot = manager.createSaveSnapshot();
        const serialized = JSON.stringify(snapshot);
        expect(snapshot.creature.portraits.byStage.baby).toEqual(
            expect.objectContaining({
                schemaVersion: 2,
                assetRef,
                storage: 'supabase-private'
            })
        );
        expect(
            snapshot.creature.portraits.byStage.baby
        ).not.toHaveProperty('imageUrl');
        expect(
            snapshot.creatures[0].portraits.byStage.baby
        ).not.toHaveProperty('expiresAt');
        expect(serialized).not.toContain('/storage/signed');
    });

    test('migrates a legacy private job into a durable reference', () => {
        const legacy = manager.createSaveSnapshot();
        legacy.creature.portraits = {
            schemaVersion: 1,
            activeStage: 'baby',
            byStage: {
                baby: {
                    identityKey: 'legacy:baby:23',
                    stage: 'baby',
                    status: 'ready',
                    storage: 'supabase-private',
                    jobId: '824363b2-d374-4b44-bf7f-1d7a177fa074',
                    imageUrl: 'https://private.example/expired.webp',
                    expiresAt: 1
                }
            }
        };

        const migrated = manager.migrateSaveData(legacy, '1.1.0');
        expect(migrated.creature.portraits).toEqual(
            expect.objectContaining({
                schemaVersion: 2,
                byStage: {
                    baby: expect.objectContaining({
                        assetRef:
                            'portrait-job-v1:824363b2-d374-4b44-bf7f-1d7a177fa074'
                    })
                }
            })
        );
    });
});
