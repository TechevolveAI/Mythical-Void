const fs = require('fs');
const path = require('path');

describe('Current ecology gameplay contract', () => {
    const scenePath = path.join(
        __dirname,
        '../scenes/PlatformerLevelScene.js'
    );
    const source = fs.readFileSync(scenePath, 'utf8');
    const finalSource = fs.readFileSync(
        path.join(__dirname, '../scenes/levels/FinalVoidLevel.js'),
        'utf8'
    );
    const gameSource = fs.readFileSync(
        path.join(__dirname, '../game.js'),
        'utf8'
    );
    const hatchingSource = fs.readFileSync(
        path.join(__dirname, '../scenes/HatchingScene.js'),
        'utf8'
    );

    test('places interactive nodes across all six runtime realms', () => {
        expect(source).toContain('mythical_forest_1: Object.freeze({');
        expect(source).toContain('crystal_caves_1: Object.freeze({');
        expect(source).toContain('reef_1: Object.freeze({');
        expect(source).toContain('void_peaks_1: Object.freeze({');
        expect(source).toContain('aurora_depths_1: Object.freeze({');
        expect(source).toContain('final_void_1: Object.freeze({');
        expect(source).toContain('this.createCurrentEcologyNode();');
    });

    test('applies and explains one bounded upstream consequence', () => {
        expect(source).toContain(
            'ecology.applyCurrentArrivalConsequence?.('
        );
        expect(source).toContain('echoStatus');
        expect(source).toContain(
            'node.snapshot.arrivalConsequence?.presentation'
        );
    });

    test('keeps QA previews read-only', () => {
        expect(source).toContain('isCurrentEcologyReadOnly()');
        expect(source).toContain("'preview_read_only'");
        expect(source).toContain(
            'PREVIEW ONLY // No save data or field resources were changed.'
        );
        expect(gameSource).toContain("'testCurrentEcho'");
        expect(gameSource).toContain('currentEcologyPreview: true');
        expect(gameSource).toContain('save: false');
        expect(hatchingSource).toContain(
            "previewParams.has('testCurrentEcho')"
        );
    });

    test('derives Final Void network claims from canonical ecology', () => {
        expect(finalSource).toContain(
            'getCurrentEcologySnapshot?.(window.GameState)?.summary'
        );
        expect(finalSource).toContain('CURRENT // ${networkState}');
        expect(finalSource).toContain(
            'ecologyResult.networkStatus.toUpperCase()'
        );
        expect(finalSource).not.toContain(
            "const signalState = this.finalSignalReady ? 'CONNECTED' : 'GATHERING';"
        );
    });

    test('supports touch and a dedicated keyboard interaction', () => {
        expect(source).toContain('Phaser.Input.Keyboard.KeyCodes.E');
        expect(source).toContain(
            "prompt.on('pointerdown', () => this.requestCurrentEcologyInteraction());"
        );
        expect(source).toContain(
            "zone.on('pointerdown', () => this.requestCurrentEcologyInteraction());"
        );
        expect(source).toContain("'TAP TO SCAN LIVING CURRENT'");
        expect(source).toContain("'[E] SCAN LIVING CURRENT'");
        expect(source).toContain(
            'const zone = this.add.zone(x, y - 30, 240, 240)'
        );
        expect(source).toContain('this.hidePlatformerMobileControls?.();');
    });

    test('offers reversible care and extraction actions through the domain API', () => {
        expect(source).toContain(
            "const actionIds = ['observe', 'protect', 'redirect', 'siphon'];"
        );
        expect(source).toContain('ecology.recordCurrentRegionAction(');
        expect(source).toContain('this.refreshCurrentEcologyNode();');
    });

    test('teaches observation before influence and previews every consequence', () => {
        expect(source).toContain('hasObservedCurrentEcologyNode()');
        expect(source).toContain('SCAN FIRST // Observe the living rhythm');
        expect(source).toContain('SCAN REQUIRED');
        expect(source).toContain('getCurrentRegionActionPresentation(actionId)');
        expect(source).toContain('handleCurrentEcologyAction(actionId)');
        expect(gameSource).toContain('preview_echo_scan_');
    });

    test('refreshes the visible node when its guardian is restored', () => {
        expect(source).toContain(
            'this.refreshCurrentEcologyNode({ celebrate: true });'
        );
    });
});
