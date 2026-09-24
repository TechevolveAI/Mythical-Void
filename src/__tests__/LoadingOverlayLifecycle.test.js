const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../systems/UXEnhancements.js'), 'utf8');
const createUX = () => new Function(`${source}\nreturn window.UXEnhancements;`)();

describe('loading presentation must not block scene entry', () => {
    let ux;
    beforeEach(() => { document.body.innerHTML = ''; ux = createUX(); });
    afterEach(() => { ux.destroy(); delete window.UXEnhancements; });

    test('can show and hide before optional UX initialization', () => {
        expect(() => ux.hideLoading()).not.toThrow();
        expect(ux.showLoading('Entering the Final Void...')).toBe(true);
        const overlay = document.getElementById('loading-overlay');
        expect(overlay.querySelector('.loading-text').textContent).toBe('Entering the Final Void...');
        expect(overlay.getAttribute('aria-busy')).toBe('true');
        ux.hideLoading();
        expect(overlay.classList.contains('hidden')).toBe(true);
        expect(overlay.getAttribute('aria-busy')).toBe('false');
    });

    test('recreates a removed overlay and repairs missing contents without duplicate styles', () => {
        ux.showLoading('One');
        document.getElementById('loading-overlay').remove();
        expect(() => ux.hideLoading()).not.toThrow();
        ux.showLoading('Two');
        document.querySelector('.loading-text').remove();
        ux.showLoading('Three');
        ux.setupLoadingStates();
        expect(document.querySelectorAll('#loading-overlay')).toHaveLength(1);
        expect(document.querySelectorAll('#ux-loading-styles')).toHaveLength(1);
        expect(document.querySelector('.loading-text').textContent).toBe('Three');
        expect(document.querySelector('#loading-overlay').classList.contains('hidden')).toBe(false);
    });

    test('repeated scene-loading updates do not accumulate focus handlers or steal focus on hide', () => {
        const button = document.createElement('button');
        document.body.appendChild(button);
        button.focus();
        for (let i = 0; i < 20; i++) { ux.showLoading('Loading'); ux.hideLoading(); }
        expect(ux.manualEvents).toHaveLength(0);
        expect(document.activeElement).toBe(button);
    });

    test('late loading callbacks after teardown recover without null references', () => {
        ux.setupLoadingStates();
        ux.destroy();
        expect(() => ux.hideLoading()).not.toThrow();
        expect(ux.showLoading('Reconnecting...')).toBe(true);
        ux.hideLoading();
        expect(document.querySelectorAll('#loading-overlay')).toHaveLength(1);
    });
});

describe('page lifecycle keeps a cancelled or cached game usable', () => {
    test('beforeunload saves only; confirmed non-cached exit releases resources', () => {
        const game = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
        const listeners = {};
        const state = { save: jest.fn() };
        const cloud = { flush: jest.fn().mockResolvedValue() };
        const responsive = { destroy: jest.fn() };
        const ux = { destroy: jest.fn() };
        const visibility = { detach: jest.fn() };
        const memory = { performCleanup: jest.fn() };
        const lifecycle = game.slice(game.indexOf('// Handle page unload'), game.indexOf('// Pause only scenes'));
        new Function('window', 'GameState', 'cloudSaveManager', 'responsiveManager', 'uxEnhancements',
            'pageVisibilityController', lifecycle)({ addEventListener: (key, callback) => { listeners[key] = callback; },
            memoryManager: memory }, state, cloud, responsive, ux, visibility);
        listeners.beforeunload();
        expect(state.save).toHaveBeenCalledTimes(1);
        listeners.pagehide({ persisted: true });
        for (const fn of [memory.performCleanup, visibility.detach, responsive.destroy, ux.destroy]) {
            expect(fn).not.toHaveBeenCalled();
        }
        listeners.pagehide({ persisted: false });
        for (const fn of [memory.performCleanup, visibility.detach, responsive.destroy, ux.destroy]) {
            expect(fn).toHaveBeenCalledTimes(1);
        }
    });
});
