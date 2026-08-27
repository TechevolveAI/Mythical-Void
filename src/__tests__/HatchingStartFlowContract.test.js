const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
    path.join(__dirname, '../scenes/HatchingScene.js'),
    'utf8'
);
const smoke = fs.readFileSync(
    path.join(__dirname, '../../scripts/smoke-secondary-journeys.js'),
    'utf8'
);
const releaseSmoke = fs.readFileSync(
    path.join(__dirname, '../../scripts/run-browser-smoke.js'),
    'utf8'
);
const gameScene = fs.readFileSync(
    path.join(__dirname, '../scenes/GameScene.js'),
    'utf8'
);
const mainCss = fs.readFileSync(
    path.join(__dirname, '../styles/main.css'),
    'utf8'
);

describe('Hatching home start flow', () => {
    test('restarts immediately after persisting the first-session state', () => {
        const startFlow = source.slice(
            source.indexOf('handleStartGame() {'),
            source.indexOf('\n}\n\nexport default HatchingScene')
        );

        expect(startFlow).toContain('GameState.save();');
        expect(startFlow).toContain('this.scene.restart();');
        expect(startFlow).not.toContain('this.time.delayedCall(100');
    });

    test('gives the visible first-contact egg one reliable native activation area', () => {
        const createEggFlow = source.slice(
            source.indexOf('createEgg() {'),
            source.indexOf('\n    setupInput() {', source.indexOf('createEgg() {'))
        );
        const activationFlow = source.slice(
            source.indexOf('activateEggHatch(event)'),
            source.indexOf('\n    setupInput() {', source.indexOf('activateEggHatch(event)'))
        );

        expect(createEggFlow).toContain('this.activateEggHatch()');
        expect(createEggFlow).toContain('this.createEggHatchFallback();');
        expect(activationFlow).toContain("button.dataset.mythicalEggHatch = 'true';");
        expect(activationFlow).toContain('MobileHelpers.isMobile() || this.scale.width < 600');
        expect(activationFlow).toContain('? firstSessionFraming.tapPromptMobile');
        expect(activationFlow).toContain(': firstSessionFraming.tapPromptDesktop;');
        expect(activationFlow).toContain("button.setAttribute('aria-label', prompt);");
        expect(activationFlow).toContain('const activate = event => this.activateEggHatch(event);');
        expect(activationFlow).toContain('this.hatchingStarted ||');
        expect(activationFlow).toContain('this.creatureAppeared');
        expect(createEggFlow).toContain(
            'const inputHandoffDelayMs = this.isEggHatch ? 0 : 450;'
        );
        expect(createEggFlow).toContain('if (inputHandoffDelayMs > 0) {');
        expect(createEggFlow).toContain('this.eggHatchFallback.disabled = false;');
        expect(activationFlow).toContain('Date.now() < this.eggHatchReadyAt');
        expect(activationFlow).toContain(
            'button.disabled = Date.now() < this.eggHatchReadyAt;'
        );
        expect(source).toContain('this.removeEggHatchFallback();');
        expect(mainCss).toContain('.egg-hatch-fallback {');
        expect(mainCss).toContain('top: 45%;');
        expect(mainCss).toContain('width: clamp(150px, 22vmin, 240px);');
        expect(mainCss).toContain('background: transparent;');
        expect(mainCss).toContain('.egg-hatch-fallback:focus-visible');
        expect(gameScene).toContain('.querySelectorAll(\'[data-mythical-egg-hatch="true"]\')');
    });

    test('keeps hatch progress centred and readable on a phone', () => {
        const uiFlow = source.slice(
            source.indexOf('createUI() {'),
            source.indexOf('\n    createControlPanel() {', source.indexOf('createUI() {'))
        );

        expect(uiFlow).toContain("this.add.text(centerX, height * 0.57, '', {");
        expect(uiFlow).toContain('const progressFontSize = Math.max(18, Math.min(24, width * 0.055));');
        expect(uiFlow).toContain('wordWrap: { width: Math.max(260, width - 40) }');
        expect(uiFlow).not.toContain("this.add.text(400, 450, '', {");
    });

    test('does not depend on a fade tween to commit the Start action', () => {
        const releaseFlow = source.slice(
            source.indexOf('onStartRelease(buttonContainer'),
            source.indexOf('createFeatureCards()', source.indexOf('onStartRelease(buttonContainer'))
        );

        expect(releaseFlow).toContain('this.handleStartGame();');
        expect(releaseFlow).not.toContain('onComplete: () =>');
        expect(source).toContain('.setDepth(10000)');
        expect(source).toContain('ensureHomeStartReady()');
        expect(source).toContain('createHomeStartFallback()');
        expect(source).toContain("button.dataset.mythicalHomeStart = 'true';");
        expect(source).toContain('this.removeHomeStartFallback();');
        expect(source).toContain(
            'this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);'
        );
        const shutdown = source.slice(source.indexOf('    shutdown() {'));
        expect(shutdown).toContain('this.homeStartRecoveryTimer?.remove?.();');
        expect(shutdown).toContain('this.removeHomeStartFallback();');
        expect(source).toContain(
            "document.querySelectorAll('[data-mythical-home-start]')"
        );
        expect(source).toContain('this.removeHomeStartFallback();\n            return;');
        expect(gameScene).toContain(
            ".querySelectorAll('[data-mythical-home-start=\"true\"]')"
        );
        expect(gameScene).toContain('.forEach(element => element.remove())');
    });

    test('presents the reliable native Start action as one complete button', () => {
        expect(source).toContain('button.innerHTML = `<span aria-hidden="true">&#10022;</span>');
        expect(mainCss).toContain('width: min(90vw, 400px);');
        expect(mainCss).toContain('height: 108px;');
        expect(mainCss).toContain('@media (max-height: 500px)');
        expect(mainCss).toContain('height: 68px;');
        expect(mainCss).toContain('border-radius: 28px;');
        expect(mainCss).not.toContain('width: min(85vw, 340px);');
    });

    test('blocks a release unless real touches reach the egg across entry viewport classes', () => {
        expect(smoke).toContain('async function smokeHomeStart');
        expect(smoke).toContain("SMOKE_MODE === 'home-entry'");
        expect(smoke).toContain('scene?.egg?.active');
        expect(smoke).toContain('scene.egg.input?.enabled');
        expect(smoke).toContain('SMOKE_VIEWPORT_WIDTH');
        expect(smoke).toContain('SMOKE_VIEWPORT_HEIGHT');
        expect(smoke).toContain("['mobile-landscape', 'wide-touch'].includes(SMOKE_CASE)");
        expect(smoke).toContain('native Start fallback after canvas failure');
        expect(smoke).toContain('.setPosition(-500, -500)');
        expect(smoke).toContain('Number.POSITIVE_INFINITY');
        expect(smoke).toContain('data-mythical-home-start');
        expect(smoke).toContain('native first-contact egg action');
        expect(smoke).toContain('hatchingStarted: Boolean(scene?.hatchingStarted)');
        expect(smoke).toContain('eggActionCount: document.querySelectorAll(');
        expect(smoke).toContain('button.disabled ||');
        expect(smoke).toContain('data-mythical-egg-hatch');
        expect(smoke).toContain('first-contact egg touch to begin hatching');
        expect(smoke).toContain('progressX: scene.progressText?.x');
        expect(source).toContain('this.nextHomeStartHealthCheck = time + 500;');
        expect(releaseSmoke).toContain("smokeCase: 'phone'");
        expect(releaseSmoke).toContain("smokeCase: 'mobile-landscape'");
        expect(releaseSmoke).toContain("smokeCase: 'wide-touch'");
        expect(releaseSmoke).toContain('width: 430, height: 384');
        expect(releaseSmoke).toContain('width: 860, height: 768');
    });
});
