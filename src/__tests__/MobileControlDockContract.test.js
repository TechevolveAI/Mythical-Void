const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadLayout() {
    const filePath = path.join(__dirname, '../systems/MobileControlLayout.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/export function /g, 'function ')
        .concat('\nmodule.exports = { getMobileControlLayout };\n');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Math,
        Number
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports.getMobileControlLayout;
}

describe('shared mobile control dock', () => {
    const getMobileControlLayout = loadLayout();
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

        expect(mobileSource).toContain('getMobileControlLayout');
        expect(platformerSource).toContain('getMobileControlLayout');
        expect(platformerSource).not.toContain('arc layout above large jump button');
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
        expect(css).toContain('display: none !important');
    });
});
