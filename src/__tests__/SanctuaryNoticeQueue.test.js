const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load(file, name, globals = {}) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
        .replace('export default class ', 'class ')
        .replace("import Phaser from 'phaser';", '')
        .replace("import { devLog } from '../utils/devLogger.js';", 'const devLog = () => {};')
        .replace(`export default ${name};`, '')
        .concat(`\nmodule.exports = ${name};`);
    const sandbox = { module: { exports: {} }, window: {}, console, ...globals };
    vm.runInNewContext(source, sandbox);
    return sandbox.module.exports;
}

function fixture() {
    const Queue = load('systems/ui/SanctuaryNoticeQueue.js', 'SanctuaryNoticeQueue');
    const scene = { events: { on: jest.fn(), off: jest.fn(), once: jest.fn() },
        sys: { isActive: () => true } };
    let blocked = true;
    const queue = new Queue(scene, () => blocked);
    return { queue, scene, block: value => { blocked = value; queue.refresh(); } };
}

test('queues presentation while care owns the screen, then shows one notice at a time', () => {
    const { queue, block } = fixture();
    const cleanup = jest.fn();
    let finish;
    const first = jest.fn(done => { finish = done; return cleanup; });
    const second = jest.fn();
    queue.enqueue('achievement', 'care-reward', first);
    queue.enqueue('quest', 'first-contact', second);
    expect(first).not.toHaveBeenCalled();
    block(false);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    finish();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    queue.refresh();
    expect(second).toHaveBeenCalledTimes(1);
});

test('preempts an active notice and ignores callbacks from its old presentation', () => {
    const { queue, block } = fixture();
    const cleanup = jest.fn();
    const finishes = [];
    const present = jest.fn(done => { finishes.push(done); return cleanup; });
    queue.enqueue('achievement', 'care-reward', present);
    block(false);
    block(true);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(queue.active).toBeNull();
    block(false);
    expect(present).toHaveBeenCalledTimes(2);
    finishes[0]();
    expect(queue.active).not.toBeNull();
    finishes[1]();
    expect(queue.active).toBeNull();
});

test('deduplicates, bounds presentation backlog, and removes owned entries on shutdown', () => {
    const { queue, scene, block } = fixture();
    const cleanup = jest.fn();
    const present = jest.fn(() => cleanup);
    expect(queue.enqueue('reward', 'one', present, 2)).toBe(true);
    expect(queue.enqueue('reward', 'one', present, 2)).toBe(false);
    expect(queue.enqueue('reward', 'two', present, 2)).toBe(true);
    expect(queue.enqueue('reward', 'three', present, 2)).toBe(false);
    queue.enqueue('quest', 'quest-one', present);
    block(false);
    queue.cancel('reward');
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(queue.pending.map(entry => entry.key)).toEqual(['quest-one']);
    queue.refresh();
    queue.destroy();
    queue.destroy();
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(queue.active).toBeNull();
    expect(queue.pending).toHaveLength(0);
    expect(queue.enqueue('quest', 'late', present)).toBe(false);
    expect(scene.events.off).toHaveBeenCalledWith('postupdate', queue.refresh, queue);
});

test('only gameplay-focused plain Tab is left for Phaser; forms and Shift+Tab retain navigation', () => {
    const sceneWindow = { mythicalGame: { canvas: {}, scene: { isActive: () => true } } };
    const first = { focus: jest.fn() }, second = { focus: jest.fn() };
    const document = { body: {}, activeElement: null };
    const UX = load('systems/UXEnhancements.js', 'UXEnhancements', { window: sceneWindow, document });
    const ux = new UX();
    ux.announceElement = jest.fn();
    ux.focusableElements = [first, second];
    const event = { preventDefault: jest.fn() };
    document.activeElement = document.body;
    ux.handleTabNavigation(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    document.activeElement = first;
    ux.handleTabNavigation(event);
    expect(second.focus).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    ux.handleTabNavigation({ ...event, shiftKey: true });
    expect(second.focus).toHaveBeenCalledTimes(2);
    document.activeElement = document.body;
    sceneWindow.mythicalGame.scene.isActive = () => false;
    ux.handleTabNavigation(event);
    expect(first.focus).toHaveBeenCalled();
});

test('care guards the check-in, coalesces pending input, and does not paint after destruction', async () => {
    const Care = load('systems/ui/CarePanelManager.js', 'CarePanelManager');
    let blocked = true;
    let resolve;
    const scene = { isSanctuaryCareBlocked: () => blocked, scale: { width: 390 },
        sanctuaryNotices: { refresh: jest.fn() } };
    const careSystem = { performCareAction: jest.fn(() => new Promise(done => { resolve = done; })) };
    const care = new Care(scene, { careSystem });
    care.updateSignal = jest.fn();
    care.updateButtons = jest.fn();
    care.showCareEffect = jest.fn();
    expect(care.togglePanel()).toBe(false);
    await care.performAction('feed');
    expect(careSystem.performCareAction).not.toHaveBeenCalled();
    blocked = false;
    expect(care.togglePanel()).toBe(true);
    expect(scene.sanctuaryNotices.refresh).toHaveBeenCalledTimes(1);
    const pending = care.performAction('feed');
    await care.performAction('feed');
    expect(careSystem.performCareAction).toHaveBeenCalledTimes(1);
    care.destroy();
    resolve({ success: true });
    await pending;
    expect(care.showCareEffect).not.toHaveBeenCalled();
});

test('care response uses the panel rather than a world bubble over its controls', () => {
    const Care = load('systems/ui/CarePanelManager.js', 'CarePanelManager');
    const scene = { add: { text: jest.fn() } };
    const care = new Care(scene);
    care.panelVisible = true;
    care.feedbackText = { setText: jest.fn() };
    care.showCareEffect('feed', 15, 5, 2);
    care.showCreatureResponse('A happy ripple runs through its body.');
    expect(scene.add.text).not.toHaveBeenCalled();
    expect(care.feedbackText.setText).toHaveBeenLastCalledWith(
        'A happy ripple runs through its body.\n+15 joy | Forager support +3 | Heart support +2');
});

test('achievement rewards are immediate and are not granted again when presentation resumes', () => {
    const { queue, scene, block } = fixture();
    const claimReward = jest.fn(() => ({ claimed: true }));
    const Notification = load('ui/AchievementNotification.js', 'AchievementNotification', {
        window: { AchievementSystem: { claimReward } }
    });
    scene.tweens = { add: jest.fn(), killTweensOf: jest.fn() };
    scene.sanctuaryNotices = queue;
    const notification = new Notification(scene);
    notification.createNotification = jest.fn();
    notification.show({ id: 'caring_owner', tier: 'BRONZE', rewards: { coins: 25 } });
    expect(claimReward).toHaveBeenCalledTimes(1);
    expect(notification.createNotification).not.toHaveBeenCalled();
    block(false);
    expect(notification.isVisible).toBe(true);
    block(true);
    expect(notification.isVisible).toBe(false);
    block(false);
    expect(notification.createNotification).toHaveBeenCalledTimes(2);
    expect(claimReward).toHaveBeenCalledTimes(1);
    notification.destroy();
    expect(queue.active).toBeNull();
});

test('mission completion shares the queue and story briefing waits for its active notice', () => {
    const { queue, scene, block } = fixture();
    const QuestTracker = load('systems/ui/QuestTracker.js', 'QuestTracker');
    scene.sanctuaryNotices = queue;
    const tracker = new QuestTracker(scene);
    const cleanup = jest.fn();
    tracker.createQuestCompleteNotification = jest.fn(() => cleanup);
    tracker.showQuestCompleteNotification({ id: 'beacon_first_contact', type: 'story' });
    expect(tracker.createQuestCompleteNotification).not.toHaveBeenCalled();
    block(false);
    expect(tracker.createQuestCompleteNotification).toHaveBeenCalledTimes(1);
    expect(tracker.isBlockingStoryMomentActive()).toBe(true);
    tracker.destroy();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(queue.active).toBeNull();
});

test('the scene guard blocks check-in and menu modals but allows the radial Care selection', () => {
    const source = fs.readFileSync(path.join(__dirname, '../scenes/GameScene.js'), 'utf8');
    const body = source.match(/    isSanctuaryCareBlocked\(\) \{([\s\S]*?)\n    \}/)[1];
    const sceneWindow = { OnboardingManager: { isProcessing: false } };
    const blocked = vm.runInNewContext(`(function() {${body}})`, { window: sceneWindow });
    expect(blocked.call({ creatureRadialMenu: { isVisible: true } })).toBe(false);
    for (const scene of [
        { sanctuaryOnboardingPending: true }, { greetingElements: [{}] },
        { hamburgerMenu: { settingsModal: { isVisible: true } } },
        { hamburgerMenu: { cloudSaveModal: { isVisible: true } } },
        { guardianCareActivityOpen: true }, { isFieldKitModalOpen: true },
        { _isShuttingDown: true }
    ]) expect(blocked.call(scene)).toBe(true);
    sceneWindow.OnboardingManager.isProcessing = true;
    expect(blocked.call({})).toBe(true);
});
