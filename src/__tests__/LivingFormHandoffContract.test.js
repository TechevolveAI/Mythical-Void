const fs = require('fs');
const path = require('path');

const handoffSource = fs.readFileSync(
    path.join(__dirname, '../ui/LivingFormHandoff.js'),
    'utf8'
);
const soulSource = fs.readFileSync(
    path.join(__dirname, '../scenes/SoulRevealScene.js'),
    'utf8'
);
const cssSource = fs.readFileSync(
    path.join(__dirname, '../styles/main.css'),
    'utf8'
);
const gameSource = fs.readFileSync(
    path.join(__dirname, '../game.js'),
    'utf8'
);

describe('living form milestone handoff', () => {
    test('keeps the pixel identity private while the living portrait develops', () => {
        expect(handoffSource).not.toContain(
            'this.setArtwork(this.pixelReferenceImage'
        );
        expect(handoffSource).toContain('LIVING FORM DEVELOPING');
        expect(handoffSource).toContain(
            "source: 'protected_living_portrait'"
        );
        expect(handoffSource).toContain(
            'No personal data was sent'
        );
        expect(handoffSource).not.toContain('localStorage');
        expect(handoffSource).not.toContain('fetch(');
    });

    test('keeps generation optional and never bypasses the reveal', () => {
        expect(soulSource).toContain(
            'this.showLivingPortraitHandoff(finalName);'
        );
        expect(soulSource).not.toContain(
            'if (this.portraitPromise) {\n            this.showLivingPortraitHandoff'
        );
        expect(handoffSource).toContain('if (portraitPromise)');
        expect(soulSource).toContain(
            'this.portraitPromise.catch(() => {});'
        );
        expect(handoffSource).toContain(
            'The living portrait can be retried from the Companion Archive.'
        );
        expect(handoffSource).toContain(
            'window.LivingPortraitService?.describeError?.(error)'
        );
        expect(handoffSource).toContain(
            'Enter the Sanctuary whenever you are ready.'
        );
        expect(handoffSource).toContain(
            "window.CompanionMediaService?.recordAppearance?.(\n                    'first_living_form',"
        );
        expect(handoffSource).toContain('continueAction?.();');
    });

    test('uses one full-viewport responsive surface with safe controls', () => {
        expect(handoffSource).toContain(
            "root.setAttribute('data-testid', 'living-form-handoff')"
        );
        expect(handoffSource).toContain(
            "continueButton.setAttribute('data-testid', 'living-form-continue')"
        );
        expect(cssSource).toContain('.living-form-handoff');
        expect(cssSource).toContain('.living-form-image.is-pixel-reference');
        expect(cssSource).toContain('width: min(28%, 240px)');
        expect(cssSource).toContain('.living-form-image.is-generated-portrait');
        expect(cssSource).toContain('min-height: 48px');
        expect(cssSource).toContain('touch-action: manipulation');
        expect(cssSource).toContain('(orientation: portrait)');
        expect(cssSource).toContain(
            '(max-height: 520px) and (orientation: landscape)'
        );
        expect(gameSource).toContain(
            "portraitPreviewSpecies: 'nebulaSprite'"
        );
        expect(handoffSource).toContain(
            "continueButton.addEventListener('pointerup'"
        );
        expect(handoffSource).toContain(
            "continueButton.addEventListener('touchend'"
        );
    });

    test('includes provenance and the established channel 23 Easter egg', () => {
        expect(handoffSource).toContain('IDENTITY CHANNEL 23');
        expect(handoffSource).toContain(
            'Temporary image links are not saved.'
        );
        expect(handoffSource).toContain(
            'The pixel form remains the companion you play beside.'
        );
        expect(handoffSource).toContain('LIVING PORTRAIT RETRY AVAILABLE');
    });
});
