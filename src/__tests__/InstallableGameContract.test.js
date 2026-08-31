const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

describe('installable Mythical Void return route', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
    const client = fs.readFileSync(path.join(root, 'public/pwa-install.js'), 'utf8');
    const worker = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
    const netlify = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');

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

    test('moves stale open game clients onto the current release once', () => {
        expect(client).toContain('MYTHICAL_VOID_RELEASE_READY');
        expect(client).toContain('MYTHICAL_VOID_RELEASE_ACK');
        expect(client).toContain("navigator.serviceWorker.addEventListener('controllerchange'");
        expect(client).toContain('serviceWorkerRegistration?.update?.()');
        expect(client).toContain('window.location.reload()');
        expect(worker).toContain('releaseAcknowledgements.has(client.id)');
        expect(worker).toContain("client.visibilityState !== 'visible'");
        expect(worker).toContain('await client.navigate(client.url)');
        expect(worker).toContain('/^\\/(?:play|game)(?:\\/|$)/');
    });

    test('never serves release-control scripts as immutable assets', () => {
        expect(netlify).toMatch(/for = "\/sw\.js"[\s\S]*?Cache-Control = "no-cache, no-store, must-revalidate"/);
        expect(netlify).toMatch(/for = "\/pwa-install\.js"[\s\S]*?Cache-Control = "no-cache, no-store, must-revalidate"/);
    });
});
