const GameStateManager = require('../systems/GameState.js');

describe('creature portrait save state', () => {
    let manager;

    beforeEach(() => {
        localStorage.clear();
        manager = new GameStateManager();
    });

    test('starts with an empty stage-indexed portrait collection', () => {
        expect(manager.get('creature.portraits')).toEqual({
            schemaVersion: 1,
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
            expiresAt: Date.now() + 60000
        })).toBe(true);

        expect(manager.getCreaturePortrait('baby')).toEqual(expect.objectContaining({
            identityKey: 'STEL-CUR-001:baby:12345678',
            aiGenerated: true,
            storage: 'provider-temporary'
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
});
