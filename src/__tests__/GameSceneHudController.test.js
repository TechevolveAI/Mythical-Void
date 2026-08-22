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
