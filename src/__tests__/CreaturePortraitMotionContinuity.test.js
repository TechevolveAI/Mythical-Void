const fs = require('fs');
const path = require('path');

describe('creature portrait motion continuity', () => {
    const forest = fs.readFileSync(
        path.join(__dirname, '../scenes/levels/MythicalForestLevel.js'),
        'utf8'
    );
    const profile = fs.readFileSync(
        path.join(__dirname, '../scenes/CreatureProfileScene.js'),
        'utf8'
    );
    const styles = fs.readFileSync(
        path.join(__dirname, '../styles/main.css'),
        'utf8'
    );
    const netlify = fs.readFileSync(
        path.join(__dirname, '../../netlify.toml'),
        'utf8'
    );

    test('renders the exact portrait during the first Forest field brief', () => {
        expect(forest).toContain(
            'mediaService?.createStoryMoment || mediaService?.createCinematicStill'
        );
        expect(forest).toContain("momentId: 'first_forest_arrival'");
        expect(forest).toContain('record: portraitPreviewRecord');
        expect(forest).toContain('scenicElements.push(...(tableau.elements || []))');
        expect(forest).toContain('this.forestArrivalRequest === requestId');
    });

    test('keeps both reveal and profile portraits visibly alive', () => {
        expect(styles).toContain(
            '.living-form-image.is-generated-portrait.is-ready'
        );
        expect(styles).toContain('animation: living-form-breathing-frame');
        expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
        expect(profile).toContain('targets: portrait');
        expect(profile).toContain('scaleX: portrait.scaleX * 1.025');
        expect(profile).toContain('repeat: -1');
    });

    test('keeps provider video optional while portrait motion remains guaranteed', () => {
        const disabledContexts = netlify.match(/VITE_ENABLE_AI_VIDEOS = "false"/g) || [];
        expect(disabledContexts).toHaveLength(4);
    });
});
