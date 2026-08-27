const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadPresentationResolver() {
    const filePath = path.join(__dirname, '../ui/KatanaArtifactModal.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/export function /g, 'function ')
        .replace(/export default class KatanaArtifactModal/, 'class KatanaArtifactModal')
        .concat('\nmodule.exports = { getKatanaArtifactPresentation };');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Object,
        Array,
        Set
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('katana artifact presentation', () => {
    const artifactSource = fs.readFileSync(
        path.join(__dirname, '../ui/KatanaArtifactModal.js'),
        'utf8'
    );
    const platformerSource = fs.readFileSync(
        path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
        'utf8'
    );
    const crystalSource = fs.readFileSync(
        path.join(__dirname, '../scenes/levels/CrystalCavesLevel.js'),
        'utf8'
    );
    const auroraSource = fs.readFileSync(
        path.join(__dirname, '../scenes/levels/AuroraDepthsLevel.js'),
        'utf8'
    );

    test('selects artwork from canonical installed upgrades', () => {
        const { getKatanaArtifactPresentation } = loadPresentationResolver();

        expect(getKatanaArtifactPresentation([])).toEqual(
            expect.objectContaining({
                id: 'earth',
                imageUrl: '/game/artifacts/earth-field-katana.webp',
                stageIndex: 0
            })
        );
        expect(getKatanaArtifactPresentation([{ id: 'crystal_edge' }])).toEqual(
            expect.objectContaining({
                id: 'crystal',
                imageUrl: '/game/artifacts/earth-field-katana-resonant.webp',
                stageIndex: 1
            })
        );
        expect(getKatanaArtifactPresentation([
            'crystal_edge',
            { id: 'aurora_guard' }
        ])).toEqual(
            expect.objectContaining({
                id: 'aurora',
                imageUrl: '/game/artifacts/earth-field-katana-aurora.webp',
                stageIndex: 2
            })
        );
    });

    test('ships every staged artwork referenced by the modal', () => {
        [
            'earth-field-katana.webp',
            'earth-field-katana-resonant.webp',
            'earth-field-katana-aurora.webp'
        ].forEach(fileName => {
            const assetPath = path.join(
                __dirname,
                '../../public/game/artifacts',
                fileName
            );
            expect(fs.existsSync(assetPath)).toBe(true);
            expect(fs.statSync(assetPath).size).toBeGreaterThan(10000);
        });
    });

    test('prefetches artwork and labels it as an artistic interpretation', () => {
        expect(artifactSource).toContain('prefetchKatanaArtifactArtwork');
        expect(artifactSource).toContain('AI-ASSISTED ARTISTIC INTERPRETATION');
        expect(artifactSource).toContain("inventory: 'CURRENT CONFIGURATION'");
    });

    test('reveals newly earned upgrades before ordinary level rewards', () => {
        expect(platformerSource).toContain('showKatanaUpgradeReveal({ onClose = null }');
        expect(platformerSource).toContain("context: 'upgrade'");
        expect(crystalSource).toContain(
            'onClose: () => this.showCompletionScreen()'
        );
        expect(auroraSource).toContain(
            'onClose: () => this.showLevelComplete()'
        );
    });

    test('serializes the resident release and katana reward on touch devices', () => {
        expect(platformerSource).toContain('if (this.residentReleaseOpen)');
        expect(platformerSource).toContain(
            'this.pendingResidentReleaseContinuation = () => {'
        );
        expect(platformerSource).toContain('this.time.delayedCall(100, () => {');
    });

    test('uses one-shot pointer and touch-native continuation routes on mobile', () => {
        expect(artifactSource).toContain(
            "button.addEventListener('pointerup', this.closeHandler)"
        );
        expect(artifactSource).toContain(
            "button.addEventListener('touchend', this.closeHandler, { passive: false })"
        );
        expect(artifactSource).toContain('if (!this.domElement) return;');
        expect(artifactSource).toContain(
            "this.continueButton.removeEventListener('pointerup', this.closeHandler)"
        );
        expect(artifactSource).toContain(
            "this.continueButton.removeEventListener('touchend', this.closeHandler)"
        );
        expect(artifactSource).toContain(
            "window.addEventListener('pointerup', this.releaseGuardHandler, true)"
        );
        expect(artifactSource).toContain(
            "window.addEventListener('touchend', this.releaseGuardHandler"
        );
        expect(artifactSource).toContain('event.stopImmediatePropagation?.()');
        expect(artifactSource).toContain(
            "window.removeEventListener('pointerup', this.releaseGuardHandler, true)"
        );
    });
});
