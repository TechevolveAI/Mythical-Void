import Phaser from 'phaser';

class WorldBuilder {
    constructor(scene, graphicsEngine, options = {}) {
        this.scene = scene;
        this.graphicsEngine = graphicsEngine;
        this.worldWidth = options.worldWidth || 1600;
        this.worldHeight = options.worldHeight || 1200;
        this.debugGraphics = null;
        this.backgroundImage = null;
    }

    build() {
        const background = this.createBackgroundImage();
        const environment = this.createEnvironmentObjects();
        return {
            background,
            ...environment
        };
    }

    createBackgroundImage() {
        if (this.backgroundImage) {
            return this.backgroundImage;
        }

        const textureKey = this.generateBackgroundTexture();
        this.backgroundImage = this.scene.add.image(0, 0, textureKey);
        this.backgroundImage.setOrigin(0, 0);
        this.backgroundImage.setDepth(-1000);
        return this.backgroundImage;
    }

    generateBackgroundTexture() {
        const textureKey = `worldBackground_${this.worldWidth}x${this.worldHeight}`;
        if (this.scene.textures.exists(textureKey)) {
            return textureKey;
        }

        const graphics = this.scene.make.graphics({ add: false });

        // Base gradient
        graphics.fillGradientStyle(0x0a0a2e, 0x0a0a2e, 0x16213e, 0x1a1a4e, 1);
        graphics.fillRect(0, 0, this.worldWidth, this.worldHeight);

        // Stars
        for (let i = 0; i < 200; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const brightness = Math.random();
            const color = brightness > 0.7 ? 0xFFFFFF : (brightness > 0.4 ? 0xCCCCFF : 0x8888FF);
            const size = brightness > 0.8 ? 2 : 1;
            graphics.fillStyle(color, brightness);
            graphics.fillCircle(x, y, size);
        }

        // Nebula clouds
        const nebulaColors = [
            { color: 0x9370DB, alpha: 0.15 },
            { color: 0x4169E1, alpha: 0.12 },
            { color: 0xFF1493, alpha: 0.08 },
            { color: 0x00CED1, alpha: 0.10 }
        ];
        for (let i = 0; i < 30; i++) {
            const nebula = Phaser.Math.RND.pick(nebulaColors);
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const size = Phaser.Math.Between(80, 200);
            graphics.fillStyle(nebula.color, nebula.alpha);
            graphics.fillCircle(x, y, size);
        }

        // Floating platforms
        graphics.fillStyle(0x2a2a4e, 0.4);
        for (let i = 0; i < 40; i++) {
            const x = Phaser.Math.Between(0, this.worldWidth);
            const y = Phaser.Math.Between(0, this.worldHeight);
            const width = Phaser.Math.Between(100, 300);
            const height = Phaser.Math.Between(20, 40);
            graphics.fillRoundedRect(x, y, width, height, 10);
            graphics.fillStyle(0x9370DB, 0.3);
            graphics.fillRoundedRect(x, y, width, height * 0.3, 5);
            graphics.fillStyle(0x2a2a4e, 0.4);
        }

        graphics.generateTexture(textureKey, this.worldWidth, this.worldHeight);
        graphics.destroy();
        return textureKey;
    }

    createEnvironmentObjects() {
        const physics = this.scene.physics;
        const trees = physics.add.staticGroup();
        const rocks = physics.add.staticGroup();
        const flowers = physics.add.staticGroup();

        // Trees
        const treeVariants = ['enhancedTree_summer', 'enhancedTree_spring', 'enhancedTree_autumn'];
        const validTreeVariants = treeVariants.filter(tex => this.scene.textures.exists(tex));
        if (validTreeVariants.length > 0) {
            for (let i = 0; i < 15; i++) {
                const x = Phaser.Math.Between(150, this.worldWidth - 150);
                const y = Phaser.Math.Between(150, this.worldHeight - 150);
                const treeType = Phaser.Math.RND.pick(validTreeVariants);
                const tree = trees.create(x, y, treeType);
                tree.setScale(Phaser.Math.FloatBetween(1.0, 1.8));
                tree.body.setSize(30, 40);
                tree.setDepth(y);
            }
        }

        // Rocks
        for (let i = 0; i < 3; i++) {
            const textureName = `enhancedRock_${i}`;
            if (!this.scene.textures.exists(textureName)) continue;
            for (let j = 0; j < 10; j++) {
                const x = Phaser.Math.Between(100, this.worldWidth - 100);
                const y = Phaser.Math.Between(100, this.worldHeight - 100);
                const rock = rocks.create(x, y, textureName);
                rock.setScale(Phaser.Math.FloatBetween(1.2, 2.0));
                rock.body.setSize(25, 20);
                rock.setDepth(y);
            }
        }

        // Flowers
        if (this.scene.textures.exists('enhancedFlower')) {
            for (let i = 0; i < 25; i++) {
                const x = Phaser.Math.Between(80, this.worldWidth - 80);
                const y = Phaser.Math.Between(80, this.worldHeight - 80);
                const flower = flowers.create(x, y, 'enhancedFlower');
                flower.setScale(Phaser.Math.FloatBetween(1.0, 1.5));
                flower.body.setSize(15, 20);
                flower.setDepth(y);
                const tints = [0xFFFFFF, 0xFFB6FF, 0xB6FFFF, 0xFFFFB6, 0xFFB6B6];
                flower.setTint(Phaser.Math.RND.pick(tints));
            }
        }

        // Cosmic shop
        this.graphicsEngine.createCosmicShop();
        const shopX = this.worldWidth - 200;
        const shopY = this.worldHeight / 2;
        const shop = physics.add.staticSprite(shopX, shopY, 'cosmicShop');
        shop.setDepth(shopY);
        shop.body.setSize(200, 200);
        shop.body.setOffset(-50, -50);

        if (import.meta.env.DEV) {
            this.debugGraphics = this.scene.add.graphics();
            this.debugGraphics.lineStyle(3, 0x00FF00, 0.8);
            this.debugGraphics.strokeRect(
                shop.body.x,
                shop.body.y,
                shop.body.width,
                shop.body.height
            );
            this.debugGraphics.setDepth(10000);
        }

        return { trees, rocks, flowers, shop };
    }

    destroy() {
        this.backgroundImage?.destroy();
        this.backgroundImage = null;
        this.debugGraphics?.destroy();
        this.debugGraphics = null;
    }
}

export default WorldBuilder;
