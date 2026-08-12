const fs = require('fs');
const path = require('path');

describe('local hatch renderer gallery contract', () => {
    const gameSource = fs.readFileSync(
        path.join(__dirname, '..', 'game.js'),
        'utf8'
    );

    test('uses the production genetics, DNA, and sprite renderer without saving', () => {
        const gallerySource = gameSource
            .split('function launchLocalHatchGallery')[1]
            .split('/**\n * Main game file')[0];

        expect(gameSource).toContain("urlParams.has('testHatchGallery')");
        expect(gameSource).toContain(
            'window.CreatureGenetics\n                        .generateCreatureGenetics()'
        );
        expect(gameSource).toContain('window.CreatureDNA.generateDNA({');
        expect(gameSource).toContain('engine.createCreatureFromDNA(');
        expect(gameSource).toContain("exportElement.id = 'hatch-qa-manifest'");
        expect(gallerySource).not.toContain('GameState.save');
        expect(gallerySource).not.toContain('localStorage');
    });
});
