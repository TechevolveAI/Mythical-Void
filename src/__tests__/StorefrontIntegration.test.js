const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '../..', relativePath), 'utf8');
}

describe('storefront and game deployment integration', () => {
    const storefront = read('src/site/storefront.js');
    const main = read('src/main.js');
    const envExample = read('.env.example');
    const netlify = read('netlify.toml');
    const vercel = JSON.parse(read('vercel.json'));
    const supabaseOrigin = envExample.match(
        /^VITE_SUPABASE_URL=(https:\/\/[^\s]+)$/m
    )?.[1];

    test('all storefront play actions stay on the integrated game route', () => {
        expect(storefront).toContain('href="/play/"');
        expect(storefront).not.toMatch(
            /href=["']https?:\/\/[^"']+\/(?:play|game)\/?["']/
        );
        expect(main).toContain("path === '/play'");
        expect(main).toContain("path === '/game'");
        expect(main).toContain("import('./game.js')");
    });

    test('privacy and terms routes remain inside the same SPA', () => {
        expect(storefront).toContain('href="/privacy/"');
        expect(storefront).toContain('href="/terms/"');
        expect(storefront).toContain("pagePath === '/privacy'");
        expect(storefront).toContain("pagePath === '/terms'");
        expect(storefront).toContain("path: isPrivacy ? '/privacy/' : '/terms/'");
    });

    test('describes the current browser-linked cloud-save scope accurately', () => {
        expect(storefront).toContain(
            'this release does not yet transfer progress to another device'
        );
        expect(storefront).toContain('optional browser-linked Cloud Save');
        expect(storefront).not.toContain('protect progress across supported devices');
    });

    test('keeps mobile navigation and creature selection accessible', () => {
        expect(storefront).toContain('aria-pressed="${index === 0}"');
        expect(storefront).toContain(
            "candidate.setAttribute('aria-pressed', String(selected))"
        );
        expect(storefront).toContain("event.key === 'Escape'");
        expect(storefront).toContain("document.body.classList.toggle('nav-open', open)");
        expect(storefront).toContain('!menu?.contains(event.target)');
    });

    test('Vercel rewrites deep routes but leaves built assets untouched', () => {
        expect(vercel.rewrites).toEqual(expect.arrayContaining([
            expect.objectContaining({
                destination: '/index.html'
            })
        ]));
        const rewriteSource = vercel.rewrites[0].source;
        [
            'assets/',
            'marketing/',
            'audio/',
            String.raw`sw\.js`,
            String.raw`apple-touch-icon\.png`
        ]
            .forEach(assetPath => expect(rewriteSource).toContain(assetPath));
    });

    test('every production CSP allows the configured cloud-save origin', () => {
        expect(supabaseOrigin).toBe(
            'https://mkcmdbzcihjgidjuypqe.supabase.co'
        );
        const vercelCsp = vercel.headers
            .flatMap(entry => entry.headers)
            .find(header => header.key === 'Content-Security-Policy')
            ?.value;

        expect(vercelCsp).toContain(`connect-src 'self' ${supabaseOrigin}`);
        expect(netlify).toContain(
            `connect-src 'self' ${supabaseOrigin}`
        );
    });
});
