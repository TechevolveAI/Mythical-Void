const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

describe('installable Mythical Void return route', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
    const client = fs.readFileSync(path.join(root, 'public/pwa-install.js'), 'utf8');

    test('opens the installed experience directly into the clean game route', () => {
        expect(manifest.id).toBe('/play/');
        expect(manifest.start_url).toBe('/play/');
        expect(manifest.start_url).not.toMatch(/[?#]/);
        expect(manifest.display).toBe('standalone');
    });

    test('has the two browser-required icon sizes and no unfinished screenshots', () => {
        expect(manifest.icons.map(icon => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
        expect(manifest.screenshots).toBeUndefined();
    });

    test('keeps installation optional, local and unmeasured', () => {
        expect(client).toContain("window.addEventListener('beforeinstallprompt'");
        expect(client).toContain("installButton.addEventListener('click'");
        expect(client).toContain('if (!ownedInstallHost) return;');
        expect(client).toContain('mythicalvoid\\.com');
        expect(client).not.toMatch(/localStorage|sessionStorage|gtag|analytics|fetch\(/i);
    });
});
