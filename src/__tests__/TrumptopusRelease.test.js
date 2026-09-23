const fs = require('fs');
const path = require('path');
const menuSource = fs.readFileSync(path.join(__dirname, '../ui/TrumptopusSessionMenu.js'), 'utf8')
    .replace(/^import .*;$/gm, '').replace('export class', 'class');
const TrumptopusSessionMenu = new Function(`${menuSource}; return TrumptopusSessionMenu;`)();

test('production registers the selected finale and retains a save-compatible legacy route', () => {
    const source = fs.readFileSync(path.join(__dirname, '../utils/SceneLoader.js'), 'utf8');
    expect(source).toContain("finalVoidRelease.encounter === 'trumptopus'");
    expect(source).toContain("import('../scenes/levels/TrumptopusLevel.js')");
    expect(source).toContain("import('../scenes/levels/FinalVoidLevel.js')");
    expect(require('../config/final-void-release.json').encounter).toBe('trumptopus');
});

test('both real films have owner review, digest and local assets', () => {
    const { validateFinalVoidFilms } = require('../../scripts/validate-final-void-films.cjs');
    expect(validateFinalVoidFilms(path.resolve(__dirname, '../..'), { requireReady: true }))
        .toMatchObject({ ready: true, enabled: true, problems: [] });
});

test('death always offers retry or exit, not a misleading resume', () => {
    const onRetry = jest.fn(), onExit = jest.fn();
    const menu = new TrumptopusSessionMenu({ defeated: true, onRetry, onExit });
    expect(menu.buttons.map(button => button.textContent)).toEqual(['Try again', 'Return to the gates']);
    menu.buttons[0].click(); expect(onRetry).toHaveBeenCalledTimes(1);
    menu.buttons[1].click(); expect(onExit).toHaveBeenCalledTimes(1);
    menu.close(); menu.close();
    expect(document.querySelector('[role=dialog]')).toBeNull();
});

test('pause exposes power-ups and traps focus without losing its exit', () => {
    const onResume = jest.fn(), onPowerups = jest.fn();
    const menu = new TrumptopusSessionMenu({ onResume, onPowerups });
    expect(document.activeElement).toBe(menu.buttons[0]);
    menu.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(menu.buttons.at(-1));
    menu.buttons[1].click(); expect(onPowerups).toHaveBeenCalledTimes(1);
    menu.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onResume).toHaveBeenCalledTimes(1);
    menu.close();
});

test('production uses saved loadout, not the private crystal preview', () => {
    const source = fs.readFileSync(path.join(__dirname, '../dev/TrumptopusPrototypeLevel.js'), 'utf8');
    expect(source).toContain("this.productionFinale ? { ...data, levelId: 'final_void_1', biomeId: 'final_void' }");
    expect(source).toContain('this.takeDamage(1)');
    expect(source).toContain('if (this.productionFinale && this.hasShield) this.updateShield(delta);');
    expect(source).toContain('if (!this.productionFinale) window.prototypeScene = this;');
});

test('repeated resize notifications queue only one checkpoint restart', () => {
    const source = fs.readFileSync(path.join(__dirname, '../scenes/levels/TrumptopusLevel.js'), 'utf8')
        .replace(/^import .*;$/gm, '').replace(/export default /g, '').replace(/export /g, '');
    const makeRuntime = new Function('Approach', 'Campaign', 'TrumptopusSessionMenu',
        `${source}; return withCampaignRuntime;`)(class {}, class {}, TrumptopusSessionMenu);
    const shutdown = [];
    const text = {};
    for (const key of ['setOrigin', 'setScrollFactor', 'setDepth', 'setInteractive', 'on', 'setText']) {
        text[key] = () => text;
    }
    class Base {
        create() {}
    }
    const scene = new (makeRuntime(Base))('test');
    Object.assign(scene, {
        scale: { width: 390, height: 844, on: jest.fn(), off: jest.fn() },
        add: { text: () => text },
        events: { on: jest.fn(), off: jest.fn(), once: (event, callback) => shutdown.push(callback) },
        scene: { isActive: () => true, restart: jest.fn() },
        completion: { saveProgress: jest.fn() }, clearInput: jest.fn(), clearPauseMenuElements: jest.fn()
    });
    scene.create();
    scene.scale.width = 844;
    scene.scale.height = 390;
    scene.onFinaleResize();
    scene.onFinaleResize();
    expect(scene.completion.saveProgress).toHaveBeenCalledTimes(1);
    expect(scene.scene.restart).toHaveBeenCalledTimes(1);
    expect(scene.finaleResizePending).toBe(true);
    shutdown.forEach(callback => callback());
});
