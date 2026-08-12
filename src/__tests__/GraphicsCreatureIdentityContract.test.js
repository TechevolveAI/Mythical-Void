const fs = require('fs');
const path = require('path');

describe('GraphicsEngine creature identity contract', () => {
    const source = fs.readFileSync(
        path.join(__dirname, '..', 'systems', 'GraphicsEngine.js'),
        'utf8'
    );

    test('renders species signatures in the canonical DNA creature texture', () => {
        expect(source).toContain('this.addSpeciesIdentityFeatures(');
        [
            'stellarWyrm',
            'crystalDrake',
            'nebulaSprite',
            'voidStalker',
            'cosmicGuardian',
            'auroraPhoenix',
            'crystalElemental'
        ].forEach(species => {
            expect(source).toContain(`case '${species}':`);
        });
    });

    test('gives each DNA head family an explicit silhouette profile', () => {
        expect(source).toContain('getDNAHeadSilhouetteProfile(headArchetype)');
        [
            'feline',
            'canine',
            'avian',
            'reptile',
            'aquatic',
            'simian',
            'insectoid',
            'rodent',
            'cervine'
        ].forEach(head => {
            expect(source).toMatch(
                new RegExp(`${head}: \\{ headScale: [0-9.]+, eyeScale: [0-9.]+ \\}`)
            );
        });
    });
});
