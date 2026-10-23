const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../ui/LoreFragmentModal.js'), 'utf8')
    .replace("import '../styles/lore-fragment.css';", '')
    .replace('export default class ', 'class ');
const Modal = vm.runInNewContext(`${source}\nLoreFragmentModal`, { document });
const fragment = { id: 'synthetic-crash', loreTitle: 'The Crash', loreText: 'A synthetic ship log.' };
let scene, modal;
beforeEach(() => {
    scene = {
        events: { on: jest.fn(), once: jest.fn(), off: jest.fn() },
        sys: { isActive: () => true }, isSanctuaryCareBlocked: () => false,
        input: { enabled: true, keyboard: { resetKeys: jest.fn() } },
        mobileControls: { suspend: jest.fn(() => true), resume: jest.fn() },
        player: { body: { setVelocity: jest.fn() } },
        physics: { world: { isPaused: false }, pause: jest.fn(), resume: jest.fn() },
        sanctuaryNotices: { refresh: jest.fn() }, joystickX: 1, joystickY: 1
    };
    modal = new Modal(scene);
});
afterEach(() => { modal.destroy(); document.body.innerHTML = ''; });

test('story owns input, preempts notices and Continue restores controls once', () => {
    modal.show(fragment);
    expect(scene.isLoreModalOpen).toBe(true);
    expect(scene.sanctuaryNotices.refresh).toHaveBeenCalledTimes(1);
    expect(scene.input.enabled).toBe(false);
    expect(scene.physics.pause).toHaveBeenCalledTimes(1);
    expect(scene.mobileControls.suspend).toHaveBeenCalledTimes(1);
    expect(scene.joystickX).toBe(0);
    expect(document.querySelector('[role="dialog"]').textContent).toContain('The Crash');
    document.querySelector('.lore-fragment-continue').click();
    modal.close();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(scene.isLoreModalOpen).toBe(false);
    expect(scene.input.enabled).toBe(true);
    expect(scene.mobileControls.resume).toHaveBeenCalledTimes(1);
    expect(scene.physics.resume).toHaveBeenCalledTimes(1);
});

test('waits for an existing story and presents collected fragments one at a time', () => {
    scene.isSanctuaryCareBlocked = () => true;
    modal.show(fragment);
    modal.show({ ...fragment, id: 'synthetic-second' });
    expect(modal.show(fragment)).toBe(false);
    expect(modal.root).toBeNull();
    scene.isSanctuaryCareBlocked = () => false;
    modal.refresh();
    document.querySelector('.lore-fragment-close').click();
    expect(modal.root).toBeNull();
    modal.refresh();
    expect(modal.current.id).toBe('synthetic-second');
});

test('Escape dismisses and Tab keeps focus within the dialog', () => {
    modal.show(fragment);
    expect(document.activeElement.className).toBe('lore-fragment-continue');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
    expect(document.activeElement.className).toBe('lore-fragment-close');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(modal.root).toBeNull();
    expect(scene.input.enabled).toBe(true);
});

test('does not enable input, physics or controls that were already suspended', () => {
    scene.input.enabled = false;
    scene.physics.world.isPaused = true;
    scene.mobileControls.suspend.mockReturnValue(false);
    modal.show(fragment);
    modal.close();
    expect(scene.input.enabled).toBe(false);
    expect(scene.physics.resume).not.toHaveBeenCalled();
    expect(scene.mobileControls.resume).not.toHaveBeenCalled();
});

test('shutdown removes the dialog and pending work without reviving the old scene', () => {
    modal.show(fragment);
    modal.show({ ...fragment, id: 'synthetic-second' });
    modal.destroy();
    modal.destroy();
    modal.refresh();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(scene.physics.resume).not.toHaveBeenCalled();
    expect(scene.mobileControls.resume).not.toHaveBeenCalled();
    expect(modal.pending).toHaveLength(0);
    expect(modal.show(fragment)).toBe(false);
});
