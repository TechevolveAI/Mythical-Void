const fs = require('fs');
const path = require('path');
const vm = require('vm');

function chainable(extra = {}) {
    const target = { ...extra };
    [
        'setDepth',
        'setScrollFactor',
        'setScale',
        'setPosition',
        'setAlpha',
        'setVisible',
        'setData',
        'setOrigin',
        'setInteractive',
        'fillStyle',
        'fillRoundedRect',
        'lineStyle',
        'strokeRoundedRect',
        'clear',
        'fillRect'
    ].forEach(method => {
        target[method] = jest.fn().mockReturnValue(target);
    });
    target.add = jest.fn().mockReturnValue(target);
    target.destroy = jest.fn();
    return target;
}

function loadNotification() {
    const filePath = path.join(__dirname, '../ui/AchievementNotification.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(
            "import { devLog } from '../utils/devLogger.js';",
            'const devLog = () => {};'
        )
        .replace('export default AchievementNotification;', 'module.exports = AchievementNotification;');
    const claimReward = jest.fn(() => ({ claimed: true }));
    const sandbox = {
        module: { exports: {} },
        exports: {},
        window: { AchievementSystem: { claimReward } },
        console,
        Math,
        Object,
        Array,
        Number,
        String,
        Boolean,
        Map,
        Set
    };
    vm.runInNewContext(source, sandbox, { filename: filePath });
    return { AchievementNotification: sandbox.module.exports, claimReward };
}

function createScene() {
    const zones = [];
    const tweenConfigs = [];
    const container = () => chainable();
    return {
        scene: {
            scale: { width: 390, height: 844 },
            cameras: { main: { zoom: 1 } },
            sys: { isActive: () => true },
            events: {
                once: jest.fn(),
                on: jest.fn(),
                off: jest.fn()
            },
            add: {
                container: jest.fn(container),
                graphics: jest.fn(() => chainable()),
                text: jest.fn(() => chainable()),
                zone: jest.fn(() => {
                    const handlers = {};
                    const zone = chainable({
                        handlers,
                        on: jest.fn((event, handler) => {
                            handlers[event] = handler;
                            return zone;
                        })
                    });
                    zones.push(zone);
                    return zone;
                })
            },
            time: {
                delayedCall: jest.fn(() => ({ destroy: jest.fn() }))
            },
            tweens: {
                add: jest.fn(config => {
                    tweenConfigs.push(config);
                    return { stop: jest.fn() };
                })
            }
        },
        zones,
        tweenConfigs
    };
}

describe('AchievementNotification', () => {
    test('grants immediately and a mobile pointer-up always dismisses the toast', () => {
        const { AchievementNotification, claimReward } = loadNotification();
        const { scene, zones, tweenConfigs } = createScene();
        const notification = new AchievementNotification(scene);

        notification.show({
            id: 'explorer',
            name: 'Explorer',
            tier: 'BRONZE',
            tierInfo: { name: 'Bronze' },
            rewards: { coins: 25 }
        });

        expect(claimReward).toHaveBeenCalledWith('explorer', 'BRONZE');
        expect(notification.blocksStory).toBe(false);
        expect(notification.isVisible).toBe(true);
        expect(zones).toHaveLength(1);

        zones[0].handlers.pointerup();
        expect(notification.closing).toBe(true);

        const exit = tweenConfigs.find(config => typeof config.onComplete === 'function');
        expect(exit).toBeDefined();
        exit.onComplete();

        expect(notification.isVisible).toBe(false);
        expect(notification.container).toBeNull();
    });

    test('caps visual backlog while granting every unlocked reward', () => {
        const { AchievementNotification, claimReward } = loadNotification();
        const { scene } = createScene();
        const notification = new AchievementNotification(scene);

        ['one', 'two', 'three', 'four'].forEach(id => notification.show({
            id,
            name: id,
            tier: 'BRONZE',
            rewards: { coins: 1 }
        }));

        expect(claimReward).toHaveBeenCalledTimes(4);
        expect(notification.queue).toHaveLength(2);
    });
});
