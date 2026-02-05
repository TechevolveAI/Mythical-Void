/**
 * EnemyManager - Manages peaceful space fauna spawning and behavior
 * These are harvestable creatures that wander the sanctuary:
 * - voidWisp: Cosmic Grazer - gentle space herbivore (like a cosmic sheep)
 * - shadowSprite: Star Jellyfish - peaceful floating luminous creature
 *
 * Fauna do NOT attack the player - they simply wander peacefully and can be
 * interacted with to harvest coins and resources.
 */

class EnemyManager {
    constructor() {
        this.initialized = false;
        this.maxEnemies = 4; // Maximum concurrent fauna in sanctuary
        this.spawnRadius = 250; // Minimum distance from player to spawn
        this.despawnRadius = 1000; // Maximum distance before despawn (larger world)
        this.spawnInterval = 20000; // 20 seconds between spawn attempts
        this.enemyTypes = ['voidWisp', 'shadowSprite']; // Cosmic Grazer, Star Jellyfish
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
     * Get fauna harvest threshold by type (how many interactions to harvest)
     * @param {string} type - Fauna type
     * @returns {number} Harvest threshold value
     */
    getEnemyHealth(type) {
        switch (type) {
            case 'voidWisp':
                // Cosmic Grazer - quick to harvest
                return 20;
            case 'shadowSprite':
                // Star Jellyfish - slightly more substantial
                return 35;
            default:
                return 20;
        }
    }

    /**
     * Get fauna damage by type - ALWAYS 0 (peaceful creatures)
     * @param {string} type - Fauna type
     * @returns {number} Damage value (always 0)
     */
    getEnemyDamage(type) {
        // Peaceful fauna do not attack the player
        return 0;
    }

    /**
     * Get fauna resource drop range by type (coins from harvesting)
     * @param {string} type - Fauna type
     * @returns {object} {min, max} coin drop range
     */
    getEnemyCoinDrop(type) {
        switch (type) {
            case 'voidWisp':
                // Cosmic Grazer - fluffy cosmic sheep, generous harvest
                return { min: 20, max: 40 };
            case 'shadowSprite':
                // Star Jellyfish - luminous creature, valuable essence
                return { min: 30, max: 60 };
            default:
                return { min: 20, max: 40 };
        }
    }

    /**
     * Get fauna movement speed by type (peaceful wandering speed)
     * @param {string} type - Fauna type
     * @returns {number} Speed value
     */
    getEnemySpeed(type) {
        switch (type) {
            case 'voidWisp':
                // Cosmic Grazer - leisurely grazing pace
                return 25;
            case 'shadowSprite':
                // Star Jellyfish - gentle drifting
                return 20;
            default:
                return 25;
        }
    }

    /**
     * Update fauna AI (peaceful wandering behavior)
     * Fauna gently wander the sanctuary, grazing and floating peacefully
     * @param {Phaser.GameObjects.Sprite} fauna - Fauna sprite
     * @param {number} delta - Time delta
     */
    updateEnemyAI(fauna, delta) {
        if (!fauna || !fauna.active || !fauna.body) return;

        const type = fauna.getData('type');
        const speed = fauna.getData('speed') || 25;
        const wanderTimer = fauna.getData('wanderTimer') || 0;
        let wanderTarget = fauna.getData('wanderTarget');

        // Update wander timer
        fauna.setData('wanderTimer', wanderTimer + delta);

        // Pick new wander target every 4-7 seconds (leisurely pace)
        if (!wanderTarget || wanderTimer > Phaser.Math.Between(4000, 7000)) {
            wanderTarget = {
                x: fauna.x + Phaser.Math.Between(-200, 200),
                y: fauna.y + Phaser.Math.Between(-200, 200)
            };

            // Keep within world bounds
            wanderTarget.x = Phaser.Math.Clamp(wanderTarget.x, 100, this.worldWidth - 100);
            wanderTarget.y = Phaser.Math.Clamp(wanderTarget.y, 100, this.worldHeight - 100);

            fauna.setData('wanderTarget', wanderTarget);
            fauna.setData('wanderTimer', 0);
        }

        // Move toward wander target at peaceful pace
        if (wanderTarget) {
            const distance = Phaser.Math.Distance.Between(fauna.x, fauna.y, wanderTarget.x, wanderTarget.y);

            if (distance > 15) {
                const angle = Phaser.Math.Angle.Between(fauna.x, fauna.y, wanderTarget.x, wanderTarget.y);
                fauna.body.setVelocity(
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed
                );
            } else {
                // Rest at destination briefly
                fauna.body.setVelocity(0, 0);
            }
        }

        // Gentle floating animation for both fauna types
        if (type === 'voidWisp') {
            // Cosmic Grazer - gentle bobbing like a grazing animal
            const bobOffset = Math.sin(Date.now() / 800) * 1.5;
            fauna.y += bobOffset * 0.012;
        } else if (type === 'shadowSprite') {
            // Star Jellyfish - graceful undulating float
            const floatOffset = Math.sin(Date.now() / 600) * 2;
            const swayOffset = Math.sin(Date.now() / 1200) * 0.5;
            fauna.y += floatOffset * 0.015;
            fauna.x += swayOffset * 0.01;
        }
    }

    /**
     * Interact with fauna to harvest resources
     * @param {Phaser.GameObjects.Sprite} fauna - Fauna to harvest from
     * @param {number} harvestAmount - Harvest interaction amount
     * @returns {boolean} True if fauna was fully harvested
     */
    damageEnemy(fauna, harvestAmount) {
        if (!fauna || !fauna.active) return false;

        const currentHealth = fauna.getData('health') || 0;
        const newHealth = Math.max(0, currentHealth - harvestAmount);
        fauna.setData('health', newHealth);

        // Gentle glow flash on harvest interaction (not red - that's aggressive)
        fauna.setTint(0xFFFFAA); // Warm golden glow
        this.scene.time.delayedCall(150, () => {
            if (fauna.active) {
                fauna.clearTint();
            }
        });

        // Play gentle harvest sound instead of combat sound
        if (window.AudioManager) {
            window.AudioManager.playCoinCollect(); // Gentle chime for harvesting
        }

        // Emit harvest event
        this.events.emit('enemyDamaged', { enemy: fauna, damage: harvestAmount, newHealth });

        // Check if fully harvested
        if (newHealth <= 0) {
            this.killEnemy(fauna);
            return true;
        }

        return false;
    }

    /**
     * Complete fauna harvest - fauna floats away leaving resources
     * @param {Phaser.GameObjects.Sprite} fauna - Fauna that was harvested
     */
    killEnemy(fauna) {
        if (!fauna) return;

        const type = fauna.getData('type');
        const coinMin = fauna.getData('coinDropMin') || 20;
        const coinMax = fauna.getData('coinDropMax') || 40;
        const coinDrop = Phaser.Math.Between(coinMin, coinMax);

        // Add coins to economy (harvested resources)
        if (window.EconomyManager) {
            window.EconomyManager.addCoins(coinDrop, 'fauna_harvest');
        }

        // Track harvest for quests
        if (window.QuestManager) {
            const currentBiome = this.scene?.currentBiome || 'nebula';
            window.QuestManager.trackProgress('defeat_enemies', {
                count: 1,
                biome: currentBiome
            });
            window.QuestManager.trackProgress('collect_coins', { amount: coinDrop });
        }

        // Magical harvest animation - fauna floats upward and fades peacefully
        this.scene.tweens.add({
            targets: fauna,
            alpha: 0,
            y: fauna.y - 60,  // Float upward
            scaleX: 1.3,      // Expand gently
            scaleY: 1.3,
            duration: 800,
            ease: 'Sine.easeOut',
            onComplete: () => {
                fauna.setActive(false);
                fauna.setVisible(false);
            }
        });

        // Play gentle harvest complete sound
        if (window.AudioManager) {
            window.AudioManager.playAchievement(); // Satisfying completion chime
        }

        // Broadcast harvest event for sparkles/particles
        this.events.emit('wispCalmed', { enemy: fauna, type, coinDrop, x: fauna.x, y: fauna.y });

        const faunaName = type === 'voidWisp' ? 'Cosmic Grazer' : 'Star Jellyfish';
        console.log(`[EnemyManager] ${faunaName} harvested! Gained ${coinDrop} cosmic essence`);
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
