const fs = require('fs');
const path = require('path');

const storefront = fs.readFileSync(
    path.join(__dirname, '../site/storefront.js'),
    'utf8'
);
const metadata = fs.readFileSync(
    path.join(__dirname, '../../index.html'),
    'utf8'
);
const styles = fs.readFileSync(
    path.join(__dirname, '../site/storefront.css'),
    'utf8'
);
const projectBeacon = require('../config/project-beacon.json');
const sitemap = fs.readFileSync(
    path.join(__dirname, '../../public/sitemap.xml'),
    'utf8'
);
const pressFactSheet = fs.readFileSync(
    path.join(__dirname, '../../public/press/mythical-void-fact-sheet.txt'),
    'utf8'
);
const pressAssets = require('../../public/press/mythical-void-press-assets.json');
const gameplayManifest = require('../../public/press/gameplay/manifest.json');
const gameplayVideoManifest = require('../../public/press/gameplay-video/manifest.json');

describe('storefront Project Beacon story contract', () => {
    test('matches the implemented 2026 astronaut opening', () => {
        expect(projectBeacon.year).toBe(2026);
        expect(projectBeacon.openingPages[0].content).toContain(
            'Wanderer-77 missed its target'
        );
        expect(projectBeacon.openingPages[0].subtitle).toContain('Flight 23');
        expect(storefront).toContain('Earth sent you looking for hope.');
        expect(storefront).toContain(
            'You are the astronaut-pilot of The Wanderer-77'
        );
        expect(storefront).toContain('launched from a desperate Earth');
        expect(storefront).not.toContain('You were a scientist aboard');
    });

    test('centers first contact on intelligence, vulnerability, and trust', () => {
        expect(storefront).toContain(
            'the first alien life to trust a human'
        );
        expect(storefront).toContain(
            'It is intelligent, vulnerable'
        );
        expect(metadata).toContain(
            'Hatch a varied alien creature, explore six living realms'
        );
    });

    test('describes boss encounters as restoration instead of conquest', () => {
        expect(storefront).toContain('fighting the corruption, not the guardian');
        expect(storefront).toContain(
            'the purple corruption is the thing you reduce'
        );
        expect(storefront).toContain('restoration rather than destruction');
        expect(storefront).not.toContain('defeat their guardians');
        expect(storefront).not.toContain('Distinct realms to reclaim');
    });

    test('uses story-led illustrations for the three-part adventure', () => {
        expect(storefront).toContain('path-icon-recovery');
        expect(storefront).toContain('path-icon-clearing');
        expect(storefront).toContain('path-icon-choice');
        expect(storefront).toContain('recovery-ship');
        expect(storefront).toContain('clearing-creature');
        expect(storefront).toContain('choice-beacon');
        expect(storefront).not.toContain('aria-hidden="true">⌁</div>');
    });

    test('keeps the final responsibility unresolved', () => {
        expect(storefront).toContain(
            'decide what Project Beacon should tell Earth'
        );
        expect(storefront).toContain('decide what home means');
        expect(storefront).not.toContain('Earth is saved');
        expect(storefront).not.toContain('this world is saved');
    });

    test('tells the true father-and-son origin of the studio', () => {
        expect(storefront).toContain('A dad. His nine-year-old son.');
        expect(storefront).toContain('father-and-son project');
        expect(storefront).toContain('Kevin and his nine-year-old son');
        expect(storefront).toContain('generative AI tools');
        expect(storefront).toContain('Imagination still leads');
        expect(storefront).toContain('Children deserve care');
    });

    test('turns real genetics runs into an immersive creature-universe hero', () => {
        expect(storefront).toContain('1,000');
        expect(storefront).toContain('72');
        expect(storefront).toContain('real engine hatches explored');
        expect(storefront).toContain('A universe of creatures');
        expect(storefront).toContain('Every hatch opens a new possibility.');
        expect(storefront).not.toMatch(/\bcompanions?\b/i);
        expect(storefront).toContain(
            '/marketing/mythical-void-creature-universe-hero-v2.webp'
        );
        expect(styles).toMatch(
            /\.hero\s*\{[\s\S]*?height:\s*min\(860px,\s*100svh\)/
        );
        expect(styles).not.toMatch(
            /\.hero\s*\{[^}]*grid-template-columns:/
        );
    });

    test('publishes absolute social media assets and route-aware canonical metadata', () => {
        expect(metadata).toContain(
            'content="https://mythicalvoid.com/marketing/mythical-void-creature-universe-hero-v2.webp"'
        );
        expect(metadata).toContain(
            '<link rel="canonical" href="https://mythicalvoid.com/">'
        );
        expect(storefront).toContain('function updatePageMetadata');
        expect(storefront).toContain('link[rel="canonical"]');
        expect(storefront).toContain(
            "path: isPrivacy ? '/privacy/' : '/terms/'"
        );
        expect(storefront).toContain('WHY MYTHICAL VOID IS DIFFERENT');
        expect(storefront).toContain('Genetics with real variety');
        expect(storefront).toContain('Phaser 3');
        expect(storefront).toContain('Story moments made for your friend');
    });

    test('explains the NASA connection as a child-friendly STEM layer', () => {
        expect(storefront).toContain('Real space science');
        expect(storefront).toContain('NASA’s public space data');
        expect(storefront).toContain('space-weather signals');
        expect(storefront).toContain('See the STEM promise');
        expect(storefront).toContain('How does NASA fit into the game?');
        expect(storefront).toContain('optional learning moments');
    });

    test('does not promise contact channels before they exist', () => {
        expect(storefront).toContain('Our parent and guardian contact channel is being prepared');
        expect(storefront).toContain('Our feedback channel is being prepared now');
        expect(storefront).not.toContain('mailto:hello@mythicalvoid.com');
        expect(storefront).not.toContain('mailto:parents@mythicalvoid.com');
    });

    test('offers a privacy-safe player-led sharing path', () => {
        expect((storefront.match(/<button[^>]+data-share-game/g) || [])).toHaveLength(2);
        expect(storefront).toContain('hero-share-status');
        expect(storefront).toContain("const shareButtons = [...app.querySelectorAll('[data-share-game]')]");
        expect(storefront).toContain('data-share-label');
        expect(storefront).toContain('navigator.share');
        expect(storefront).toContain('navigator.clipboard.writeText');
        expect(storefront).toContain('https://mythicalvoid.com/');
        expect(storefront).toContain('Clean game link copied — no tracking code.');
        expect(storefront).not.toContain('utm_');
    });

    test('provides a truthful public press and creator room', () => {
        expect(storefront).toContain("path: '/press/'");
        expect(storefront).toContain('OFFICIAL PRESS & CREATOR ROOM');
        expect(storefront).toContain('Download the fact sheet');
        expect(storefront).toContain('AI-generated marketing illustration');
        expect(storefront).toContain('It is not gameplay footage.');
        expect(storefront).toContain('NASA does not endorse the game.');
        expect(storefront).toContain('Download the STEM activity');
        expect(storefront).toContain('/resources/mythical-void-stem-creature-lab.pdf');
        expect(storefront).not.toContain('Get the play-and-share card');
        expect(storefront).not.toContain('/resources/mythical-void-play-share-card.pdf');
        expect(storefront).not.toContain('Tell the Project Beacon story.');
        expect(storefront).not.toContain('/press/social/project-beacon-story-wide.png');
        expect(storefront).not.toContain('/press/social/project-beacon-story-square.png');
        expect(storefront).toContain('The public media library is being rebuilt.');
        expect(storefront).toContain('No gameplay download pack is approved.');
        expect(storefront).toContain('The creature must be visible');
        expect(pressAssets.sharingResources).toEqual(expect.arrayContaining([
            expect.objectContaining({
                kind: 'adult_led_printable_play_share_card',
                url: 'https://mythicalvoid.com/resources/mythical-void-play-share-card.pdf'
            })
        ]));
        expect(storefront).toContain('Press & creators');
        expect(sitemap).toContain('<loc>https://mythicalvoid.com/press/</loc>');
        expect(sitemap).toContain('<loc>https://mythicalvoid.com/updates/</loc>');
        expect(storefront).toContain('href="/updates/">What\'s new</a>');
        expect(pressFactSheet).toContain('PLAY THE CURRENT GAME');
        expect(pressFactSheet).toContain('father-and-son project');
        expect(pressFactSheet).not.toMatch(/\bcompanions?\b/i);
        expect(storefront).not.toContain('This is what players really see.');
        expect(storefront).toContain('/press/gameplay/manifest.json');
        expect(storefront).not.toContain('/press/gameplay-video/manifest.json');
        expect(storefront).not.toContain('IN-GAME STORY MOMENT · 3.17 SECONDS');
        expect(storefront).not.toContain('id="real-gameplay-social-video"');
        expect(storefront).not.toContain('id="creator-download-kit"');
        expect(storefront).not.toContain('REAL GAME + REAL NASA IMAGE');
        expect(pressAssets.gameplayProofManifest).toBe(
            'https://mythicalvoid.com/press/gameplay/manifest.json'
        );
        expect(pressAssets.gameplayVideoProofManifest).toBe(
            'https://mythicalvoid.com/press/gameplay-video/manifest.json'
        );
        expect(pressAssets.assets).toHaveLength(35);
        expect(pressAssets.assets).toContainEqual(expect.objectContaining({
            name: 'Mythical Void primary sharing preview',
            kind: 'branded_share_preview_with_ai_generated_marketing_illustration',
            dimensions: '1200x630'
        }));
        expect(pressAssets.assets).toContainEqual(expect.objectContaining({
            name: 'Real creature hatch reveal',
            url: 'https://mythicalvoid.com/press/gameplay/creature-cosmic-egg-reveal.png',
            kind: 'authentic_running_build_screenshot',
            state: 'withdrawn_visual_quality_failed_do_not_publish'
        }));
        expect(storefront).not.toContain('id="real-creature-hatch"');
        expect(pressAssets.assets.filter(asset => [
            'Mythical Forest phone gameplay',
            'Village Heart builder'
        ].includes(asset.name))).toEqual(expect.arrayContaining([
            expect.objectContaining({ state: 'withdrawn_visual_quality_failed_do_not_publish' }),
            expect.objectContaining({ state: 'withdrawn_visual_quality_failed_do_not_publish' })
        ]));
        expect(storefront).not.toContain('id="real-creature-range"');
        expect(storefront).not.toContain('Twelve real hatches. One running engine.');
        expect(pressAssets.mediaLibrary).toEqual(expect.objectContaining({
            state: 'withdrawn_pending_human_visual_rebuild_do_not_publish',
            defaultAssetState: 'withdrawn_visual_quality_failed_do_not_publish'
        }));
        expect(pressAssets.realCreatureShowcase).toEqual(expect.objectContaining({
            selectedFromEngineRuns: 1000,
            selectedCreatures: 12
        }));
        expect(pressAssets.assets.filter(asset => (
            asset.kind === 'authentic_running_game_renderer_export'
        ))).toHaveLength(12);
        expect(pressAssets.assets.filter(asset => (
            asset.kind === 'branded_renderer_proof_layout_with_authentic_game_sprite_exports'
        ))).toHaveLength(1);
        expect(pressAssets.authenticGameplaySocialKit).toEqual(expect.objectContaining({
            manifest: 'https://mythicalvoid.com/press/social-video/manifest.json',
            captionPack: 'https://mythicalvoid.com/press/social-video/authentic-gameplay-caption-pack.json',
            state: 'withdrawn_visual_quality_failed_do_not_publish'
        }));
        expect(pressAssets.assets.filter(asset => (
            asset.kind === 'branded_social_video_with_authentic_running_build_gameplay'
        ))).toHaveLength(3);
        expect(pressAssets.assets.filter(asset => (
            asset.kind === 'branded_social_artwork_with_authentic_gameplay_frame_and_nasa_public_image'
        ))).toHaveLength(2);
        expect(pressAssets.assets.filter(asset => (
            asset.kind === 'branded_founder_story_artwork_with_ai_marketing_background_and_authentic_gameplay_frame'
        ))).toHaveLength(2);
        expect(pressAssets.educatorResources).toHaveLength(1);
        expect(pressAssets.educatorResources[0].kind).toBe('adult_led_printable_activity');
        expect(pressAssets.educatorResources[0].disclosure).toContain('NASA does not endorse');
        expect(pressAssets.assets.filter(asset => (
            asset.kind === 'authentic_running_build_screenshot'
        ))).toHaveLength(6);
        expect(pressAssets.assets.filter(asset => (
            asset.kind === 'authentic_running_build_story_moment'
        ))).toHaveLength(1);
        expect(pressAssets.assets[0].kind).toBe('authentic_running_build_story_moment');
        expect(gameplayManifest.captures).toHaveLength(14);
        expect(gameplayManifest.captures).toContainEqual(expect.objectContaining({
            id: 'GP-013',
            publicPath: '/press/gameplay/creature-cosmic-egg-reveal.png',
            classification: 'authentic_running_build_screenshot'
        }));
        expect(gameplayManifest.captures).toContainEqual(expect.objectContaining({
            id: 'GP-014',
            publicPath: '/press/gameplay/mythical-forest-arrival-wide.png',
            classification: 'authentic_running_build_story_screenshot'
        }));
        expect(gameplayManifest.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
        expect(gameplayManifest.captureSourcePolicy).toContain(
            'Each capture has its own sourceCommit'
        );
        gameplayManifest.captures.forEach(capture => {
            expect(capture.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
        });
        expect(gameplayManifest.approvalState).toBe(
            'internal_review_required_before_public_promotion'
        );
        expect(pressAssets.restrictions).toContain(
            'Only assets labelled authentic_running_build_screenshot may be described as gameplay screenshots.'
        );
        expect(gameplayVideoManifest.asset.classification).toBe(
            'authentic_running_build_story_moment'
        );
        expect(gameplayVideoManifest.asset.durationSeconds).toBeGreaterThanOrEqual(3);
        expect(gameplayVideoManifest.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
    });
});
