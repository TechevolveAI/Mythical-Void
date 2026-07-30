const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
    path.join(__dirname, '../scenes/SoulRevealScene.js'),
    'utf8'
);

describe('Soul Reveal naming input', () => {
    test('uses a visible native field that mobile browsers can focus directly', () => {
        expect(source).toContain("this.htmlInput.type = 'text'");
        expect(source).toContain("this.htmlInput.inputMode = 'text'");
        expect(source).toContain("this.htmlInput.enterKeyHint = 'done'");
        expect(source).toContain("this.htmlInput.setAttribute('data-testid', 'creature-name-input')");
        expect(source).toContain('this.add.dom(');
        expect(source).toContain("opacity: '1'");
        expect(source).toContain("pointerEvents: 'auto'");
        expect(source).not.toContain("this.htmlInput.style.opacity = '0.01'");
        expect(source).not.toContain('document.body.appendChild(this.htmlInput)');
    });

    test('keeps input and submission targets at mobile-safe sizes', () => {
        expect(source).toContain('const inputHeight = 46');
        expect(source).toContain('buttonHeight: 48');
        expect(source).toContain('this.nameInput.trim()');
        expect(source).toContain('this.htmlInput?.focus()');
    });

    test('provides a local visual QA route', () => {
        const game = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );
        const hatching = fs.readFileSync(
            path.join(__dirname, '../scenes/HatchingScene.js'),
            'utf8'
        );

        expect(game).toContain("urlParams.has('testSoulReveal')");
        expect(game).toContain("game.scene.start('SoulRevealScene')");
        expect(hatching).toContain("previewParams.has('testSoulReveal')");
    });
});
