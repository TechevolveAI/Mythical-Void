const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadExpeditionAstronaut() {
    const filePath = path.join(__dirname, '../systems/ExpeditionAstronaut.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const transformed = source
        .replace('export function getExpeditionFollowOffset', 'function getExpeditionFollowOffset')
        .replace('export function findExpeditionTrailTarget', 'function findExpeditionTrailTarget')
        .replace('export function getExpeditionAstronautTextureKey', 'function getExpeditionAstronautTextureKey')
        .replace('export class ExpeditionAstronaut', 'class ExpeditionAstronaut')
        .replace('export default ExpeditionAstronaut;', '')
        .concat(
            '\nmodule.exports = {' +
            ' ExpeditionAstronaut, getExpeditionFollowOffset,' +
            ' findExpeditionTrailTarget, getExpeditionAstronautTextureKey };'
        );
    const sandbox = {
        module: { exports: {} },
        exports: {},
        Math,
        Array,
        Boolean
    };

    vm.runInNewContext(transformed, sandbox, { filename: filePath });
    return sandbox.module.exports;
}

function createDisplayObject(x, y, texture = null) {
    return {
        active: true,
        x,
        y,
        texture,
        depth: 0,
        alpha: 1,
        flipX: false,
        setOrigin: jest.fn().mockReturnThis(),
        setDepth: jest.fn(function setDepth(depth) {
            this.depth = depth;
            return this;
        }),
        setScale: jest.fn().mockReturnThis(),
        setFlipX: jest.fn(function setFlipX(flipX) {
            this.flipX = flipX;
            return this;
        }),
        setRotation: jest.fn().mockReturnThis(),
        setPosition: jest.fn(function setPosition(nextX, nextY) {
            this.x = nextX;
            this.y = nextY;
            return this;
        }),
        setAlpha: jest.fn(function setAlpha(alpha) {
            this.alpha = alpha;
            return this;
        }),
        setTexture: jest.fn(function setTexture(nextTexture) {
            this.texture = nextTexture;
            return this;
        }),
        destroy: jest.fn(function destroy() {
            this.active = false;
        })
    };
}

function createScene() {
    const textureKeys = new Set();
    const graphics = {
        fillStyle: jest.fn().mockReturnThis(),
        fillRoundedRect: jest.fn().mockReturnThis(),
        lineStyle: jest.fn().mockReturnThis(),
        strokeRoundedRect: jest.fn().mockReturnThis(),
        fillCircle: jest.fn().mockReturnThis(),
        fillRect: jest.fn().mockReturnThis(),
        strokeCircle: jest.fn().mockReturnThis(),
        lineBetween: jest.fn().mockReturnThis(),
        generateTexture: jest.fn((textureKey) => textureKeys.add(textureKey)),
        destroy: jest.fn()
    };
    const createStrikeGraphics = () => ({
        active: true,
        fillStyle: jest.fn().mockReturnThis(),
        fillCircle: jest.fn().mockReturnThis(),
        lineStyle: jest.fn().mockReturnThis(),
        lineBetween: jest.fn().mockReturnThis(),
        beginPath: jest.fn().mockReturnThis(),
        arc: jest.fn().mockReturnThis(),
        strokePath: jest.fn().mockReturnThis(),
        setPosition: jest.fn().mockReturnThis(),
        setDepth: jest.fn().mockReturnThis(),
        destroy: jest.fn(function destroy() {
            this.active = false;
        })
    });

    return {
        textures: {
            exists: jest.fn(textureKey => textureKeys.has(textureKey))
        },
        make: {
            graphics: jest.fn(() => graphics)
        },
        add: {
            ellipse: jest.fn((x, y) => createDisplayObject(x, y)),
            sprite: jest.fn((x, y, texture) => createDisplayObject(x, y, texture)),
            graphics: jest.fn(createStrikeGraphics)
        },
        tweens: {
            add: jest.fn(config => ({
                config,
                stop: jest.fn()
            }))
        }
    };
}

describe('Expedition astronaut', () => {
    test('uses distinct top-down and platformer formations', () => {
        const { getExpeditionFollowOffset } = loadExpeditionAstronaut();

        expect(getExpeditionFollowOffset('topDown', true)).toEqual({ x: -58, y: 24 });
        expect(getExpeditionFollowOffset('topDown', false)).toEqual({ x: 58, y: 24 });
        expect(getExpeditionFollowOffset('platformer', true)).toEqual({ x: -68, y: 2 });
    });

    test('samples an actual travelled path rather than a straight-line shortcut', () => {
        const { findExpeditionTrailTarget } = loadExpeditionAstronaut();
        const trail = [
            { x: 100, y: 100 },
            { x: 80, y: 100 },
            { x: 80, y: 80 },
            { x: 60, y: 80 }
        ];

        expect(findExpeditionTrailTarget(trail, 35)).toEqual({ x: 80, y: 80 });
        expect(findExpeditionTrailTarget(trail, 200)).toEqual({ x: 60, y: 80 });
    });

    test('uses a contextual formation to keep the astronaut clear of a landmark', () => {
        const { ExpeditionAstronaut } = loadExpeditionAstronaut();
        const scene = createScene();
        const target = {
            active: true,
            x: 200,
            y: 300,
            flipX: false,
            body: {
                velocity: { x: 0, y: 0 },
                blocked: { down: true }
            }
        };
        const follower = new ExpeditionAstronaut(scene, target, { mode: 'topDown' });

        expect(follower.setContextualFormation(
            { x: 0, y: -70 },
            'village_heart_approach'
        )).toBe(true);
        Array.from({ length: 40 }).forEach(() => follower.update(50));

        expect(follower.sprite.x).toBeCloseTo(200, 0);
        expect(follower.sprite.y).toBeCloseTo(230, 0);
        expect(follower.contextualFormation.context).toBe('village_heart_approach');
        expect(follower.setContextualFormation(null)).toBe(true);
        expect(follower.contextualFormation).toBeNull();
    });

    test('snaps safely after teleports and equips the recovered katana texture', () => {
        const { ExpeditionAstronaut } = loadExpeditionAstronaut();
        const scene = createScene();
        const target = {
            active: true,
            x: 200,
            y: 300,
            flipX: false,
            body: {
                velocity: { x: 0, y: 0 },
                blocked: { down: true }
            }
        };
        const follower = new ExpeditionAstronaut(scene, target, { mode: 'topDown' });

        expect(follower.sprite.x).toBe(142);
        expect(follower.sprite.y).toBe(324);
        expect(follower.sprite.texture).toBe('projectBeaconAstronaut');

        target.x = 900;
        target.y = 500;
        follower.update(16);

        expect(follower.sprite.x).toBe(842);
        expect(follower.sprite.y).toBeCloseTo(524, 0);

        follower.setFieldKitRecovered(true);
        expect(follower.sprite.setTexture).toHaveBeenCalledWith(
            'projectBeaconAstronautWithKit'
        );

        follower.setKatanaUpgradeIds(['crystal_edge']);
        expect(follower.sprite.setTexture).toHaveBeenCalledWith(
            'projectBeaconAstronautWithCrystalEdge'
        );

        follower.setKatanaUpgradeIds(['crystal_edge', 'aurora_guard']);
        expect(follower.sprite.setTexture).toHaveBeenCalledWith(
            'projectBeaconAstronautWithFullKatana'
        );
    });

    test('selects a distinct astronaut texture for every field-kit state', () => {
        const { getExpeditionAstronautTextureKey } = loadExpeditionAstronaut();

        expect(getExpeditionAstronautTextureKey(false, ['crystal_edge'])).toBe(
            'projectBeaconAstronaut'
        );
        expect(getExpeditionAstronautTextureKey(true, [])).toBe(
            'projectBeaconAstronautWithKit'
        );
        expect(getExpeditionAstronautTextureKey(true, ['aurora_guard'])).toBe(
            'projectBeaconAstronautWithAuroraGuard'
        );
        expect(
            getExpeditionAstronautTextureKey(
                true,
                ['crystal_edge', 'aurora_guard']
            )
        ).toBe('projectBeaconAstronautWithFullKatana');
    });

    test('lunges with the equipped katana at the real melee hit point', () => {
        const { ExpeditionAstronaut } = loadExpeditionAstronaut();
        const scene = createScene();
        const target = {
            active: true,
            x: 200,
            y: 300,
            flipX: false,
            body: {
                velocity: { x: 0, y: 0 },
                blocked: { down: true }
            }
        };
        const follower = new ExpeditionAstronaut(scene, target, {
            mode: 'platformer',
            fieldKitRecovered: true,
            katanaUpgradeIds: ['crystal_edge']
        });

        expect(follower.performKatanaStrike({
            facingRight: true,
            targetX: 260,
            targetY: 300,
            slashColor: 0x8FE3CF,
            slashGlowColor: 0x66C7D4
        })).toBe(true);

        const [trail, slash] = scene.add.graphics.mock.results.map(
            result => result.value
        );
        expect(trail.lineBetween).toHaveBeenCalledWith(
            follower.sprite.x + 10,
            follower.sprite.y + 8,
            252,
            300
        );
        expect(slash.lineStyle).toHaveBeenCalledWith(5, 0x8FE3CF, 1);
        expect(slash.setPosition).toHaveBeenCalledWith(260, 300);
        expect(follower.isStriking).toBe(true);
        expect(follower.performKatanaStrike()).toBe(false);

        const firstEffectTween = scene.tweens.add.mock.calls[0][0];
        const firstLungeTween = scene.tweens.add.mock.calls[1][0];
        firstLungeTween.onComplete();
        expect(follower.performKatanaStrike()).toBe(true);

        const secondStrikeEffects = scene.add.graphics.mock.results
            .slice(2)
            .map(result => result.value);
        firstEffectTween.onComplete();

        expect(trail.destroy).toHaveBeenCalled();
        expect(slash.destroy).toHaveBeenCalled();
        expect(follower.strikeEffects).toEqual(secondStrikeEffects);
    });

    test('is integrated once in the Sanctuary and shared platformer base', () => {
        const gameSceneSource = fs.readFileSync(
            path.join(__dirname, '../scenes/GameScene.js'),
            'utf8'
        );
        const platformerSource = fs.readFileSync(
            path.join(__dirname, '../scenes/PlatformerLevelScene.js'),
            'utf8'
        );

        expect(gameSceneSource).toContain("mode: 'topDown'");
        expect(gameSceneSource).toContain('this.astronautFollower?.update');
        expect(gameSceneSource).toContain('this.astronautFollower?.setFieldKitRecovered(true)');
        expect(platformerSource).toContain("mode: 'platformer'");
        expect(platformerSource).toContain('this.astronautFollower?.update(delta)');
        expect(gameSceneSource).toContain('katanaUpgradeIds:');
        expect(platformerSource).toContain(
            'katanaUpgradeIds: this.katanaCombatProfile.upgradeIds'
        );
        expect(platformerSource).toMatch(
            /fieldKitRecovered: Boolean\(\s*this\.katanaPreview \|\|/
        );
        expect(platformerSource).toContain(
            'this.astronautFollower?.performKatanaStrike'
        );
        expect(platformerSource).toContain(
            'performAttack({ targetXOverride = null, targetYOverride = null } = {})'
        );
        expect(platformerSource).toContain('targetX: attackX');
        expect(platformerSource).toContain('targetY: attackY');
        expect(platformerSource).toContain("label: '⚔️'");
        expect(platformerSource).toMatch(
            /astronautFollower\?\.fieldKitRecovered[\s\S]*astronautFollower\?\.isStriking[\s\S]*return;/
        );
        expect(platformerSource).not.toContain("label: '👊'");
    });
});
