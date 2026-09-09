const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('direct Play loading welcome', () => {
    const page = read('index.html');
    const entry = read('src/main.js');
    const game = read('src/game.js');

    test('appears immediately on game routes with a plain promise', () => {
        expect(page).toContain('html[data-initial-route="game"] .game-entry-loader');
        expect(page).toContain('id="loading-screen"');
        expect(page).toContain('Opening the Void…');
        expect(page).toContain('Preparing your creature and the worlds beyond.');
        expect(page).toContain('Free to play · No download · No account needed');
    });

    test('uses a real local brand mark and no invented progress percentage', () => {
        expect(page).toContain('src="/marketing/mythical-void-mark-192.png"');
        expect(page).toContain('role="status"');
        expect(page).toContain('aria-busy="true"');
        expect(page).not.toMatch(/\b(?:25|50|75|100)%\b/);
    });

    test('keeps the welcome while the game code downloads', () => {
        expect(entry).not.toContain("app.innerHTML = '<div id=\"game\"");
        expect(entry).toContain("app.querySelector('[data-static-search-entry]')?.remove()");
        expect(entry).toContain("gameHost.id = 'game'");
        expect(entry).toContain('app.appendChild(gameHost)');
    });

    test('hands over to the real Phaser canvas after boot', () => {
        expect(game).toContain("document.getElementById('loading-screen')");
        expect(game).toContain("loadingScreen.setAttribute('aria-busy', 'false')");
        expect(game).toContain("loadingScreen.style.opacity = '0'");
        expect(game).toContain('setTimeout(() => loadingScreen.remove(), 500)');
    });

    test('respects reduced-motion preferences', () => {
        expect(page).toContain('@media (prefers-reduced-motion: reduce)');
        expect(page).toContain('animation: none');
    });
});
