/**
 * ProjectileManager - Manages combat projectiles based on creature rarity
 * Different rarity levels have different projectile appearances and damage
 */

class ProjectileManager {
    constructor() {
        this.initialized = false;
        this.projectiles = null;
        this.scene = null;
    }

    /**
     * Initialize the projectile system
     */
    initialize() {
        if (this.initialized) {
            console.warn('[ProjectileManager] Already initialized');
            return;
        }

        this.initialized = true;
        console.log('✅ ProjectileManager initialized');
    }

    /**
     * Set up projectile system for a scene
     * @param {Phaser.Scene} scene - Game scene
     * @param {Phaser.Physics.Arcade.Group} projectileGroup - Physics group for projectiles
     * @param {Phaser.Physics.Arcade.Group} enemyGroup - Enemy group for collision
     */
    setup(scene, projectileGroup, enemyGroup) {
        this.scene = scene;
        this.projectiles = projectileGroup;
        this.enemyGroup = enemyGroup;

        // Set up collision between projectiles and enemies
        if (scene && projectileGroup && enemyGroup) {
            scene.physics.add.overlap(projectileGroup, enemyGroup, this.handleProjectileHit, null, this);
        }

        console.log('[ProjectileManager] Setup complete');
    }

    /**
     * Fire a projectile from player toward target
     * @param {Phaser.Scene} scene - Game scene
     * @param {number} fromX - Starting X position
     * @param {number} fromY - Starting Y position
     * @param {number} toX - Target X position
     * @param {number} toY - Target Y position
     * @param {string} rarity - Creature rarity (determines projectile type)
     */
    fireProjectile(scene, fromX, fromY, toX, toY, rarity = 'common') {
        if (!this.projectiles) {
            console.error('[ProjectileManager] Projectiles group not set up');
            return;
        }

        // Get projectile config based on rarity
        const config = this.getProjectileConfig(rarity);
        const textureName = config.texture;

        // Ensure texture exists
        if (!scene.textures.exists(textureName)) {
            console.warn(`[ProjectileManager] Texture ${textureName} not found, creating...`);
            this.createProjectileTexture(scene, rarity);
        }

        // Create projectile from group
        const projectile = this.projectiles.get(fromX, fromY, textureName);

        if (!projectile) {
            console.warn('[ProjectileManager] Could not create projectile');
            return;
        }

        // Configure projectile
        projectile.setActive(true);
        projectile.setVisible(true);
        projectile.setScale(config.scale);
        projectile.setDepth(1500);

        // Store projectile data
        projectile.setData('damage', config.damage);
        projectile.setData('rarity', rarity);

        // Calculate velocity toward target
        const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
        const speed = config.speed;

        if (projectile.body) {
            projectile.body.setVelocity(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed
            );

            // Rotate projectile to face direction
            projectile.setRotation(angle);
        }

        // Add trail effect for higher rarities
        if (config.hasTrail) {
            this.addProjectileTrail(scene, projectile, config.trailColor);
        }

        // Auto-destroy after 3 seconds
        scene.time.delayedCall(3000, () => {
            if (projectile.active) {
                projectile.setActive(false);
                projectile.setVisible(false);
            }
        });

        console.log(`[ProjectileManager] Fired ${rarity} projectile (${config.damage} damage)`);
    }

    /**
     * Get projectile configuration by rarity
     * @param {string} rarity - Creature rarity
     * @returns {object} Projectile config
     */
    getProjectileConfig(rarity) {
        const configs = {
            common: {
                texture: 'projectile_common',
                damage: 10,
                speed: 300,
                scale: 0.8,
                hasTrail: false,
                color: 0xCCCCCC
            },
            uncommon: {
                texture: 'projectile_uncommon',
                damage: 15,
                speed: 350,
                scale: 0.9,
                hasTrail: true,
                trailColor: 0x00FF00,
                color: 0x00FF00
            },
            rare: {
                texture: 'projectile_rare',
                damage: 20,
                speed: 400,
                scale: 1.0,
                hasTrail: true,
                trailColor: 0x0099FF,
                color: 0x0099FF
            },
            epic: {
                texture: 'projectile_epic',
                damage: 30,
                speed: 450,
                scale: 1.1,
                hasTrail: true,
                trailColor: 0x9933FF,
                color: 0x9933FF
            },
            legendary: {
                texture: 'projectile_legendary',
                damage: 50,
                speed: 500,
                scale: 1.2,
                hasTrail: true,
                trailColor: 0xFFD700,
                color: 0xFFD700
            }
        };

        return configs[rarity] || configs.common;
    }

    /**
     * Create projectile texture procedurally
     * @param {Phaser.Scene} scene - Game scene
     * @param {string} rarity - Creature rarity
     */
    createProjectileTexture(scene, rarity) {
        const config = this.getProjectileConfig(rarity);
        const graphics = scene.add.graphics();

        // Draw projectile based on rarity
        const size = 16;
        const center = size / 2;

        // Outer glow
        graphics.fillStyle(config.color, 0.3);
        graphics.fillCircle(center, center, size / 2 + 2);

        // Main body
        graphics.fillStyle(config.color, 0.9);
        graphics.fillCircle(center, center, size / 2);

        // Inner highlight
        graphics.fillStyle(0xFFFFFF, 0.6);
        graphics.fillCircle(center - 2, center - 2, size / 4);

        // Generate texture
        graphics.generateTexture(config.texture, size, size);
        graphics.destroy();

        console.log(`[ProjectileManager] Created ${rarity} projectile texture`);
    }

    /**
     * Add trail effect to projectile
     * @param {Phaser.Scene} scene - Game scene
     * @param {Phaser.GameObjects.Sprite} projectile - Projectile sprite
     * @param {number} color - Trail color
     */
    addProjectileTrail(scene, projectile, color) {
        // Create simple trail particles
        const trailGraphics = scene.add.graphics();
        trailGraphics.fillStyle(color, 1);
        trailGraphics.fillCircle(4, 4, 4);
        trailGraphics.generateTexture('projectileTrail', 8, 8);
        trailGraphics.destroy();

        const trail = scene.add.particles(projectile.x, projectile.y, 'projectileTrail', {
            follow: projectile,
            lifespan: 300,
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            blendMode: 'ADD',
            frequency: 20
        });

        // Store reference to clean up later
        projectile.setData('trail', trail);

        // Cleanup trail when projectile is destroyed
        const cleanup = () => {
            if (trail) {
                trail.destroy();
            }
        };

        scene.time.delayedCall(3100, cleanup);
    }

    /**
     * Handle projectile hitting an enemy
     * @param {Phaser.GameObjects.Sprite} projectile - Projectile sprite
     * @param {Phaser.GameObjects.Sprite} enemy - Enemy sprite
     */
    handleProjectileHit(projectile, enemy) {
        if (!projectile.active || !enemy.active) return;

        const damage = projectile.getData('damage') || 10;
        const rarity = projectile.getData('rarity') || 'common';

        // Damage enemy
        if (window.EnemyManager) {
            window.EnemyManager.damageEnemy(enemy, damage);
        }

        // Create hit effect
        this.createHitEffect(projectile.x, projectile.y, rarity);

        // Destroy projectile
        projectile.setActive(false);
        projectile.setVisible(false);

        // Cleanup trail if it exists
        const trail = projectile.getData('trail');
        if (trail) {
            trail.destroy();
        }

        console.log(`[ProjectileManager] ${rarity} projectile hit for ${damage} damage`);
    }

    /**
     * Create hit effect when projectile hits enemy
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} rarity - Projectile rarity
     */
    createHitEffect(x, y, rarity) {
        if (!this.scene) return;

        const config = this.getProjectileConfig(rarity);

        // Create hit particle texture if needed
        if (!this.scene.textures.exists('hitParticle')) {
            const hitGraphics = this.scene.add.graphics();
            hitGraphics.fillStyle(config.color, 1);
            hitGraphics.fillCircle(3, 3, 3);
            hitGraphics.generateTexture('hitParticle', 6, 6);
            hitGraphics.destroy();
        }

        // Create explosion particles
        const particles = this.scene.add.particles(x, y, 'hitParticle', {
            speed: { min: 50, max: 150 },
            scale: { start: 1.0, end: 0 },
            alpha: { start: 1.0, end: 0 },
            lifespan: 400,
            quantity: 8,
            blendMode: 'ADD',
            angle: { min: 0, max: 360 }
        });

        // Cleanup
        this.scene.time.delayedCall(500, () => {
            particles.destroy();
        });
    }

    /**
     * Cleanup
     */
    destroy() {
        this.projectiles = null;
        this.scene = null;
        this.enemyGroup = null;
        console.log('[ProjectileManager] Destroyed');
    }
}

// Export as singleton
const projectileManager = new ProjectileManager();

if (typeof window !== 'undefined') {
    window.ProjectileManager = projectileManager;
}

export default projectileManager;
