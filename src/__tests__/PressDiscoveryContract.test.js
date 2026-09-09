const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const press = fs.readFileSync(path.join(root, 'public/press/index.html'), 'utf8');
const discovery = fs.readFileSync(path.join(root, 'public/discovery.js'), 'utf8');
const playBadge = fs.readFileSync(path.join(root, 'public/press/embed/mythical-void-play-badge.svg'), 'utf8');
const sitemap = fs.readFileSync(path.join(root, 'public/sitemap.xml'), 'utf8');
const netlify = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
const redirects = fs.readFileSync(path.join(root, 'public/_redirects'), 'utf8');
const visualRegister = require('../../public/press/visual-publication-register.json');
const release = require('../../docs/company/search/press-search-doorway-2026-09-08.json');
const indexNow = require('../../docs/company/search/indexnow-submission-2026-09-08-press.json');

describe('press and creator search doorway', () => {
    test('is a real static page with its own search identity', () => {
        expect(press).toContain('<title>Mythical Void Press Kit & Game Facts | Free Browser Game</title>');
        expect(press).toContain('<link rel="canonical" href="https://mythicalvoid.com/press/">');
        expect(press).toContain('<meta name="robots" content="index, follow, max-image-preview:large">');
        expect(press).toContain('"@type": "CollectionPage"');
        expect(press).toContain('"@id": "https://mythicalvoid.com/#video-game"');
        expect(press).toContain('<link rel="describedby" type="text/markdown" href="https://mythicalvoid.com/llms.txt">');
        expect(sitemap).toMatch(/<loc>https:\/\/mythicalvoid\.com\/press\/<\/loc>\s*<lastmod>2026-09-09<\/lastmod>/);
        expect(netlify).toMatch(/from = "\/press\/"\s+to = "\/press\/index\.html"\s+status = 200/);
        expect(redirects).toMatch(/^\/press\/\s+\/press\/index\.html\s+200$/m);
    });

    test('gives a creator a direct, understandable route into the real game', () => {
        expect(press).toContain('The quick way to understand Mythical Void.');
        expect(press).toContain('TRY IT BEFORE YOU WRITE');
        expect(press).toContain('follow the crash-site story, hatch and name a creature, then move together in the Sanctuary');
        expect(press).toContain('Was the first minute clear without an explanation?');
        expect((press.match(/href="\/play\/"/g) || [])).toHaveLength(6);
        expect(press).toContain('data-public-action="play"');
        expect(press).not.toContain('utm_');
    });

    test('offers only approved downloads and keeps weak media withdrawn', () => {
        expect(press).toContain('/marketing/mythical-void-emblem-v3.png');
        expect(press).toContain('/press/mythical-void-fact-sheet.txt');
        expect(press).toContain('/resources/mythical-void-stem-creature-lab.pdf');
        expect(press).toContain('/press/embed/mythical-void-play-badge.svg');
        expect(press).toContain('Add a Play button to your website.');
        expect(press).toContain('data-copy-embed="mythical-void-embed-code"');
        expect(press).toContain('https://mythicalvoid.com/play/');
        expect(press).toContain('It contains no script, tracking code or gameplay claim.');
        expect(press).toContain('src="/discovery.js?v=20260908-press-badge"');
        expect(discovery).toContain("document.querySelector('[data-copy-embed]')");
        expect(discovery).toContain('navigator.clipboard.writeText(value)');
        expect(playBadge).toContain('width="720" height="220"');
        expect(playBadge).toContain('<title id="title">Play Mythical Void</title>');
        expect(playBadge).toContain('Free browser adventure · No download or account');
        expect(playBadge).not.toContain('<script');
        expect(playBadge).not.toContain('<image');
        expect(press).toContain('No gameplay download pack is approved.');
        expect(press).not.toContain('/press/gameplay/');
        expect(press).not.toContain('/press/gameplay-video/');
        expect(press).not.toContain('/press/social-video/');
        expect(press).not.toContain('/press/creator-kit/');
    });

    test('redirects every withdrawn media link before the homepage fallback', () => {
        const fallbackIndex = redirects.indexOf('/*    /index.html   200');
        expect(fallbackIndex).toBeGreaterThan(-1);

        for (const prefix of visualRegister.withdrawnPathFamilies) {
            const route = `${prefix}*`;
            const routeIndex = redirects.indexOf(route);
            expect(routeIndex).toBeGreaterThan(-1);
            expect(routeIndex).toBeLessThan(fallbackIndex);
            expect(redirects.split('\n').find(line => line.trimStart().startsWith(route)))
                .toMatch(/\s\/press\/\s+302!\s*$/);
        }

        for (const publicPath of visualRegister.withdrawnIndividualPaths) {
            const routeIndex = redirects.indexOf(publicPath);
            expect(routeIndex).toBeGreaterThan(-1);
            expect(routeIndex).toBeLessThan(fallbackIndex);
            expect(redirects.split('\n').find(line => line.trimStart().startsWith(publicPath)))
                .toMatch(/\s\/press\/\s+302!\s*$/);
        }
    });

    test('keeps the public story and claims safe', () => {
        expect(press).toContain('father-and-son idea');
        expect(press).not.toMatch(/nine-year-old|9-year-old|\bage\s+9\b/i);
        expect(press).not.toMatch(/\bcompanions?\b/i);
        expect(press).not.toMatch(/\bsignals?\b/i);
        expect(press).not.toMatch(/every (?:hatch|creature) is unique|no two creatures|infinite unique/i);
        expect(press).toContain('NASA does not endorse Mythical Void.');
        expect(press).toContain('It is not gameplay.');
        expect(press).not.toMatch(/mailto:|@mythicalvoid\.com/i);
    });

    test('uses the shared privacy-aware website helper', () => {
        expect(press).toContain('rel="stylesheet" href="/discovery.css');
        expect(press).toContain('src="/discovery.js');
        expect(press).toContain('href="/privacy/"');
    });

    test('records the release and keeps outside actions off', () => {
        expect(release.problem).toEqual(expect.objectContaining({
            staticPagePreviouslyPresent: false,
            previousRawHtmlCanonical: 'https://mythicalvoid.com/'
        }));
        expect(release.release).toEqual(expect.objectContaining({
            staticPage: 'public/press/index.html',
            productionCommit: '270263bed94375097de87295e21978b1d540b7dc',
            productionDeployId: '6aa00e02db1f0400088e8e4b',
            productionHttpStatus: 200,
            rawHtmlTitleVerified: true,
            rawHtmlCanonicalVerified: true,
            gameplayMediaPackApproved: false,
            exactChildAgePublished: false,
            generatedHeroDisclosureVisible: true,
            nasaNonEndorsementVisible: true
        }));
        expect(release.authority).toEqual(expect.objectContaining({
            ownedWebsitePublicationAuthorized: true,
            indexNowNotificationSent: true,
            externalPostingAuthorized: false,
            creatorOutreachAuthorized: false,
            accountCreationAuthorized: false,
            paidPromotionAuthorized: false
        }));
    });

    test('records one accepted changed-page notice without claiming indexing', () => {
        expect(release.indexNow).toEqual(expect.objectContaining({
            record: 'docs/company/search/indexnow-submission-2026-09-08-press.json',
            submittedUrlCount: 1,
            accepted: true,
            httpStatus: 200,
            unchangedUrlsResubmitted: false
        }));
        expect(indexNow).toEqual(expect.objectContaining({
            urls: ['https://mythicalvoid.com/press/'],
            urlCount: 1,
            accepted: true,
            httpStatus: 200,
            unchangedSitemapUrlsResubmitted: false,
            personalDataSent: false,
            accountUsed: false,
            paidPromotionStarted: false
        }));
        expect(indexNow.meaning).toMatch(/does not prove.*crawled.*indexed.*ranked.*visited.*start a game/i);
    });
});
