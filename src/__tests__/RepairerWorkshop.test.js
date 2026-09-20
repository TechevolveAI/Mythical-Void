const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load(relative, names, extra = {}) {
    const file = path.join(__dirname, '..', relative);
    const source = fs.readFileSync(file, 'utf8')
        .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '')
        .replace(/export default class /g, 'class ')
        .replace(/export (const|function) /g, '$1 ')
        + `\nmodule.exports = { ${names.join(', ')} };`;
    const context = { module: { exports: {} }, console, window, document, ...extra };
    vm.runInNewContext(source, context, { filename: file });
    return context.module.exports;
}

const fieldKit = load('systems/ProjectBeaconFieldKit.js', [
    'getProjectBeaconKatanaCombatProfile', 'PROJECT_BEACON_KATANA_UPGRADES'
]);
const workshop = load('systems/RepairerWorkshop.js', [
    'getRepairerWorkshopSnapshot', 'getRepairerPracticeStrike', 'REPAIRER_PORTRAIT'
], { ...fieldKit, bossConfigs: require('../config/bosses.json') });

function state(recovered = true, upgrades = []) {
    const data = {
        'story.projectBeacon.fieldKit': { recovered, katana: { installedUpgrades: upgrades } },
        'story.projectBeacon.fieldKit.katana.installedUpgrades': upgrades,
        'inventory.items': [{ id: 'energy_crystal', quantity: 2 }, { id: 'energy_crystal', quantity: 1 }],
        'inventory.pendingBossRewards': [{ id: 'crystal_shield', quantity: 1 }]
    };
    return { data, get: jest.fn(key => data[key]), set: jest.fn(), save: jest.fn() };
}

describe('Repairer equipment and rewards', () => {
    test('shows only canonical installed upgrades, including older string records', () => {
        const gameState = state(true, ['crystal_edge', { id: 'aurora_guard' }, { id: 'unknown' }]);
        const before = JSON.stringify(gameState.data);
        const snapshot = workshop.getRepairerWorkshopSnapshot(gameState);
        expect(snapshot.upgrades.map(u => u.installed)).toEqual([true, true]);
        expect(snapshot.combat).toMatchObject({ meleeDamage: 3, enemyMeleeRange: 85, guardCharges: 1 });
        expect(snapshot.summary).toBe('2 permanent upgrades fitted');
        expect(JSON.stringify(gameState.data)).toBe(before);
        expect(gameState.set).not.toHaveBeenCalled();
        expect(gameState.save).not.toHaveBeenCalled();
    });

    test('unrecovered and empty saves cannot offer weapon practice or invent rewards', () => {
        const snapshot = workshop.getRepairerWorkshopSnapshot(state(false));
        expect(snapshot.recovered).toBe(false);
        expect(snapshot.upgrades.every(u => !u.installed)).toBe(true);
        expect(snapshot.greeting).toContain('crash site');
        expect(workshop.getRepairerWorkshopSnapshot(null).recovered).toBe(false);
    });

    test('distinguishes items in bag from guaranteed rewards pending bag space', () => {
        const snapshot = workshop.getRepairerWorkshopSnapshot(state());
        expect(snapshot.supplies.find(s => s.id === 'energy_crystal')).toMatchObject({ quantity: 3, pending: 0 });
        expect(snapshot.supplies.find(s => s.id === 'crystal_shield')).toMatchObject({ quantity: 0, pending: 1 });
        expect(snapshot.supplies).toHaveLength(6);
    });

    test('practice uses real damage and reach with no progress or inventory writes', () => {
        const base = fieldKit.getProjectBeaconKatanaCombatProfile(state());
        const crystal = fieldKit.getProjectBeaconKatanaCombatProfile(state(true, ['crystal_edge']));
        expect(workshop.getRepairerPracticeStrike(base, 56, 6)).toEqual({ hit: true, damage: 2, health: 4 });
        expect(workshop.getRepairerPracticeStrike(base, 80, 6).hit).toBe(false);
        expect(workshop.getRepairerPracticeStrike(crystal, 80, 6)).toEqual({ hit: true, damage: 3, health: 3 });
        expect(workshop.getRepairerPracticeStrike(crystal, 80, 1).health).toBe(0);
        expect(workshop.getRepairerPracticeStrike(crystal, NaN, 6).hit).toBe(false);
    });
});

describe('Repairer workbench lifecycle', () => {
    let Workbench, scene, panel;
    beforeEach(() => {
        window.GameState = state(true, ['crystal_edge']);
        ({ RepairerWorkbench: Workbench } = load('ui/RepairerWorkbench.js', ['RepairerWorkbench'], {
            ...workshop,
            getKatanaArtifactPresentation: () => ({ imageUrl: '/game/artifacts/earth-field-katana.webp' }),
            RepairerPractice: class {
                constructor(_scene, _snapshot, onClose) { this.onClose = onClose; }
                destroy(notify) { if (notify) this.onClose(); }
            }
        }));
        scene = { input: { enabled: true } };
        panel = new Workbench(scene, { loadActor: async () => class {} });
    });
    afterEach(() => { panel.destroy(); document.body.innerHTML = ''; delete window.GameState; });

    test('opens once, keeps a close control, restores input/focus and cleans up twice safely', () => {
        const opener = document.createElement('button');
        document.body.append(opener); opener.focus();
        expect(panel.show()).toBe(true);
        expect(panel.show()).toBe(false);
        expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
        expect(document.activeElement).toBe(panel.closeButton);
        expect(scene.input.enabled).toBe(false);
        panel.closeButton.click();
        expect(scene.input.enabled).toBe(true);
        expect(document.activeElement).toBe(opener);
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        panel.destroy();
    });

    test('never enables previously disabled scene input and permits Escape', () => {
        scene.input.enabled = false;
        panel.show();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(scene.input.enabled).toBe(false);
        expect(panel.root).toBeNull();
    });

    test('focus stays inside the dialog', () => {
        panel.show();
        panel.closeButton.focus();
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
        window.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement.tagName).toBe('SUMMARY');
    });

    test('unrecovered kit disables practice without hiding supplies or the exit', () => {
        window.GameState = state(false);
        panel.show();
        expect(panel.tryButton.disabled).toBe(true);
        expect(panel.root.textContent).toContain('Browse supplies');
        panel.startPractice();
        expect(panel.practice).toBeUndefined();
    });

    test('returns from practice and destroys it during shutdown without save changes', async () => {
        panel.show(); await panel.startPractice();
        expect(panel.root.hidden).toBe(true);
        expect(scene.input.enabled).toBe(true);
        panel.practice.destroy(true);
        expect(panel.root.hidden).toBe(false);
        expect(scene.input.enabled).toBe(false);
        await panel.startPractice(); panel.destroy();
        expect(scene.input.enabled).toBe(true);
        expect(window.GameState.set).not.toHaveBeenCalled();
    });

    test('late loading cannot reopen a closed bench or enable scene input', async () => {
        let finish;
        panel.loadActor = () => new Promise(resolve => { finish = resolve; });
        panel.show();
        const pending = panel.startPractice();
        panel.destroy(); scene.input.enabled = false;
        finish(class {}); await pending;
        expect(panel.practice).toBeNull();
        expect(scene.input.enabled).toBe(false);
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    test('practice loading failure keeps the exit and equipment available', async () => {
        panel.loadActor = async () => { throw Error('unavailable'); };
        panel.show(); await panel.startPractice();
        expect(panel.practiceStatus.textContent).toContain('Your fitted upgrades still work');
        expect(panel.root.hidden).toBe(false);
        expect(panel.tryButton.disabled).toBe(false);
        panel.closeButton.click();
        expect(scene.input.enabled).toBe(true);
    });

    test('missing portrait does not block rewards, supplies or closing', () => {
        panel.show();
        const portrait = panel.root.querySelector('.repairer-portrait');
        portrait.dispatchEvent(new Event('error'));
        expect(portrait.hidden).toBe(true);
        expect(panel.root.textContent).toContain('Resonant Edge');
        panel.closeButton.click();
        expect(panel.root).toBeNull();
    });
});
