const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadDefaultClass(filePath, fallbackName) {
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace(/^import .*$/gm, '')
        .replace(/import\.meta\.env\.DEV/g, 'false')
        .replace(/export default class (\w+)/, 'class $1');

    const className = transformed.match(/class (\w+)/)?.[1] || fallbackName;
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: {},
        Date,
        Math,
        JSON,
        Object,
        Array,
        Number,
        String,
        Boolean,
        RegExp,
        Promise
    };

    const script = `${transformed}\nmodule.exports = ${className};`;
    vm.runInNewContext(script, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

const controllerPath = path.join(__dirname, '../scenes/controllers/GameSceneHudController.js');
const describeHudController = fs.existsSync(controllerPath) ? describe : describe.skip;

describeHudController('GameSceneHudController', () => {
    let GameSceneHudController;

    beforeAll(() => {
        if (!fs.existsSync(controllerPath)) {
            return;
        }

        GameSceneHudController = loadDefaultClass(controllerPath, 'GameSceneHudController');
    });

    function createVisibleElement() {
        return {
            setVisible: jest.fn().mockReturnThis(),
            setText: jest.fn().mockReturnThis(),
            setColor: jest.fn().mockReturnThis(),
            setBackgroundColor: jest.fn().mockReturnThis()
        };
    }

    function createScene() {
        return {
            statsText: createVisibleElement(),
            statBarGraphics: createVisibleElement(),
            statBarLabels: [createVisibleElement(), createVisibleElement()],
            personalityText: createVisibleElement(),
            positionText: createVisibleElement(),
            resetButton: createVisibleElement(),
            dailyBonusButton: createVisibleElement(),
            cosmicMiniMap: {
                background: createVisibleElement()
            },
            miniMapPlayerDot: createVisibleElement(),
            economyHud: {
                currencyBgImage: createVisibleElement(),
                currencyIcon: createVisibleElement(),
                currencyText: createVisibleElement()
            },
            abilityHUD: { setVisible: jest.fn() },
            carePanelManager: { setFocusMode: jest.fn() },
            controlsHintPanel: { setFocusMode: jest.fn() },
            combatButton: createVisibleElement(),
            combatBg: createVisibleElement(),
            combatText: createVisibleElement()
        };
    }

    test('hides desktop HUD elements when mobile HUD is active', () => {
        const scene = createScene();
        const controller = new GameSceneHudController(scene);

        expect(typeof controller.hideDesktopUIOnMobile).toBe('function');

        controller.hideDesktopUIOnMobile();

        expect(scene.statsText.setVisible).toHaveBeenCalledWith(false);
        expect(scene.statBarGraphics.setVisible).toHaveBeenCalledWith(false);
        expect(scene.personalityText.setVisible).toHaveBeenCalledWith(false);
        expect(scene.positionText.setVisible).toHaveBeenCalledWith(false);
        expect(scene.resetButton.setVisible).toHaveBeenCalledWith(false);
        expect(scene.dailyBonusButton.setVisible).toHaveBeenCalledWith(false);
        expect(scene.cosmicMiniMap.background.setVisible).toHaveBeenCalledWith(false);
        expect(scene.miniMapPlayerDot.setVisible).toHaveBeenCalledWith(false);
        expect(scene.economyHud.currencyBgImage.setVisible).toHaveBeenCalledWith(false);
        expect(scene.economyHud.currencyIcon.setVisible).toHaveBeenCalledWith(false);
        expect(scene.economyHud.currencyText.setVisible).toHaveBeenCalledWith(false);
        expect(scene.combatButton.setVisible).toHaveBeenCalledWith(false);
        expect(scene.combatBg.setVisible).toHaveBeenCalledWith(false);
        expect(scene.combatText.setVisible).toHaveBeenCalledWith(false);
    });

    test('gives the Village Heart sole desktop HUD focus and restores exploration context', () => {
        const scene = createScene();
        scene.mobileHUD = { isVisible: false };
        const controller = new GameSceneHudController(scene);

        expect(controller.setSanctuaryFocusMode(true)).toBe(false);
        expect(scene.cosmicMiniMap.background.setVisible).toHaveBeenLastCalledWith(false);
        expect(scene.miniMapPlayerDot.setVisible).toHaveBeenLastCalledWith(false);
        expect(scene.statBarGraphics.setVisible).toHaveBeenLastCalledWith(false);
        scene.statBarLabels.forEach(label => {
            expect(label.setVisible).toHaveBeenLastCalledWith(false);
        });
        expect(scene.economyHud.currencyBgImage.setVisible).toHaveBeenLastCalledWith(false);
        expect(scene.economyHud.currencyIcon.setVisible).toHaveBeenLastCalledWith(false);
        expect(scene.economyHud.currencyText.setVisible).toHaveBeenLastCalledWith(false);
        expect(scene.abilityHUD.setVisible).toHaveBeenLastCalledWith(false);
        expect(scene.carePanelManager.setFocusMode).toHaveBeenLastCalledWith(true);
        expect(scene.controlsHintPanel.setFocusMode).toHaveBeenLastCalledWith(true);

        expect(controller.setSanctuaryFocusMode(false)).toBe(true);
        expect(scene.cosmicMiniMap.background.setVisible).toHaveBeenLastCalledWith(true);
        expect(scene.statBarGraphics.setVisible).toHaveBeenLastCalledWith(true);
        expect(scene.abilityHUD.setVisible).toHaveBeenLastCalledWith(true);
        expect(scene.carePanelManager.setFocusMode).toHaveBeenLastCalledWith(false);
        expect(scene.controlsHintPanel.setFocusMode).toHaveBeenLastCalledWith(false);
    });

    test('does not re-show the desktop daily banner while compact HUD is active', () => {
        const scene = createScene();
        scene.mobileHUD = { isVisible: true };
        scene.careSystem = {
            getDailyLoginBonus: jest.fn(() => ({ available: true, streak: 2 }))
        };
        const controller = new GameSceneHudController(scene);

        controller.updateDailyBonusButton();

        expect(scene.dailyBonusButton.setVisible).toHaveBeenCalledWith(false);
        expect(scene.dailyBonusButton.setText).not.toHaveBeenCalled();
    });

    test('shows a compact reward cue only while a desktop gift is claimable', () => {
        const scene = createScene();
        scene.mobileHUD = { isVisible: false };
        scene.sanctuaryFocusModeActive = false;
        scene.careSystem = {
            getDailyLoginBonus: jest.fn(() => ({ available: true, streak: 4 }))
        };
        const controller = new GameSceneHudController(scene);

        controller.updateDailyBonusButton();

        expect(scene.dailyBonusButton.setVisible).toHaveBeenCalledWith(true);
        expect(scene.dailyBonusButton.setText)
            .toHaveBeenCalledWith('GIFT READY · STREAK 4');
    });

    test('suppresses the reward cue while the Village Heart owns focus', () => {
        const scene = createScene();
        scene.mobileHUD = { isVisible: false };
        scene.sanctuaryFocusModeActive = true;
        scene.careSystem = {
            getDailyLoginBonus: jest.fn(() => ({ available: true, streak: 4 }))
        };
        const controller = new GameSceneHudController(scene);

        controller.updateDailyBonusButton();

        expect(scene.dailyBonusButton.setVisible).toHaveBeenCalledWith(false);
        expect(scene.dailyBonusButton.setText).not.toHaveBeenCalled();
    });
});
