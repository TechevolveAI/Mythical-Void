const fs = require('fs');
const path = require('path');

const videoConfig = require('../config/companion-video-moments.json');
const videoFunction = require('../../netlify/lib/generate-companion-video-core.cjs');

describe('creature media privacy and prompt contract', () => {
    const portraitClient = fs.readFileSync(
        path.join(__dirname, '../systems/LivingPortraitService.js'),
        'utf8'
    );
    const portraitServer = fs.readFileSync(
        path.join(__dirname, '../../netlify/lib/generate-ai-art-core.cjs'),
        'utf8'
    );
    const videoServer = fs.readFileSync(
        path.join(__dirname, '../../netlify/lib/generate-companion-video-core.cjs'),
        'utf8'
    );
    const migration = fs.readFileSync(
        path.join(
            __dirname,
            '../../supabase/migrations/20260908000100_creature_media_all_ages_privacy_boundary.sql'
        ),
        'utf8'
    );
    const gameBootstrap = fs.readFileSync(
        path.join(__dirname, '../game.js'),
        'utf8'
    );
    const archive = fs.readFileSync(
        path.join(__dirname, '../systems/CompanionIdentityArchive.js'),
        'utf8'
    );
    const sanctuary = fs.readFileSync(
        path.join(__dirname, '../scenes/GameScene.js'),
        'utf8'
    );
    const platformer = fs.readFileSync(
        path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
        'utf8'
    );
    const productionPortraitSmoke = fs.readFileSync(
        path.join(__dirname, '../../scripts/smoke-living-portrait-production.js'),
        'utf8'
    );
    const productionVideoSmoke = fs.readFileSync(
        path.join(__dirname, '../../scripts/smoke-companion-video-production.js'),
        'utf8'
    );

    test('defines the only fields allowed to cross the model boundary', () => {
        expect(videoConfig.providerDataContract.allowed).toEqual([
            'synthetic_creature_image',
            'bounded_creature_stage',
            'developer_authored_scene_prompt'
        ]);
        expect(videoConfig.providerDataContract.prohibited).toEqual(
            expect.arrayContaining([
                'player_name',
                'creature_name',
                'account_id',
                'user_id',
                'age_or_age_band',
                'location',
                'voice',
                'player_photo',
                'free_text',
                'save_history',
                'friend_data'
            ])
        );
    });

    test('keeps age out of portrait requests and server eligibility', () => {
        const requestBlock = portraitClient.slice(
            portraitClient.indexOf("'/.netlify/functions/generate-ai-art'"),
            portraitClient.indexOf('job.initialResponseMs')
        );
        expect(requestBlock).not.toContain('ageGroup');
        expect(portraitServer).not.toContain('ALLOWED_AGE_GROUPS');
        expect(portraitServer).not.toContain('player_privacy_profiles');
        expect(videoServer).not.toContain('player_privacy_profiles');
        expect(productionPortraitSmoke).not.toContain("ageGroup: 'age_18_plus'");
        expect(productionVideoSmoke).not.toContain('ageGroup');
        expect(productionVideoSmoke).not.toContain('playerName');
        expect(productionVideoSmoke).not.toContain('creatureName');
    });

    test('keeps creature-media authentication independent from Cloud Save eligibility', () => {
        expect(gameBootstrap).toContain('window.CreatureMediaClient = client');
        expect(portraitClient).toContain(
            'window.CreatureMediaClient || window.CloudSave?.client'
        );
    });

    test('uses a scoped anonymous owner for reservations without exposing it', () => {
        expect(migration).toContain('v_user_id uuid := auth.uid()');
        expect(migration).toContain('to authenticated');
        expect(migration).not.toContain("profile.age_group in");
        expect(migration).toContain(
            'drop function if exists public.reserve_creature_portrait_job('
        );
        expect(migration).toContain(
            'drop function if exists public.reserve_companion_video_job('
        );
        expect(migration).not.toContain('p_user_id');
        expect(migration).toContain('counts_toward_daily_limit = false');
        expect(videoServer).toContain('creature-media-inputs');
        expect(videoServer).toContain('`${job.id}.${extension}`');
        expect(videoServer).not.toContain('async function signPortraitInput');
    });

    test.each([
        ['first_forest_arrival', 'Mythical Forest trail'],
        ['beacon_reflection', 'Project Beacon overlook'],
        ['guardian_rescue_elder_treant', 'rescue enclosure'],
        ['guardian_trust_elder_treant', 'Sanctuary beside living roots'],
        ['guardian_debrief_elder_treant', 'Sanctuary recovery overlook']
    ])('builds the authored prompt for %s', (momentId, location) => {
        const prompt = videoFunction._internal.buildPrompt(momentId, 'baby');
        expect(prompt).toContain(videoConfig.promptVersion);
        expect(prompt).toContain(location);
        expect(prompt).toContain('fictional creature');
        expect(prompt.toLowerCase()).not.toContain('companion');
    });

    test('rejects arbitrary moments instead of accepting browser prompts', () => {
        expect(videoFunction._internal.buildPrompt(
            'player_wrote_this',
            'baby'
        )).toBeNull();
    });

    test('delivers completed clips through Sanctuary and the Creature Archive', () => {
        expect(sanctuary).toContain('maybeShowCreatureVideoReadyNotice');
        expect(sanctuary).toContain('CREATURE STORY SCENE READY');
        expect(sanctuary).toContain("initialIdentityArchiveChapter: 'shared_journey'");
        expect(archive).toContain("first_forest_arrival: 'FIRST FOREST ARRIVAL'");
    });

    test('starts rescue generation even when the resident release owns the screen', () => {
        expect(platformer).toContain('residentReleaseShown &&');
        expect(platformer).toContain('`guardian_rescue_${guardianId}`');
        expect(platformer).toContain('?.prepareGeneratedVideo?.({');
    });
});
