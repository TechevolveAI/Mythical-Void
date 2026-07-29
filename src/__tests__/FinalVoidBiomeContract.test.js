const fs = require('fs');
const path = require('path');

const biomes = require('../config/biomes.json');
const parallaxSource = fs.readFileSync(
    path.join(__dirname, '../systems/ParallaxBiome.js'),
    'utf8'
);
const finalVoidSource = fs.readFileSync(
    path.join(__dirname, '../scenes/levels/FinalVoidLevel.js'),
    'utf8'
);

describe('Final Void biome contract', () => {
    test('registers a complete finale biome instead of using the nebula fallback', () => {
        const finalVoid = biomes.final_void;

        expect(finalVoid).toEqual(expect.objectContaining({
            id: 'final_void',
            name: 'The Final Void',
            unlockCost: 0
        }));
        expect(finalVoid.description).toContain('five restored living systems');
        expect(finalVoid.layers).toEqual(expect.objectContaining({
            nebulaBackground: expect.any(Object),
            distantStars: expect.any(Object),
            floatingRocks: expect.any(Object),
            crystalFlora: expect.any(Object),
            foregroundDust: expect.any(Object)
        }));
        expect(finalVoid.ambientEffects).toEqual(expect.objectContaining({
            livingNetwork: true,
            signalConvergence: true
        }));
    });

    test('uses the registered biome ID in the final level', () => {
        expect(finalVoidSource).toContain("biomeId: 'final_void'");
    });

    test('renders finale-specific signal, star, dust, and shader treatments', () => {
        expect(parallaxSource).toContain("case 'final_void':");
        expect(parallaxSource).toContain(
            'this.createBeaconSignalParticles(width, height)'
        );
        expect(parallaxSource).toContain(
            'createBeaconSignalParticles(width, height)'
        );
        expect(parallaxSource).toContain("type: 'beaconSignalEmitter'");
        expect(parallaxSource).toContain('final_void: {');
        expect(parallaxSource).toContain('beacon: null');
    });
});
