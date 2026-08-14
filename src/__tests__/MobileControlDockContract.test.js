const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadControlMath() {
    const filePath = path.join(__dirname, '../systems/MobileControlLayout.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/export function /g, 'function ')
        .concat('\nmodule.exports = { getMobileControlLayout, getMobileInteractionPromptLayout, getCampaignObjectiveLayout, getJoystickVector };\n');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Math,
        Number
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('shared mobile control dock', () => {
    const {
        getMobileControlLayout,
        getMobileInteractionPromptLayout,
        getCampaignObjectiveLayout,
        getJoystickVector
    } = loadControlMath();
    const viewports = [
        [320, 568],
        [375, 667],
        [390, 844],
        [430, 932]
    ];

    test.each(viewports)('keeps every control inside %ix%i', (width, height) => {
        const safeArea = { top: 47, right: 0, bottom: 34, left: 0 };
        const layout = getMobileControlLayout({ width, height, safeArea });
        const actionRadius = layout.primarySize / 2;

        expect(layout.dockTop).toBeGreaterThan(0);
        expect(layout.joystick.y - layout.joystick.radius)
            .toBeGreaterThanOrEqual(layout.dockTop);
        expect(layout.joystick.y + layout.joystick.radius)
            .toBeLessThanOrEqual(layout.dockBottom);
        expect(layout.actions.leftX - actionRadius).toBeGreaterThanOrEqual(0);
        expect(layout.actions.rightX + actionRadius).toBeLessThanOrEqual(width);
        expect(layout.actions.topY - actionRadius)
            .toBeGreaterThanOrEqual(layout.dockTop);
        expect(layout.actions.bottomY + actionRadius)
            .toBeLessThanOrEqual(layout.dockBottom);
        expect(layout.joystick.zoneHeight).toBe(layout.dockHeight);
        expect(layout.joystick.zoneWidth).toBeLessThan(
            layout.actions.leftX - actionRadius
        );
    });

    test.each(viewports)('keeps the interaction prompt above the dock at %ix%i', (
        width,
        height
    ) => {
        const safeArea = { top: 47, right: 0, bottom: 34, left: 0 };
        const prompt = getMobileInteractionPromptLayout({
            width,
            height,
            safeArea
        });

        expect(prompt.y).toBeLessThan(prompt.dockTop);
        expect(prompt.maxWidth).toBeLessThanOrEqual(width);
        expect(prompt.maxWidth).toBeGreaterThanOrEqual(180);
        expect(prompt.originY).toBe(1);
    });

    test.each(viewports)('gives objectives a bounded portrait ribbon at %ix%i', (
        width,
        height
    ) => {
        const safeArea = { top: 47, right: 0, bottom: 34, left: 0 };
        const objective = getCampaignObjectiveLayout({
            width,
            height,
            safeArea
        });
        const panelWidth = objective.maxWidth + 20;
        const left = objective.x - panelWidth * objective.originX;
        const right = left + panelWidth;

        expect(objective.mode).toBe('portrait');
        expect(objective.align).toBe('center');
        expect(objective.y).toBeGreaterThanOrEqual(safeArea.top + 76);
        expect(left).toBeGreaterThanOrEqual(safeArea.left);
        expect(right).toBeLessThanOrEqual(width - safeArea.right);
    });

    test.each([
        [844, 390],
        [932, 430]
    ])('keeps the landscape dock inside %ix%i', (width, height) => {
        const safeArea = { top: 0, right: 44, bottom: 21, left: 44 };
        const layout = getMobileControlLayout({ width, height, safeArea });

        expect(layout.dockTop).toBeGreaterThan(0);
        expect(layout.joystick.x - layout.joystick.radius)
            .toBeGreaterThanOrEqual(safeArea.left);
        expect(layout.actions.rightX + layout.primarySize / 2)
            .toBeLessThanOrEqual(width - safeArea.right);
        expect(layout.actions.bottomY + layout.primarySize / 2)
            .toBeLessThanOrEqual(height - safeArea.bottom);

        const prompt = getMobileInteractionPromptLayout({
            width,
            height,
            safeArea
        });
        expect(prompt.y).toBeLessThan(prompt.dockTop);

        const objective = getCampaignObjectiveLayout({
            width,
            height,
            safeArea
        });
        expect(objective.mode).toBe('landscape');
        expect(objective.x).toBeLessThanOrEqual(width - safeArea.right);
        expect(objective.maxWidth).toBeLessThan(width / 2);
    });

    test.each([
        ['up', 0, -50, 0, -1],
        ['down', 0, 50, 0, 1],
        ['left', -50, 0, -1, 0],
        ['right', 50, 0, 1, 0],
        ['up-left', -50, -50, -1, -1],
        ['up-right', 50, -50, 1, -1],
        ['down-left', -50, 50, -1, 1],
        ['down-right', 50, 50, 1, 1]
    ])('maps %s touches to the correct movement signs', (
        direction,
        offsetX,
        offsetY,
        expectedX,
        expectedY
    ) => {
        const vector = getJoystickVector({
            pointerX: 100 + offsetX,
            pointerY: 100 + offsetY,
            centerX: 100,
            centerY: 100,
            maxDistance: 50,
            deadZone: 0.15
        });

        expect(Math.sign(vector.x)).toBe(expectedX);
        expect(Math.sign(vector.y)).toBe(expectedY);
        expect(Math.hypot(vector.x, vector.y)).toBeCloseTo(1, 6);
    });

    test('a lower-pad touch immediately produces downward movement', () => {
        const vector = getJoystickVector({
            pointerX: 100,
            pointerY: 125,
            centerX: 100,
            centerY: 100,
            maxDistance: 50,
            deadZone: 0.15
        });

        expect(vector.x).toBe(0);
        expect(vector.y).toBeGreaterThan(0.4);
        expect(vector.thumbY).toBe(125);
    });

    test('the center dead zone prevents accidental movement', () => {
        const vector = getJoystickVector({
            pointerX: 103,
            pointerY: 104,
            centerX: 100,
            centerY: 100,
            maxDistance: 50,
            deadZone: 0.15
        });

        expect(vector.x).toBe(0);
        expect(vector.y).toBe(0);
    });

    test('both gameplay modes consume the shared geometry', () => {
        const mobileSource = fs.readFileSync(
            path.join(__dirname, '../systems/MobileControls.js'),
            'utf8'
        );
        const platformerSource = fs.readFileSync(
            path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
            'utf8'
        );
        const responsiveSource = fs.readFileSync(
            path.join(__dirname, '../systems/ResponsiveManager.js'),
            'utf8'
        );

        expect(mobileSource).toContain('getMobileControlLayout');
        expect(mobileSource).toContain('getJoystickVector');
        expect(mobileSource).toContain('setupCanvasJoystickInput');
        expect(mobileSource).toContain('canvas.setPointerCapture?.(event.pointerId)');
        expect(mobileSource).toContain("canvas.addEventListener('pointerdown'");
        expect(mobileSource).toContain('const captureOptions = { capture: true, passive: false }');
        expect(mobileSource).toContain('this.minimumFlickDuration = 140');
        expect(mobileSource).toContain('this.lastJoystickMagnitude > 0.1');
        expect(mobileSource).not.toContain("joystickZone.on('pointerdown'");
        expect(mobileSource).not.toContain("joystickZone.on('drag'");
        expect(mobileSource).toContain("addEventListener('touchend'");
        expect(mobileSource).toContain("window.addEventListener('blur'");
        expect(mobileSource).toContain("window.addEventListener('pagehide'");
        expect(mobileSource).toContain("'visibilitychange'");
        expect(platformerSource).toContain('getMobileControlLayout');
        expect(platformerSource).toContain('getCampaignObjectiveLayout');
        expect(platformerSource).toContain("this.scale?.on?.('resize', this.layoutCampaignObjectiveDisplay, this)");
        expect(platformerSource).toContain("this.scale?.off?.('resize', this.layoutCampaignObjectiveDisplay, this)");
        expect(platformerSource).toContain("this.scale?.on?.('resize', this.handlePlatformerMobileResize, this)");
        expect(platformerSource).toContain("this.scale?.off?.('resize', this.handlePlatformerMobileResize, this)");
        expect(platformerSource).toContain('const controlsWereVisible = this.platformerControlsVisible === true');
        expect(platformerSource).toContain('this.destroyPlatformerMobileControls()');
        expect(platformerSource).toContain('this.mobileControlZoneHeight = layout.dockHeight + safeArea.bottom');
        expect(platformerSource).toContain('this.platformerPreviewSize');
        expect(platformerSource).toContain("].includes('mobile')");
        expect(platformerSource).not.toContain('arc layout above large jump button');
        expect(responsiveSource).not.toContain('setupTouchToMouse');
        expect(responsiveSource).not.toContain("new MouseEvent('mousedown'");
        expect(responsiveSource).not.toContain("new MouseEvent('mousemove'");
        expect(responsiveSource).not.toContain("new MouseEvent('mouseup'");
    });

    test('all campaign levels use the shared responsive objective display', () => {
        const levelFiles = [
            'MythicalForestLevel.js',
            'CrystalCavesLevel.js',
            'ReefLevel.js',
            'VoidPeaksLevel.js',
            'AuroraDepthsLevel.js',
            'FinalVoidLevel.js'
        ];

        levelFiles.forEach((fileName) => {
            const source = fs.readFileSync(
                path.join(__dirname, '../scenes/levels', fileName),
                'utf8'
            );
            expect(source).toContain('this.createCampaignObjectiveDisplay(');
            expect(source).not.toContain('const isShortLandscape');
        });
    });

    test('the sanctuary camera reserves room above the mobile control dock', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../scenes/GameScene.js'),
            'utf8'
        );

        expect(gameSource).toContain('applyMobileCameraBounds');
        expect(gameSource).toContain('layout.dockHeight + playerClearance');
        expect(gameSource).toContain('this.worldHeight + reservedWorldHeight');
        expect(gameSource).toContain("this.scale.on('resize', this.mobileCameraResizeHandler)");
        expect(gameSource).toContain("this.scale?.off?.('resize', this.mobileCameraResizeHandler)");
        expect(gameSource).toContain(".replace(/^\\s*Press SPACE\\s*·\\s*/i, 'Tap ✋ · ')");
        expect(gameSource).toContain('if (isProximityPrompt) return;');
        expect(gameSource).toContain('createInteractionPromptPreview()');
    });

    test('story and tutorial modals suspend controls and own pointer routing', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../scenes/GameScene.js'),
            'utf8'
        );
        const tutorialSource = fs.readFileSync(
            path.join(__dirname, '../ui/ControlsTutorialOverlay.js'),
            'utf8'
        );

        expect(gameSource).toContain('this.mobileControls?.suspend?.()');
        expect(gameSource).toContain('this.mobileControls?.resume?.()');
        expect(gameSource).toContain('const inputShield = this.add.zone');
        expect(gameSource).toContain('.setDepth(12004)');
        expect(tutorialSource).toContain('this.scene.mobileControls?.suspend?.()');
        expect(tutorialSource).toContain('this.scene.mobileControls?.resume?.()');
    });

    test('safe-area CSS variables evaluate browser environment insets', () => {
        const css = fs.readFileSync(
            path.join(__dirname, '../styles/main.css'),
            'utf8'
        );
        expect(css).toContain('--sab: env(safe-area-inset-bottom, 0px)');
        expect(css).toContain('height: 100dvh');
        expect(css).toContain("iframe[title='Netlify Drawer']");
        expect(css).toContain("iframe[src*='app.netlify.com/cdp/']");
        expect(css).toContain('#app + div:not([id]):not([class])');
        expect(css).toContain('display: none !important');
    });
});
