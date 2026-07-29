const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadController() {
    const filePath = path.join(
        __dirname,
        '../utils/PageVisibilityController.js'
    );
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source.replace(
        /export default class (\w+)/,
        'class $1'
    );
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console
    };

    vm.runInNewContext(
        `${transformed}\nmodule.exports = PageVisibilityController;`,
        sandbox,
        { filename: filePath }
    );
    return sandbox.module.exports;
}

function createScene({ active = true, paused = false } = {}) {
    let isPaused = paused;

    return {
        scene: {
            isActive: jest.fn(() => active),
            isPaused: jest.fn(() => isPaused),
            pause: jest.fn(() => {
                isPaused = true;
            }),
            resume: jest.fn(() => {
                isPaused = false;
            })
        }
    };
}

describe('PageVisibilityController', () => {
    const PageVisibilityController = loadController();

    test('resumes only scenes it paused when the tab was hidden', () => {
        const runningScene = createScene();
        const menuParentScene = createScene({ paused: true });
        const game = {
            scene: {
                getScenes: jest.fn(() => [runningScene, menuParentScene])
            }
        };
        const documentRef = { hidden: true };
        const onHidden = jest.fn();
        const controller = new PageVisibilityController({
            game,
            documentRef,
            onHidden
        });

        controller.handleVisibilityChange();

        expect(runningScene.scene.pause).toHaveBeenCalledTimes(1);
        expect(menuParentScene.scene.pause).not.toHaveBeenCalled();
        expect(onHidden).toHaveBeenCalledTimes(1);

        documentRef.hidden = false;
        controller.handleVisibilityChange();

        expect(runningScene.scene.resume).toHaveBeenCalledTimes(1);
        expect(menuParentScene.scene.resume).not.toHaveBeenCalled();
    });

    test('does not resume a scene after a visible event without a matching hide', () => {
        const pausedScene = createScene({ paused: true });
        const controller = new PageVisibilityController({
            game: {
                scene: {
                    getScenes: jest.fn(() => [pausedScene])
                }
            },
            documentRef: { hidden: false }
        });

        controller.handleVisibilityChange();

        expect(pausedScene.scene.resume).not.toHaveBeenCalled();
    });

    test('attaches and detaches one stable visibility listener', () => {
        const documentRef = {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        };
        const controller = new PageVisibilityController({ documentRef });

        expect(controller.attach()).toBe(true);
        expect(controller.attach()).toBe(false);
        expect(documentRef.addEventListener).toHaveBeenCalledTimes(1);
        expect(documentRef.addEventListener).toHaveBeenCalledWith(
            'visibilitychange',
            controller.handleVisibilityChange
        );

        controller.detach();

        expect(documentRef.removeEventListener).toHaveBeenCalledWith(
            'visibilitychange',
            controller.handleVisibilityChange
        );
    });

    test('the game bootstrap uses the guarded controller', () => {
        const gameSource = fs.readFileSync(
            path.join(__dirname, '../game.js'),
            'utf8'
        );

        expect(gameSource).toContain(
            "import PageVisibilityController from './utils/PageVisibilityController.js'"
        );
        expect(gameSource).toContain(
            'pageVisibilityController = new PageVisibilityController'
        );
        expect(gameSource).toContain('pageVisibilityController?.detach()');
        expect(gameSource).not.toContain(
            'const scenes = game.scene.getScenes(false)'
        );
    });
});
