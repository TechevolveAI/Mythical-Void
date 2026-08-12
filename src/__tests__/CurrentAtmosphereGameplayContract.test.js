const fs = require('fs');
const path = require('path');

describe('Current atmosphere gameplay integration', () => {
    const sceneSource = fs.readFileSync(
        path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
        'utf8'
    );
    const audioSource = fs.readFileSync(
        path.join(__dirname, '../systems/AudioManager.js'),
        'utf8'
    );
    const atmosphereSource = fs.readFileSync(
        path.join(__dirname, '../systems/CurrentAtmosphere.js'),
        'utf8'
    );

    test('derives one shared atmosphere across all six Current nodes', () => {
        [
            'mythical_forest_1',
            'crystal_caves_1',
            'reef_1',
            'void_peaks_1',
            'aurora_depths_1',
            'final_void_1'
        ].forEach(levelId => {
            expect(sceneSource).toContain(`${levelId}: Object.freeze({`);
        });
        expect(sceneSource).toContain(
            "import { getCurrentAtmosphereProjection } from '../systems/CurrentAtmosphere.js';"
        );
        expect(sceneSource).toContain(
            'const atmosphere = getCurrentAtmosphereProjection(snapshot);'
        );
        expect(atmosphereSource).not.toContain(
            "from './CurrentEcology.js'"
        );
        expect(atmosphereSource).not.toContain("GameState.set(");
        expect(atmosphereSource).not.toContain('localStorage');
        expect(atmosphereSource).not.toContain('sessionStorage');
        expect(atmosphereSource).not.toContain('fetch(');
    });

    test('renders life, motes, damage scars, and restrained recurring audio', () => {
        expect(sceneSource).toContain('renderCurrentAtmosphere(snapshot)');
        expect(sceneSource).toContain(
            'index < atmosphere.lifeFormCount'
        );
        expect(sceneSource).toContain('index < atmosphere.moteCount');
        expect(sceneSource).toContain(
            'index < atmosphere.scarCount'
        );
        expect(sceneSource).toContain(
            'atmosphere.soundscape.intervalMs'
        );
        expect(sceneSource).toContain(
            'atmosphere.soundscape.cueId'
        );
        expect(sceneSource).not.toContain(
            'this.renderCurrentAtmosphere(node.snapshot);\n        window.GameState'
        );
    });

    test('registers every atmosphere cue with the procedural audio manager', () => {
        [
            'current_fracture',
            'current_fading',
            'current_life',
            'current_harmony',
            'current_crosscurrent'
        ].forEach(cueId => {
            expect(audioSource).toContain(
                `this.createToneSequence('${cueId}'`
            );
        });
    });

    test('tears down timers, tweens, and visual elements on refresh or shutdown', () => {
        expect(sceneSource).toContain('this.clearCurrentAtmosphere();');
        expect(sceneSource).toContain(
            'atmosphere?.audioTimer?.remove?.();'
        );
        expect(sceneSource).toContain('tween?.stop?.();');
        expect(sceneSource).toContain('tween?.remove?.();');
        expect(sceneSource).toContain('element?.destroy?.();');
        expect(sceneSource).toContain('this.clearCurrentEcologyNode();');
    });
});
