const fs = require('fs');
const path = require('path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const getRegionalVictorySummary = new Function(
    read('systems/RegionalVictorySummary.js').replace(/export /g, '') + '\nreturn getRegionalVictorySummary;'
)();
const renderRegionalVictory = new Function('icons', read('ui/RegionalVictoryView.js')
    .replace(/import \{([^}]+)\} from 'lucide';/, 'const {$1} = icons;')
    .replace('export function', 'function') + '\nreturn renderRegionalVictory;')(require('lucide'));
const Panel = new Function('renderRegionalVictory', read('ui/ExpeditionDebriefPanel.js')
    .replace(/^import .*;$/gm, '').replace('export default class', 'class') + '\nreturn ExpeditionDebriefPanel;')(renderRegionalVictory);
const acknowledge = jest.fn();
const getDebrief = jest.fn(() => ({ finding: 'The forest is alive.', nextGate: { label: 'Crystal Caves' } }));
const share = jest.fn(async () => 'copied');
const Base = new Function('Phaser', 'ExpeditionDebriefPanel', 'getRegionalVictorySummary',
    'getProjectBeaconDebrief', 'acknowledgeProjectBeaconDebrief', 'shareGuardianRestoration',
    read('scenes/PlatformerLevelScene.js').replace(/^import[\s\S]*?;\s*/gm, '')
        .replace('export default PlatformerLevelScene;', 'return PlatformerLevelScene;')
)({ Scene: class {} }, Panel, getRegionalVictorySummary, getDebrief, acknowledge, share);

function receipt(overrides = {}) {
    return {
        levelId: 'mythicalForest', firstCompletion: true,
        shipPartId: 'forest_core', shipPartAwarded: true,
        coinsAwarded: 21,
        rescuedResident: { name: 'Bloom', newlyRescued: true, supportLabel: '+1 expedition energy' },
        bossPowerupReward: { name: 'Forest Guard', awarded: true, resultText: 'Blocks one hit.' },
        ...overrides
    };
}

describe('Regional victory receipt', () => {
    test('separates a rescued resident from inventory, ship and currency without inventing an egg', () => {
        const source = receipt();
        const before = JSON.stringify(source);
        const result = getRegionalVictorySummary(source);
        expect(result.rewards.map(row => row.kind)).toEqual(['resident', 'powerup', 'ship', 'coins']);
        expect(JSON.stringify(result)).not.toMatch(/egg|baby|hatch/i);
        expect(JSON.stringify(source)).toBe(before);
    });
    test.each(['mythicalForest', 'crystalCaves', 'cosmicReef', 'voidPeaks', 'auroraDepths'])(
        '%s shares a clear Sanctuary exit', levelId => {
            const summary = getRegionalVictorySummary(receipt({ levelId }));
            expect(summary.actionLabel).toBe('Return to Sanctuary');
            expect(summary.title).toBeTruthy();
        }
    );
    test('does not change the unresolved Final Void ending', () => {
        expect(getRegionalVictorySummary(receipt({ levelId: 'finalVoid' }))).toBeNull();
    });
    test('replay never claims to rescue a new resident or recover the same ship part again', () => {
        const result = getRegionalVictorySummary(receipt({ firstCompletion: false, shipPartAwarded: false,
            rescuedResident: { name: 'Bloom', newlyRescued: false } }));
        expect(result.rewards.map(row => row.kind)).toEqual(['powerup', 'coins']);
    });
    test('full inventory explains the inbox instead of claiming the power-up was packed', () => {
        const summary = getRegionalVictorySummary(receipt({ bossPowerupReward: {
            name: 'Forest Guard', awarded: true, queued: true
        } }));
        const row = summary.rewards.find(item => item.kind === 'powerup');
        expect(row.label).toBe('REWARD INBOX');
        expect(row.detail).toContain('Clear an inventory slot');
        expect(row.detail).not.toContain('Use from Pause');
    });
    test('failed award never claims ownership; installed upgrade is distinct', () => {
        const summary = getRegionalVictorySummary(receipt({ bossPowerupReward: { name: 'Guard', awarded: false },
            katanaUpgradeAwarded: true, katanaUpgrade: { name: 'Crystal Edge', description: 'Stronger strikes.' } }));
        expect(summary.rewards.find(row => row.kind === 'powerup').label).toBe('POWER-UP NOT PACKED');
        expect(summary.rewards.find(row => row.kind === 'upgrade').label).toBe('ALREADY INSTALLED');
    });
    test('keeps the initial view short while retaining useful item instructions behind a tap', () => {
        const result = getRegionalVictorySummary(receipt());
        const panel = new Panel({ onContinue: jest.fn() });
        panel.show(result);
        expect(document.querySelectorAll('.victory-loot-item')).toHaveLength(2);
        expect(document.querySelector('.victory-reward-explanation').hidden).toBe(true);
        const item = document.querySelector('[data-reward-kind="powerup"]');
        expect(item.querySelector('svg')).not.toBeNull();
        expect(item.textContent).toBe('Forest GuardIn your bag');
        item.click();
        expect(item.getAttribute('aria-expanded')).toBe('true');
        expect(document.querySelector('.victory-reward-explanation').textContent).toContain('Use from Pause > Power-ups.');
        const ship = document.querySelector('[data-reward-kind="ship"]');
        ship.click();
        expect(item.getAttribute('aria-expanded')).toBe('false');
        expect(document.querySelector('.victory-reward-explanation').textContent).toContain('install at Wanderer-77');
        ship.click();
        expect(document.querySelector('.victory-reward-explanation').hidden).toBe(true);
        panel.destroy();
    });
    test('accepts only local game texture pixels and does not need an image to continue', () => {
        for (const portraitUrl of ['https://example.com/portrait.png', 'javascript:alert(1)']) {
            const proceed = jest.fn();
            const panel = new Panel({ onContinue: proceed });
            panel.show({ ...getRegionalVictorySummary(receipt()), portraitUrl });
            expect(panel.root.querySelector('img')).toBeNull();
            panel.button.click();
            expect(proceed).toHaveBeenCalledTimes(1);
        }
        const panel = new Panel({ onContinue: jest.fn() });
        panel.show({ ...getRegionalVictorySummary(receipt()), portraitUrl: 'data:image/png;base64,AAAA' });
        const image = panel.root.querySelector('img');
        image.dispatchEvent(new Event('error'));
        expect(image.hidden).toBe(true);
        expect(panel.button.disabled).toBe(false);
        panel.destroy();
    });
});

describe('One rescue followed by one summary', () => {
    let scene;
    beforeEach(() => {
        jest.clearAllMocks();
        window.GameState = { get: jest.fn(() => [{ id: 'forest-debrief', levelId: 'mythicalForest' }]) };
        scene = Object.create(Base.prototype);
        Object.assign(scene, {
            levelCompletionResult: receipt(), input: { enabled: true },
            enterLevelCompletionState: jest.fn(), destroyGeneratedVideoReadyNotice: jest.fn(),
            getVillageCompletionCopy: () => 'Sanctuary supplies helped on this expedition.',
            presentLevelCompletion: jest.fn(), bindLevelCompletionReturn: jest.fn(),
            returnToHub: jest.fn(), replayForestBirthdayMessage: jest.fn()
        });
    });
    afterEach(() => {
        scene.regionalVictoryPanel?.destroy();
        delete window.GameState;
        delete window.LivingPortraitService;
        document.body.innerHTML = '';
    });
    test('waits for rescue, blocks gameplay input, and hands off once with installation preserved', () => {
        scene.presentLevelCompletion.mockImplementation(() => { scene.residentReleaseOpen = true; });
        scene.residentReleaseClose = jest.fn();
        scene.showRegionalVictorySummary();
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        scene.bindLevelCompletionReturn.mock.calls[0][0]();
        expect(scene.residentReleaseClose).toHaveBeenCalledTimes(1);
        scene.residentReleaseOpen = false;
        scene.pendingResidentReleaseContinuation();
        expect(scene.input.enabled).toBe(false);
        expect(acknowledge).not.toHaveBeenCalled();
        expect(scene.showRegionalVictorySummary()).toBe(false);
        const button = scene.regionalVictoryPanel.button;
        button.click(); button.click();
        expect(acknowledge).toHaveBeenCalledWith(window.GameState, 'forest-debrief');
        expect(scene.returnToHub).toHaveBeenCalledTimes(1);
        expect(scene.returnToHub).toHaveBeenCalledWith({ sanctuary: true, shipReconstructionHandoff: true, nextGateLabel: 'Crystal Caves' });
        expect(scene.input.enabled).toBe(true);
    });
    test('replay skips rescue and only acknowledges its own pending story', () => {
        window.GameState.get.mockReturnValue([{ id: 'older', levelId: 'crystalCaves' }]);
        scene.levelCompletionResult = receipt({ firstCompletion: false, shipPartAwarded: false });
        scene.showRegionalVictorySummary();
        expect([...document.querySelectorAll('button')].some(b => b.textContent === 'Invite someone')).toBe(false);
        scene.regionalVictoryPanel.button.click();
        expect(acknowledge).not.toHaveBeenCalled();
        expect(scene.returnToHub).toHaveBeenCalledWith({ sanctuary: true, shipReconstructionHandoff: false, nextGateLabel: null });
    });
    test('secret message temporarily gives Phaser input back without re-awarding or losing the summary', () => {
        scene.showRegionalVictorySummary();
        const panel = scene.regionalVictoryPanel;
        [...document.querySelectorAll('button')].find(b => b.textContent === 'Secret message').click();
        expect(scene.replayForestBirthdayMessage).toHaveBeenCalledWith([panel]);
        panel.setVisible(false);
        expect(scene.input.enabled).toBe(true);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(scene.returnToHub).not.toHaveBeenCalled();
        panel.setVisible(true);
        expect(scene.input.enabled).toBe(false);
        expect(panel.root.hidden).toBe(false);
        expect(acknowledge).not.toHaveBeenCalled();
    });
    test('optional invitation uses existing share service and keeps primary return separate', async () => {
        scene.showRegionalVictorySummary();
        const button = [...document.querySelectorAll('button')].find(b => b.textContent === 'Invite someone');
        button.click(); button.click();
        await Promise.resolve();
        expect(share).toHaveBeenCalledTimes(1);
        expect(button.textContent).toBe('Link copied');
        expect(scene.returnToHub).not.toHaveBeenCalled();
    });
    test('scene shutdown before rescue continuation cannot create an orphan dialog', () => {
        scene.presentLevelCompletion.mockImplementation(() => { scene.residentReleaseOpen = true; });
        scene.showRegionalVictorySummary();
        scene.sys = { isActive: () => false };
        scene.pendingResidentReleaseContinuation();
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
    test('uses the rescued runtime texture and existing local framing without a generation request', () => {
        const frame = {};
        const texture = { get: () => frame };
        scene.residentReleaseTexture = 'resident_bloom_v1';
        scene.textures = { exists: jest.fn(() => true), get: jest.fn(() => texture), getBase64: jest.fn() };
        window.LivingPortraitService = { captureReference: jest.fn(() => 'data:image/png;base64,AAAA') };
        scene.showRegionalVictorySummary();
        expect(scene.textures.get).toHaveBeenCalledWith('resident_bloom_v1');
        expect(window.LivingPortraitService.captureReference).toHaveBeenCalledWith({ texture, frame });
        expect(scene.regionalVictoryPanel.root.querySelector('img').src).toBe('data:image/png;base64,AAAA');
        expect(scene.textures.getBase64).not.toHaveBeenCalled();
    });
});
