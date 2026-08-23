const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('late living portrait arrival contract', () => {
    const gameScene = read('scenes/GameScene.js');
    const game = read('game.js');
    const handoff = read('ui/LivingFormHandoff.js');

    test('consumes background completion in the Sanctuary without blocking play', () => {
        expect(gameScene).toContain(
            "'creaturePortraitGenerationSucceeded',"
        );
        expect(gameScene).toContain(
            'void this.maybeShowLivingPortraitReadyNotice(record);'
        );
        expect(gameScene).toContain('LIVING FORM READY');
        expect(gameScene).toContain('TAP TO VIEW COMPANION PROFILE');
        expect(gameScene).toContain('this.openCreatureProfile();');
        expect(gameScene).toContain('timer = this.time.delayedCall(9000');
        expect(gameScene).toContain(
            'void this.maybeShowLivingPortraitReadyNotice(record);'
        );
    });

    test('recovers pre-fix server jobs for an already-hatched companion', () => {
        expect(gameScene).toContain('recoverLivingPortraitAfterArrival()');
        expect(gameScene).toContain("source: 'sanctuary_recovery'");
        expect(gameScene).toContain('portraitService.resolve(existing)');
        expect(gameScene).toContain('portraitService.prewarm?.({');
        expect(gameScene).toContain('showLivingPortraitReveal(record)');
        expect(gameScene).toContain(
            "'tutorial.livingFormSeen'"
        );
        expect(gameScene).toContain(
            'if (!preview && !livingFormSeen && this.showLivingPortraitReveal(record))'
        );
        expect(gameScene).toContain('onPortraitShown: shownRecord => {');
        expect(handoff).toContain("mode === 'late_reveal'");
        expect(handoff).toContain('CONTINUE EXPLORING');
    });

    test('shows the first successful surface once and reuses private portrait continuity', () => {
        expect(handoff).toContain("'first_living_form'");
        expect(gameScene).toContain(
            "mediaService?.hasAppearance?.('first_living_form', portrait.identityKey)"
        );
        expect(gameScene).toContain(
            "?.recordAppearance?.('first_living_form', record);"
        );
        expect(gameScene).toContain('mediaService?.ensureTexture?.(this, portrait)');
        expect(gameScene).toContain('this.destroyLivingPortraitReadyNotice();');
    });

    test('provides a non-saving local visual regression route', () => {
        expect(game).toContain(
            "urlParams.get('testPortraitReady')"
        );
        expect(game).toContain('livingPortraitReadyPreview:');
        expect(game).toContain('livingPortraitFullRevealPreview:');
        expect(gameScene).toContain('this.livingPortraitFullRevealPreview');
        expect(gameScene).toContain("imageUrl: '/marketing/nova.webp'");
        expect(gameScene).toContain("storage: 'preview'");
        expect(gameScene).toContain('this.time.delayedCall(350');
        expect(gameScene).toContain('if (!preview) {');
    });
});
