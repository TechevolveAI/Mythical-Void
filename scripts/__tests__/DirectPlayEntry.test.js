const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    buildDirectPlayHtml,
    writeDirectPlayEntry
} = require('../build-direct-play-entry.cjs');

const source = `<!doctype html><html><head>
<meta name="theme-color" content="#090711">
<meta name="description" content="Play Mythical Void free in your browser. Hatch a varied alien creature, explore six living realms, restore their guardians and decide what your mission should tell Earth.">
<meta property="og:title" content="Mythical Void | Free Creature Adventure Browser Game">
<meta property="og:description" content="Hatch a varied alien creature, explore six living realms and decide what your mission should tell Earth. Play free in your browser.">
<meta property="og:image" content="https://mythicalvoid.com/marketing/mythical-void-brand-link-card-v1.png">
<meta property="og:image:alt" content="Mythical Void brand art, not gameplay">
<meta property="og:url" content="https://mythicalvoid.com/">
<meta name="twitter:title" content="Mythical Void | Free Creature Adventure Browser Game">
<meta name="twitter:description" content="Hatch a varied alien creature, explore six living realms and decide what your mission should tell Earth. Play free in your browser.">
<link rel="canonical" href="https://mythicalvoid.com/">
<meta name="mythical-void-release" content="123456">
<title>Mythical Void | Free Creature Adventure Browser Game</title>
<script type="application/ld+json">{"@type":"VideoGame","mainEntityOfPage": { "@id": "https://mythicalvoid.com/#website" }}</script>
</head><body><h1>Opening the Void…</h1><p class="game-entry-loader__copy">Preparing your creature and the worlds beyond.</p><script type="module" src="/src/main.js"></script></body></html>`;

describe('direct Play entry builder', () => {
    test('keeps the real game shell while giving /play/ its own public identity', () => {
        const output = buildDirectPlayHtml(source);
        expect(output).toContain('<link rel="canonical" href="https://mythicalvoid.com/play/">');
        expect(output).toContain('<meta property="og:url" content="https://mythicalvoid.com/play/">');
        expect(output).toContain('<meta name="mythical-entry" content="direct-play">');
        expect(output).toContain('<title>Play Mythical Void Free | Alien Creature Browser Game</title>');
        expect(output).toContain('<meta name="description" content="Start Mythical Void free in your browser.');
        expect(output).toContain('"mainEntityOfPage": { "@id": "https://mythicalvoid.com/play/" }');
        expect(output).toContain('<h1>Play Mythical Void</h1>');
        expect(output).toContain('Hatch an alien creature and begin your journey through six strange worlds.');
        expect(output).toContain('/marketing/mythical-void-brand-link-card-v1.png');
        expect(output).toContain('brand art, not gameplay');
        expect(output).toContain('<script type="module" src="/src/main.js"></script>');
        expect(output).not.toContain('__BUILD_TIMESTAMP__');
    });

    test('writes a directory-index entry that static hosts serve at /play/', () => {
        const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mythical-direct-play-'));
        fs.writeFileSync(path.join(distDir, 'index.html'), source);
        const result = writeDirectPlayEntry(distDir);
        expect(result.outputPath).toBe(path.join(distDir, 'play', 'index.html'));
        expect(fs.readFileSync(result.outputPath, 'utf8')).toContain(
            '<meta property="og:url" content="https://mythicalvoid.com/play/">'
        );
    });

    test('fails closed instead of emitting an ambiguous page', () => {
        expect(() => buildDirectPlayHtml('<html></html>')).toThrow(
            'Built homepage metadata anchors are missing'
        );
    });

    test('fails closed if the homepage copy drifts before direct Play can be made distinct', () => {
        expect(() => buildDirectPlayHtml(source.replace('Opening the Void…', 'Loading…'))).toThrow(
            'Built homepage metadata anchors are missing'
        );
    });
});
