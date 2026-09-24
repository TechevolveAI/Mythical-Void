const fs = require('fs');
const path = require('path');
const read = file => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');
const source = read('src/site/trailer.js');
const { trailerMarkup, mountTrailer } = new Function(`${source.replaceAll('export ', '')}; return { trailerMarkup, mountTrailer };`)();

describe('film-first homepage (website only)', () => {
    beforeEach(() => {
        document.body.innerHTML = trailerMarkup();
        jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    });
    afterEach(() => jest.restoreAllMocks());

    test('first view fetches only the local poster, never video or a third-party player', () => {
        mountTrailer(document.body);
        expect(document.querySelector('iframe, video, source, script')).toBeNull();
        const poster = document.querySelector('img');
        expect(poster.getAttribute('src')).toBe('/marketing/through-the-void-poster.jpg');
        expect(poster.getAttribute('fetchpriority')).toBe('high');
        expect(poster.width / poster.height).toBe(16 / 9);
        expect(document.body.textContent).toContain('AI-created cinematic — not gameplay.');
        expect(fs.statSync(path.join(__dirname, '../../public/marketing/through-the-void-poster.jpg')).size).toBeLessThan(400000);
    });

    test('only a deliberate click mounts a first-party, muted, inline player with captions', () => {
        mountTrailer(document.body);
        document.querySelector('[data-trailer-start]').click();
        const player = document.querySelector('video');
        expect(player.getAttribute('src')).toBe('/cinematic/through-the-void-v4-720p.mp4');
        expect(player.muted).toBe(true);
        expect(player.defaultMuted).toBe(true);
        expect(player.playsInline).toBe(true);
        expect(player.controls).toBe(true);
        expect(player.preload).toBe('none');
        expect(player.querySelector('track').srclang).toBe('en');
        expect(document.querySelector('iframe')).toBeNull();
        expect(document.activeElement).toBe(player);
        expect(document.querySelector('[data-trailer-start]')).toBeNull();
        expect(document.body.textContent).toContain('Starts muted.');
    });

    test('fallback and modified clicks retain the verified YouTube link', () => {
        mountTrailer(document.body);
        const link = document.querySelector('[data-trailer-start]');
        expect(link.href).toBe('https://www.youtube.com/watch?v=k900qJVe_uY');
        link.dispatchEvent(new MouseEvent('click', { ctrlKey: true, cancelable: true }));
        expect(document.querySelector('video')).toBeNull();
        link.click();
        expect(document.querySelectorAll('video')).toHaveLength(1);
        expect(document.querySelector('figcaption a').href).toBe(link.href);
    });

    test('support, sharing and updates no longer compete with the hero', () => {
        const storefront = read('src/site/storefront.js');
        const hero = storefront.split('<section class="hero hero-film"')[1].split('</section>')[0];
        expect(hero).toContain('trailerMarkup()');
        expect(hero).toContain("playLink('Play now — it’s free')");
        expect(hero).toContain('data-returning-player-note hidden');
        expect(hero).not.toMatch(/Cloud Save|data-share-hatch-challenge|data-latest-update|data-live-presence/);
        expect(storefront).toContain('Cloud Save is optional');
        expect(source).not.toContain('youtube-nocookie.com');
    });
});
