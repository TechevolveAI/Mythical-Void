const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const { loadModule } = require('../test-support/endingRigFixture.cjs');
const World = require('phaser/src/physics/arcade/World');
const Body = require('phaser/src/physics/arcade/Body');
const StaticBody = require('phaser/src/physics/arcade/StaticBody');
const Clamp = require('phaser/src/math/Clamp');
const { resolveTextureContactGeometry } = loadModule('../systems/CreatureContactGeometry.js', 'resolveTextureContactGeometry');
const source = fs.readFileSync(path.join(__dirname, '../scenes/PlatformerLevelScene.js'), 'utf8');
const declaration = parse(source, { sourceType: 'module' }).program.body.find(node => node.type === 'ClassDeclaration');
const node = declaration.body.body.find(node => node.key?.name === 'createPlayer');
const createPlayer = new Function('Phaser', 'resolveTextureContactGeometry', 'console',
    `return ({${source.slice(node.start, node.end)}}).createPlayer;`)(
    { Math: { Clamp } }, resolveTextureContactGeometry, { log() {}, warn() {} }
);

test.each([1000 / 60, 1000 / 30, 1000 / 15])('real player creation and Arcade landing use body contact, not the decorative frame (%d ms)', delta => {
    const width = 220, height = 280;
    const bodyBounds = { left: 85, right: 134, top: 115, bottom: 169, width: 50, height: 55,
        contactY: 170, centerX: 110, requiredRowPixels: 6 };
    const scan = jest.fn(() => { throw Error('Decorative frame must not set the creature footing'); });
    const texture = { getSourceImage: () => ({ width, height, getContext: scan }), customData: {
        creatureBodyContact: { version: 1, textureWidth: width, textureHeight: height, bounds: bodyBounds }
    } };
    const world = new World({ sys: { scale: { width: 8000, height: 2000 } } }, { gravity: { y: 500 }, debug: false });
    const scene = {
        textures: { exists: key => key === 'synthetic-creature', get: () => texture },
        graphicsEngine: { createCreatureAnimationFrames: () => ['synthetic-creature'] },
        getPlayerSpawnGroundTopY: () => 1100,
        createFallbackCreatureTexture: jest.fn(() => { throw Error('Unexpected fallback'); }),
        physics: { add: { sprite(x, y) {
            const sprite = { x, y, width, height, displayWidth: width, displayHeight: height,
                originX: 0.5, originY: 0.5, displayOriginX: width / 2, displayOriginY: height / 2,
                scaleX: 1, scaleY: 1, angle: 0, rotation: 0,
                setDepth() { return this; },
                setCollideWorldBounds(value) { this.body.setCollideWorldBounds(value); return this; },
                setBounce(value) { this.body.setBounce(value); return this; },
                setDrag(x, y) { this.body.setDrag(x, y); return this; }
            };
            sprite.body = new Body(world, sprite);
            world.add(sprite.body);
            return sprite;
        } } }
    };
    try {
        createPlayer.call(scene);
        expect(scene.playerContactGeometry).toEqual(bodyBounds);
        expect(scene.player.body.bottom).toBeCloseTo(1099, 6);
        expect(scene.player.y - height / 2 + bodyBounds.contactY).toBeCloseTo(1099, 6);
        expect(scene.normalBodyWidth).toBeCloseTo(26, 6);
        expect(scene.normalBodyHeight).toBeCloseTo(30.8, 6);
        const ground = new StaticBody(world, { x: 200, y: 1150, displayWidth: 400, displayHeight: 100,
            originX: 0.5, originY: 0.5 });
        world.add(ground);
        world.addCollider(scene.player, ground);
        for (let frame = 0; frame < 20; frame++) {
            world.update(frame * delta, delta);
            world.postUpdate();
        }
        expect(scene.player.body.bottom).toBeCloseTo(1100, 6);
        expect(scene.player.y - height / 2 + bodyBounds.contactY).toBeCloseTo(1100, 6);
        expect(scan).not.toHaveBeenCalled();
        expect(scene.createFallbackCreatureTexture).not.toHaveBeenCalled();
    } finally { world.shutdown(); }
});
