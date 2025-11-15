/**
 * EnemyManager - Manages enemy spawning, behavior, and combat
 * Handles enemy lifecycle, AI, and interactions with the player
 */

class EnemyManager {
    constructor() {
        this.initialized = false;
        this.maxEnemies = 3; // Maximum concurrent enemies in sanctuary
        this.spawnRadius = 300; // Minimum distance from player to spawn
        this.despawnRadius = 800; // Maximum distance before despawn
        this.spawnInterval = 25000; // 25 seconds between spawn attempts
        this.enemyTypes = ['voidWisp', 'shadowSprite'];
        this.events = new Phaser.Events.EventEmitter();
    }

    /**
     * Initialize the enemy system
     */
    initialize() {
        if (this.initialized) {
            console.warn('[EnemyManager] Already initialized');
            return;
        }

        this.initialized = true;
        console.log('✅ EnemyManager initialized');
    }

    /**
     * Start enemy spawning for a scene
     * @param {Phaser.Scene} scene - The game scene
     * @param {Phaser.Physics.Arcade.Group} enemyGroup - Physics group for enemies
     * @param {Phaser.GameObjects.Sprite} player - Player sprite
     * @param {number} worldWidth - World width
     * @param {number} worldHeight - World height
     */
    startSpawning(scene, enemyGroup, player, worldWidth, worldHeight) {
        if (!scene || !enemyGroup || !player) {
            console.error('[EnemyManager] Invalid parameters for startSpawning');
            return;
        }

        this.scene = scene;
        this.enemyGroup = enemyGroup;
        this.player = player;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;

        // Spawn initial enemies
        this.spawnInitialEnemies();

        // Set up periodic spawning
        this.spawnTimer = scene.time.addEvent({
            delay: this.spawnInterval,
            callback: this.attemptSpawn,
            callbackScope: this,
            loop: true
        });

        console.log('[EnemyManager] Spawning started');
    }

    /**
     * Spawn initial enemies
     */
    spawnInitialEnemies() {
        const initialCount = Phaser.Math.Between(1, 2);
        for (let i = 0; i < initialCount; i++) {
            this.spawnEnemy();
        }
    }

    /**
     * Attempt to spawn an enemy (if below max count)
     */
    attemptSpawn() {
        if (!this.enemyGroup || !this.player) return;

        const currentCount = this.enemyGroup.getChildren().filter(e => e.active).length;

        if (currentCount < this.maxEnemies) {
            this.spawnEnemy();
        }
    }

    /**
     * Spawn a new enemy
     * @param {string} type - Optional enemy type (random if not specified)
     * @returns {Phaser.GameObjects.Sprite} The spawned enemy
     */
    spawnEnemy(type = null) {
        if (!this.scene || !this.enemyGroup || !this.player) return null;

        // Select random enemy type if not specified
        const enemyType = type || Phaser.Utils.Array.GetRandom(this.enemyTypes);

        // Find valid spawn position (away from player)
        const spawnPos = this.findValidSpawnPosition();
        if (!spawnPos) {
            console.warn('[EnemyManager] Could not find valid spawn position');
            return null;
        }

        // Get texture name for enemy type
        const textureName = this.getEnemyTexture(enemyType);

        // Create enemy sprite from group
        const enemy = this.enemyGroup.get(spawnPos.x, spawnPos.y, textureName);

        if (!enemy) {
            console.warn('[EnemyManager] Could not create enemy (group full)');
            return null;
        }

        // Configure enemy
        enemy.setActive(true);
        enemy.setVisible(true);
        enemy.setDepth(999);
        enemy.setScale(1.0);

        // Set enemy data
        enemy.setData('type', enemyType);
        enemy.setData('health', this.getEnemyHealth(enemyType));
        enemy.setData('maxHealth', this.getEnemyHealth(enemyType));
        enemy.setData('damage', this.getEnemyDamage(enemyType));
        enemy.setData('coinDropMin', this.getEnemyCoinDrop(enemyType).min);
        enemy.setData('coinDropMax', this.getEnemyCoinDrop(enemyType).max);
        enemy.setData('speed', this.getEnemySpeed(enemyType));
        enemy.setData('wanderTarget', null);
        enemy.setData('wanderTimer', 0);

        // Enable physics body
        if (enemy.body) {
            enemy.body.setCollideWorldBounds(true);
            enemy.body.setBounce(0.2);
            enemy.body.setDrag(100);
        }

        // Spawn animation
        enemy.setAlpha(0);
        enemy.setScale(0.5);
        this.scene.tweens.add({
            targets: enemy,
            alpha: 1,
            scaleX: 1.0,
            scaleY: 1.0,
            duration: 500,
            ease: 'Back.easeOut'
        });

        console.log(`[EnemyManager] Spawned ${enemyType} at (${spawnPos.x}, ${spawnPos.y})`);

        // Emit spawn event
        this.events.emit('enemySpawned', { enemy, type: enemyType });

        return enemy;
    }

    /**
     * Find a valid spawn position away from player
     * @returns {object} Position {x, y} or null
     */
    findValidSpawnPosition() {
        if (!this.player) return null;

        const maxAttempts = 10;
        let attempts = 0;

        while (attempts < maxAttempts) {
            const x = Phaser.Math.Between(100, this.worldWidth - 100);
            const y = Phaser.Math.Between(100, this.worldHeight - 100);

            const distance = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);

            // Must be at least spawnRadius away from player
            if (distance >= this.spawnRadius && distance <= this.despawnRadius) {
                return { x, y };
            }

            attempts++;
        }

        return null;
    }

    /**
     * Get texture name for enemy type
     * @param {string} type - Enemy type
     * @returns {string} Texture name
     */
    getEnemyTexture(type) {
        switch (type) {
            case 'voidWisp':
                return 'voidWisp';
            case 'shadowSprite':
                return 'shadowSprite';
            default:
                return 'voidWisp';
        }
    }

    /**
     * Get enemy health by type
     * @param {string} type - Enemy type
     * @returns {number} Health value
     */
    getEnemyHealth(type) {
        switch (type) {
            case 'voidWisp':
                return 30;
            case 'shadowSprite':
                return 50;
            default:
                return 30;
        }
    }

    /**
     * Get enemy damage by type
     * @param {string} type - Enemy type
     * @returns {number} Damage value
     */
    getEnemyDamage(type) {
        switch (type) {
            case 'voidWisp':
                return 5;
            case 'shadowSprite':
                return 8;
            default:
                return 5;
        }
    }

    /**
     * Get enemy coin drop range by type
     * @param {string} type - Enemy type
     * @returns {object} {min, max} coin drop range
     */
    getEnemyCoinDrop(type) {
        switch (type) {
            case 'voidWisp':
                return { min: 15, max: 30 };
            case 'shadowSprite':
                return { min: 25, max: 50 };
            default:
                return { min: 15, max: 30 };
        }
    }

    /**
     * Get enemy movement speed by type
     * @param {string} type - Enemy type
     * @returns {number} Speed value
     */
    getEnemySpeed(type) {
        switch (type) {
            case 'voidWisp':
                return 40;
            case 'shadowSprite':
                return 30;
            default:
                return 40;
        }
    }

    /**
     * Update enemy AI (wander behavior)
     * @param {Phaser.GameObjects.Sprite} enemy - Enemy sprite
     * @param {number} delta - Time delta
     */
    updateEnemyAI(enemy, delta) {
        if (!enemy || !enemy.active || !enemy.body) return;

        const type = enemy.getData('type');
        const speed = enemy.getData('speed') || 40;
        const wanderTimer = enemy.getData('wanderTimer') || 0;
        let wanderTarget = enemy.getData('wanderTarget');

        // Update wander timer
        enemy.setData('wanderTimer', wanderTimer + delta);

        // Pick new wander target every 3-5 seconds
        if (!wanderTarget || wanderTimer > Phaser.Math.Between(3000, 5000)) {
            wanderTarget = {
                x: enemy.x + Phaser.Math.Between(-150, 150),
                y: enemy.y + Phaser.Math.Between(-150, 150)
            };

            // Keep within world bounds
            wanderTarget.x = Phaser.Math.Clamp(wanderTarget.x, 50, this.worldWidth - 50);
            wanderTarget.y = Phaser.Math.Clamp(wanderTarget.y, 50, this.worldHeight - 50);

            enemy.setData('wanderTarget', wanderTarget);
            enemy.setData('wanderTimer', 0);
        }

        // Move toward wander target
        if (wanderTarget) {
            const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, wanderTarget.x, wanderTarget.y);

            if (distance > 10) {
                const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, wanderTarget.x, wanderTarget.y);
                enemy.body.setVelocity(
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed
                );
            } else {
                enemy.body.setVelocity(0, 0);
            }
        }

        // Add floating animation for voidWisp
        if (type === 'voidWisp') {
            const floatOffset = Math.sin(Date.now() / 500) * 2;
            enemy.y += floatOffset * 0.016; // Smooth floating
        }
    }

    /**
     * Damage an enemy
     * @param {Phaser.GameObjects.Sprite} enemy - Enemy to damage
     * @param {number} damage - Damage amount
     * @returns {boolean} True if enemy died
     */
    damageEnemy(enemy, damage) {
        if (!enemy || !enemy.active) return false;

        const currentHealth = enemy.getData('health') || 0;
        const newHealth = Math.max(0, currentHealth - damage);
        enemy.setData('health', newHealth);

        // Flash red on hit
        enemy.setTint(0xFF0000);
        this.scene.time.delayedCall(100, () => {
            if (enemy.active) {
                enemy.clearTint();
            }
        });

        // Play hit sound
        if (window.AudioManager) {
            window.AudioManager.playEnemyHit();
        }

        // Emit damage event
        this.events.emit('enemyDamaged', { enemy, damage, newHealth });

        // Check if dead
        if (newHealth <= 0) {
            this.killEnemy(enemy);
            return true;
        }

        return false;
    }

    /**
     * Kill an enemy and drop coins
     * @param {Phaser.GameObjects.Sprite} enemy - Enemy to kill
     */
    killEnemy(enemy) {
        if (!enemy) return;

        const type = enemy.getData('type');
        const coinMin = enemy.getData('coinDropMin') || 15;
        const coinMax = enemy.getData('coinDropMax') || 30;
        const coinDrop = Phaser.Math.Between(coinMin, coinMax);

        // Add coins to economy
        if (window.EconomyManager) {
            window.EconomyManager.addCoins(coinDrop, 'enemy_drop');
        }

        // Death animation
        this.scene.tweens.add({
            targets: enemy,
            alpha: 0,
            scaleX: 0.5,
            scaleY: 0.5,
            angle: 360,
            duration: 400,
            ease: 'Power2',
            onComplete: () => {
                enemy.setActive(false);
                enemy.setVisible(false);
            }
        });

        // Broadcast calming event for sparkles/particles
        this.events.emit('wispCalmed', { enemy, type, coinDrop, x: enemy.x, y: enemy.y });

        console.log(`[EnemyManager] ${type} calmed. Shared ${coinDrop} cozy coins`);
    }

    /**
     * Stop spawning and cleanup
     */
    stopSpawning() {
        if (this.spawnTimer) {
            this.spawnTimer.remove();
            this.spawnTimer = null;
        }

        console.log('[EnemyManager] Spawning stopped');
    }

    /**
     * Listen to enemy events
     * @param {string} event - Event name
     * @param {function} callback - Callback function
     */
    on(event, callback) {
        this.events.on(event, callback);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {function} callback - Callback function
     */
    off(event, callback) {
        this.events.off(event, callback);
    }

    /**
     * Get enemy statistics
     * @returns {object} Enemy stats
     */
    getStats() {
        const activeCount = this.enemyGroup ?
            this.enemyGroup.getChildren().filter(e => e.active).length : 0;

        return {
            activeEnemies: activeCount,
            maxEnemies: this.maxEnemies,
            types: this.enemyTypes
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stopSpawning();
        this.events.removeAllListeners();
        this.scene = null;
        this.enemyGroup = null;
        this.player = null;
        console.log('[EnemyManager] Destroyed');
    }
}

// Export as singleton
const enemyManager = new EnemyManager();

if (typeof window !== 'undefined') {
    window.EnemyManager = enemyManager;
}

export default enemyManager;
