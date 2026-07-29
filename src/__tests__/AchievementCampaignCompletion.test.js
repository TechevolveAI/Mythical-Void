const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createGameState() {
    const state = {
        player: {
            cosmicCoins: 0
        },
        stats: {
            coinsCollected: 0,
            creaturesHatched: 0,
            recordedHatchIds: []
        },
        combat: {
            enemiesDefeated: 0,
            bossesDefeated: 0
        },
        creature: {
            hatchTime: null,
            lifecycle: {
                birthDate: null
            }
        },
        world: {
            visitedAreas: []
        },
        story: {
            projectBeacon: {
                uplinkRestored: false,
                uplinkRestoredAt: null
            }
        },
        achievements: {}
    };

    return {
        state,
        get(propertyPath) {
            if (!propertyPath) {
                return state;
            }
            return propertyPath.split('.').reduce(
                (value, key) => value?.[key],
                state
            );
        },
        set(propertyPath, value) {
            const keys = propertyPath.split('.');
            const finalKey = keys.pop();
            const target = keys.reduce((current, key) => {
                current[key] = current[key] || {};
                return current[key];
            }, state);
            target[finalKey] = value;
        }
    };
}

function loadAchievementSystem(gameState) {
    const filePath = path.join(__dirname, '../systems/AchievementSystem.js');
    const source = fs.readFileSync(filePath, 'utf8')
        .replace(/^import .*$/gm, '')
        .replace('export default achievementSystem;', '')
        .replace(
            'export { TIERS, CATEGORIES, ACHIEVEMENT_DEFINITIONS };',
            'module.exports = achievementSystem;'
        );

    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        window: { GameState: gameState },
        devLog: jest.fn(),
        devWarn: jest.fn(),
        Date,
        Math,
        Object,
        Array,
        Number,
        String,
        Boolean,
        Set
    };

    vm.runInNewContext(source, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

describe('Project Beacon completion achievement', () => {
    test('guardian restoration and the legacy boss event share one counter', () => {
        const gameState = createGameState();
        const achievementSystem = loadAchievementSystem(gameState);
        achievementSystem.initialize();

        achievementSystem.recordEvent('guardian_restored', {
            bossId: 'crystal_golem'
        });
        achievementSystem.recordEvent('boss_defeated', {
            bossId: 'legacy_guardian'
        });

        expect(gameState.get('combat.bossesDefeated')).toBe(2);
    });

    test('campaign completion unlocks Beacon Restorer exactly once', () => {
        const gameState = createGameState();
        const achievementSystem = loadAchievementSystem(gameState);
        achievementSystem.initialize();

        const restoredAt = '2026-07-27T14:30:00.000Z';
        achievementSystem.recordEvent('campaign_completed', { restoredAt });
        achievementSystem.recordEvent('campaign_completed', { restoredAt });

        const achievement = achievementSystem.getAchievement('beacon_restorer');
        expect(achievement).toEqual(expect.objectContaining({
            name: 'Beacon Restorer',
            singleTier: true
        }));
        expect(achievement.progress.BRONZE).toEqual(expect.objectContaining({
            unlocked: true,
            value: 1
        }));
        expect(gameState.get('story.projectBeacon.uplinkRestored')).toBe(true);
        expect(gameState.get('story.projectBeacon.uplinkRestoredAt')).toBe(
            restoredAt
        );
        expect(
            achievementSystem.getPendingClaims().filter(
                claim => claim.id === 'beacon_restorer'
            )
        ).toHaveLength(1);
    });

    test('uses the canonical hatch clock for long-term bonding progress', () => {
        const gameState = createGameState();
        const achievementSystem = loadAchievementSystem(gameState);
        const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
        gameState.set('creature.hatchTime', threeDaysAgo);

        const progress = achievementSystem
            .getAchievement('best_friends')
            .getProgress(gameState.state);

        expect(progress).toBe(3);
    });

    test('does not interpret a missing hatch clock as the Unix epoch', () => {
        const gameState = createGameState();
        const achievementSystem = loadAchievementSystem(gameState);

        expect(
            achievementSystem.getAchievement('best_friends').getProgress(gameState.state)
        ).toBe(0);
    });

    test('matches exploration tiers to real realms and save-backed discoveries', () => {
        const gameState = createGameState();
        const achievementSystem = loadAchievementSystem(gameState);
        gameState.set('world.visitedAreas', [
            'realm:main',
            'sanctuary:livingarea',
            'sanctuary:crashsite'
        ]);
        achievementSystem.initialize();
        achievementSystem.checkAchievements();

        const explorer = achievementSystem.getAchievement('explorer');
        expect(explorer.tiers.GOLD.requirement).toBe(7);
        expect(explorer.tiers.PLATINUM.requirement).toBe(15);
        expect(explorer.progress.BRONZE).toEqual(expect.objectContaining({
            unlocked: true,
            value: 3
        }));
    });

    test('counts each hatch once and records combat and evolution producers', () => {
        const gameState = createGameState();
        const achievementSystem = loadAchievementSystem(gameState);
        achievementSystem.initialize();

        achievementSystem.recordEvent('creature_hatched', {
            hatchId: 'creature-1',
            rarity: 'rare',
            species: 'stellarWyrm'
        });
        achievementSystem.recordEvent('creature_hatched', {
            hatchId: 'creature-1',
            rarity: 'rare',
            species: 'stellarWyrm'
        });
        achievementSystem.recordEvent('enemy_defeated');
        achievementSystem.recordEvent('stage_reached', { stage: 'juvenile' });

        expect(gameState.get('stats.creaturesHatched')).toBe(1);
        expect(gameState.get('stats.rareHatched')).toBe(1);
        expect(gameState.get('stats.speciesDiscovered')).toEqual(['stellarWyrm']);
        expect(gameState.get('stats.recordedHatchIds')).toEqual(['creature-1']);
        expect(gameState.get('combat.enemiesDefeated')).toBe(1);
        expect(gameState.get('stats.stagesReached.juvenile')).toBe(1);
    });

    test('uses lifetime collected coins after shop spending', () => {
        const gameState = createGameState();
        const achievementSystem = loadAchievementSystem(gameState);
        gameState.set('stats.coinsCollected', 620);
        gameState.set('player.cosmicCoins', 20);

        expect(
            achievementSystem.getAchievement('wealthy').getProgress(gameState.state)
        ).toBe(620);
    });

    test('wires every repaired achievement producer into the live game paths', () => {
        const gameScene = fs.readFileSync(
            path.join(__dirname, '../scenes/GameScene.js'),
            'utf8'
        );
        const platformer = fs.readFileSync(
            path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
            'utf8'
        );
        const soulReveal = fs.readFileSync(
            path.join(__dirname, '../scenes/SoulRevealScene.js'),
            'utf8'
        );
        const breedingHatch = fs.readFileSync(
            path.join(__dirname, '../scenes/BreedingHatchScene.js'),
            'utf8'
        );

        expect(gameScene).toContain("visitArea?.(`realm:${realmId}`)");
        expect(gameScene).toContain("visitArea?.(`sanctuary:${zone.id}`)");
        expect(gameScene).toContain("visitArea?.(`signal:${signal.signalId}`)");
        expect(gameScene).toContain("recordEvent?.('stage_reached'");
        expect(platformer).toContain("recordEvent?.('enemy_defeated'");
        expect(soulReveal).toContain("recordEvent?.('creature_hatched'");
        expect(breedingHatch).toContain("recordEvent?.('creature_hatched'");

        const achievementMenu = fs.readFileSync(
            path.join(__dirname, '../scenes/AchievementMenuScene.js'),
            'utf8'
        );
        expect(achievementMenu).toContain(
            'window.AchievementSystem?.checkAchievements?.();'
        );
        expect(achievementMenu).toContain(
            'this.scene.isPaused?.(this.returnScene)'
        );

        const hamburgerMenu = fs.readFileSync(
            path.join(__dirname, '../ui/HamburgerMenu.js'),
            'utf8'
        );
        expect(hamburgerMenu).toContain('this.scene.scene.pause(returnScene)');
        expect(hamburgerMenu).toContain(
            "this.scene.scene.launch('AchievementMenuScene', { returnScene })"
        );
    });
});
