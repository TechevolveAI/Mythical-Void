/**
 * CollectibleManager - Handles exploration collectibles, treasures, and discoveries
 * Spawns collectibles in the game world and tracks collection progress
 * Updated to use programmatic sprites and ToastNotificationSystem
 */

class CollectibleManager {
    constructor() {
        this.initialized = false;
        this.collectibles = [];
        this.collectedItems = {};
        this.discoveryLog = [];
        this.eventListeners = new Map();

        // Sprite texture mapping for collectible types
        this.spriteTextureMap = {
            'coin_pile': 'coinPile',
            'small_chest': 'treasureChestCollectible',
            'energy_orb': 'energyOrbCollectible',
            'treasure_chest': 'treasureChestCollectible',
            'star_fragment': 'starFragment',
            'ancient_relic': 'ancientRelic',
            'cosmic_gem': 'cosmicGemCollectible',
            'legendary_artifact': 'ancientRelic',  // Use relic sprite for legendary
            'lore_crash_origin': 'loreFragment',
            'lore_first_egg': 'loreFragment',
            'lore_reef_ancient': 'loreFragment',
            'lore_reef_harmony': 'loreFragment',
            'lore_cave_energy': 'loreFragment',
            'lore_cave_builders': 'loreFragment',
            'lore_void_warning': 'loreFragment',
            'lore_void_truth': 'loreFragment',
            'lore_aurora_truth': 'loreFragment',
            'lore_aurora_destiny': 'loreFragment'
        };

        // Collectible definitions per biome
        this.collectibleTypes = this.defineCollectibleTypes();
    }

    /**
     * Initialize the collectible system
     */
    init() {
        if (this.initialized) return;

        console.log('[CollectibleManager] Initializing collectible system...');

        // Load saved collection progress
        this.loadCollectionState();

        this.initialized = true;
        console.log('[CollectibleManager] Collectible system initialized');
    }

    /**
     * Define collectible types for each biome
     */
    defineCollectibleTypes() {
        return {
            // Common collectibles (all biomes)
            common: [
                {
                    id: 'coin_pile',
                    name: 'Coin Pile',
                    icon: '🪙',
                    color: 0xFFD700,
                    glowColor: 0xFFA500,
                    rarity: 'common',
                    reward: { coins: { min: 5, max: 15 } },
                    spawnWeight: 40
                },
                {
                    id: 'small_chest',
                    name: 'Small Chest',
                    icon: '📦',
                    color: 0x8B4513,
                    glowColor: 0xCD853F,
                    rarity: 'common',
                    reward: { coins: { min: 15, max: 30 } },
                    spawnWeight: 25
                },
                {
                    id: 'energy_orb',
                    name: 'Energy Orb',
                    icon: '🔮',
                    color: 0x00CED1,
                    glowColor: 0x00FFFF,
                    rarity: 'common',
                    reward: { xp: { min: 10, max: 25 } },
                    spawnWeight: 20
                }
            ],

            // Uncommon collectibles
            uncommon: [
                {
                    id: 'treasure_chest',
                    name: 'Treasure Chest',
                    icon: '🎁',
                    color: 0xDAA520,
                    glowColor: 0xFFD700,
                    rarity: 'uncommon',
                    reward: { coins: { min: 30, max: 60 }, xp: { min: 15, max: 30 } },
                    spawnWeight: 12
                },
                {
                    id: 'star_fragment',
                    name: 'Star Fragment',
                    icon: '⭐',
                    color: 0xFFFF00,
                    glowColor: 0xFFFFAA,
                    rarity: 'uncommon',
                    reward: { xp: { min: 30, max: 50 } },
                    spawnWeight: 10
                }
            ],

            // Rare collectibles
            rare: [
                {
                    id: 'ancient_relic',
                    name: 'Ancient Relic',
                    icon: '🏺',
                    color: 0x9932CC,
                    glowColor: 0xDA70D6,
                    rarity: 'rare',
                    reward: { coins: { min: 75, max: 150 }, xp: { min: 40, max: 75 } },
                    spawnWeight: 5
                },
                {
                    id: 'cosmic_gem',
                    name: 'Cosmic Gem',
                    icon: '💎',
                    color: 0x7B68EE,
                    glowColor: 0x9370DB,
                    rarity: 'rare',
                    reward: { coins: { min: 100, max: 200 } },
                    spawnWeight: 3
                }
            ],

            // Biome-specific collectibles
            biome: {
                nebula: [
                    {
                        id: 'nebula_crystal',
                        name: 'Nebula Crystal',
                        icon: '💠',
                        color: 0x9370DB,
                        glowColor: 0xE6E6FA,
                        rarity: 'biome',
                        biome: 'nebula',
                        item: 'crystal',
                        reward: { coins: { min: 20, max: 40 }, xp: { min: 20, max: 35 } },
                        spawnWeight: 15,
                        questRelevant: true
                    }
                ],
                stellar_reef: [
                    {
                        id: 'stellar_pearl',
                        name: 'Stellar Pearl',
                        icon: '🦪',
                        color: 0xFFF8DC,
                        glowColor: 0xFFFFE0,
                        rarity: 'biome',
                        biome: 'stellar_reef',
                        item: 'pearl',
                        reward: { coins: { min: 35, max: 70 }, xp: { min: 25, max: 45 } },
                        spawnWeight: 15,
                        questRelevant: true
                    },
                    {
                        id: 'coral_shard',
                        name: 'Coral Shard',
                        icon: '🪸',
                        color: 0xFF6B6B,
                        glowColor: 0xFF8888,
                        rarity: 'biome',
                        biome: 'stellar_reef',
                        item: 'coral',
                        reward: { coins: { min: 25, max: 50 } },
                        spawnWeight: 20
                    }
                ],
                crystal_caves: [
                    {
                        id: 'cave_crystal',
                        name: 'Cave Crystal',
                        icon: '🔷',
                        color: 0x00BFFF,
                        glowColor: 0x87CEEB,
                        rarity: 'biome',
                        biome: 'crystal_caves',
                        item: 'crystal',
                        reward: { coins: { min: 40, max: 80 }, xp: { min: 30, max: 55 } },
                        spawnWeight: 15,
                        questRelevant: true
                    }
                ],
                void_peaks: [
                    {
                        id: 'void_essence',
                        name: 'Void Essence',
                        icon: '🌑',
                        color: 0x2F2F4F,
                        glowColor: 0x483D8B,
                        rarity: 'biome',
                        biome: 'void_peaks',
                        item: 'essence',
                        reward: { coins: { min: 50, max: 100 }, xp: { min: 40, max: 70 } },
                        spawnWeight: 12,
                        questRelevant: true
                    }
                ],
                aurora_depths: [
                    {
                        id: 'aurora_shard',
                        name: 'Aurora Shard',
                        icon: '🌈',
                        color: 0x00FF7F,
                        glowColor: 0x7FFFD4,
                        rarity: 'biome',
                        biome: 'aurora_depths',
                        item: 'shard',
                        reward: { coins: { min: 75, max: 150 }, xp: { min: 50, max: 90 } },
                        spawnWeight: 10,
                        questRelevant: true
                    }
                ]
            },

            // Secret/Hidden collectibles (very rare)
            secret: [
                {
                    id: 'legendary_artifact',
                    name: 'Legendary Artifact',
                    icon: '🏆',
                    color: 0xFFD700,
                    glowColor: 0xFFFF00,
                    rarity: 'legendary',
                    reward: { coins: { min: 200, max: 500 }, xp: { min: 100, max: 200 } },
                    spawnWeight: 1,
                    isSecret: true
                }
            ],

            // Lore fragments - tell the story of The Void
            lore: {
                nebula: [
                    {
                        id: 'lore_crash_origin',
                        name: 'Ship Log Fragment',
                        icon: '📜',
                        color: 0x4A90A4,
                        glowColor: 0x87CEEB,
                        rarity: 'lore',
                        reward: { xp: { min: 50, max: 75 } },
                        spawnWeight: 3,
                        isLore: true,
                        loreText: 'Ship Log Entry 1: The navigation systems failed without warning. Emergency landing protocols engaged. Location unknown. Scanners detect unusual energy signatures...',
                        loreTitle: 'The Crash'
                    },
                    {
                        id: 'lore_first_egg',
                        name: 'Data Fragment',
                        icon: '📜',
                        color: 0x7B68EE,
                        glowColor: 0x9370DB,
                        rarity: 'lore',
                        reward: { xp: { min: 50, max: 75 } },
                        spawnWeight: 3,
                        isLore: true,
                        loreText: 'Personal Log: Found an egg near the crash site. Unlike anything in our databases. When I touched it, it felt warm... alive. It responded to me.',
                        loreTitle: 'First Contact'
                    }
                ],
                stellar_reef: [
                    {
                        id: 'lore_reef_ancient',
                        name: 'Coral Inscription',
                        icon: '📜',
                        color: 0x00CED1,
                        glowColor: 0x20B2AA,
                        rarity: 'lore',
                        reward: { xp: { min: 60, max: 85 } },
                        spawnWeight: 3,
                        isLore: true,
                        loreText: 'Ancient markings on the coral suggest intelligent life once thrived here. Their symbols show creatures similar to the eggs found across The Void...',
                        loreTitle: 'Ancient Guardians'
                    },
                    {
                        id: 'lore_reef_harmony',
                        name: 'Pearl Memory',
                        icon: '📜',
                        color: 0xFFF8DC,
                        glowColor: 0xFFFFE0,
                        rarity: 'lore',
                        reward: { xp: { min: 60, max: 85 } },
                        spawnWeight: 3,
                        isLore: true,
                        loreText: 'The creatures here live in perfect harmony with the reef. They sing to the coral, and the coral responds. Perhaps this is what The Void was meant to be.',
                        loreTitle: 'Cosmic Symphony'
                    }
                ],
                crystal_caves: [
                    {
                        id: 'lore_cave_energy',
                        name: 'Crystal Recording',
                        icon: '📜',
                        color: 0x7B68EE,
                        glowColor: 0xE040FB,
                        rarity: 'lore',
                        reward: { xp: { min: 70, max: 95 } },
                        spawnWeight: 3,
                        isLore: true,
                        loreText: 'The crystals pulse with an energy my instruments cannot measure. They seem to store memories - I touched one and saw visions of creatures from millennia ago.',
                        loreTitle: 'Memory Crystals'
                    },
                    {
                        id: 'lore_cave_builders',
                        name: 'Stone Tablet',
                        icon: '📜',
                        color: 0x2C3E50,
                        glowColor: 0x34495E,
                        rarity: 'lore',
                        reward: { xp: { min: 70, max: 95 } },
                        spawnWeight: 3,
                        isLore: true,
                        loreText: 'These caves were not formed naturally. Someone carved them. The precision is beyond any technology I know. The creatures seem to recognize this place.',
                        loreTitle: 'The Architects'
                    }
                ],
                void_peaks: [
                    {
                        id: 'lore_void_warning',
                        name: 'Dark Whisper',
                        icon: '📜',
                        color: 0x4B0082,
                        glowColor: 0x8B008B,
                        rarity: 'lore',
                        reward: { xp: { min: 80, max: 110 } },
                        spawnWeight: 3,
                        isLore: true,
                        loreText: 'Warning to all who read this: The Void peaks are where reality thins. The creatures here are guardians. They keep something locked away. Something ancient.',
                        loreTitle: 'The Warning'
                    },
                    {
                        id: 'lore_void_truth',
                        name: 'Void Echo',
                        icon: '📜',
                        color: 0x2F2F4F,
                        glowColor: 0x483D8B,
                        rarity: 'lore',
                        reward: { xp: { min: 80, max: 110 } },
                        spawnWeight: 3,
                        isLore: true,
                        loreText: 'The Void is not empty. It is full of possibility. The creatures born here carry fragments of infinite potential. That is why they choose their companions carefully.',
                        loreTitle: 'Infinite Potential'
                    }
                ],
                aurora_depths: [
                    {
                        id: 'lore_aurora_truth',
                        name: 'Light Scroll',
                        icon: '📜',
                        color: 0x00FF7F,
                        glowColor: 0x7FFFD4,
                        rarity: 'lore',
                        reward: { xp: { min: 100, max: 140 } },
                        spawnWeight: 3,
                        isLore: true,
                        loreText: 'The aurora speaks the truth of The Void: We were not stranded here by accident. The creatures called us. They have been waiting for companions worthy of their gifts.',
                        loreTitle: 'The Calling'
                    },
                    {
                        id: 'lore_aurora_destiny',
                        name: 'Ancient Prophecy',
                        icon: '📜',
                        color: 0xFFD700,
                        glowColor: 0xFFA500,
                        rarity: 'lore',
                        reward: { xp: { min: 100, max: 140 } },
                        spawnWeight: 3,
                        isLore: true,
                        loreText: 'When the traveler arrives from beyond the stars, the eggs shall awaken. Together, creature and companion will restore what was lost. This is the promise of The Void.',
                        loreTitle: 'The Promise'
                    }
                ]
            }
        };
    }

    /**
     * Get collectibles for a specific biome
     */
    getCollectiblesForBiome(biome) {
        const collectibles = [
            ...this.collectibleTypes.common,
            ...this.collectibleTypes.uncommon,
            ...this.collectibleTypes.rare,
            ...(this.collectibleTypes.biome[biome] || []),
            ...this.collectibleTypes.secret,
            ...(this.collectibleTypes.lore[biome] || [])
        ];

        return collectibles;
    }

    /**
     * Get all lore fragments (for lore viewer)
     */
    getAllLoreFragments() {
        const allLore = [];
        for (const biome of Object.keys(this.collectibleTypes.lore)) {
            for (const lore of this.collectibleTypes.lore[biome]) {
                allLore.push({
                    ...lore,
                    biome,
                    collected: this.hasCollectedItem(lore.id)
                });
            }
        }
        return allLore;
    }

    /**
     * Get collected lore fragments
     */
    getCollectedLore() {
        return this.getAllLoreFragments().filter(lore => lore.collected);
    }

    /**
     * Check if a specific item has been collected
     */
    hasCollectedItem(itemId) {
        return this.collectedItems[itemId] === true;
    }

    /**
     * Spawn collectibles in a scene
     * @param {Phaser.Scene} scene - The Phaser scene
     * @param {string} biome - Current biome
     * @param {number} count - Number of collectibles to spawn
     */
    spawnCollectibles(scene, biome = 'nebula', count = 10) {
        if (!scene) return [];

        const availableTypes = this.getCollectiblesForBiome(biome);
        const totalWeight = availableTypes.reduce((sum, c) => sum + c.spawnWeight, 0);

        const worldBounds = {
            minX: 100,
            maxX: scene.cameras.main.width * 3 - 100,
            minY: 100,
            maxY: scene.cameras.main.height * 2 - 100
        };

        const spawnedCollectibles = [];

        for (let i = 0; i < count; i++) {
            // Weighted random selection
            let random = Math.random() * totalWeight;
            let selectedType = availableTypes[0];

            for (const type of availableTypes) {
                random -= type.spawnWeight;
                if (random <= 0) {
                    selectedType = type;
                    break;
                }
            }

            // Random position
            const x = Phaser.Math.Between(worldBounds.minX, worldBounds.maxX);
            const y = Phaser.Math.Between(worldBounds.minY, worldBounds.maxY);

            // Create collectible object
            const collectible = this.createCollectible(scene, selectedType, x, y, biome);
            if (collectible) {
                spawnedCollectibles.push(collectible);
                this.collectibles.push(collectible);
            }
        }

        console.log(`[CollectibleManager] Spawned ${spawnedCollectibles.length} collectibles in ${biome}`);
        return spawnedCollectibles;
    }

    /**
     * Create a single collectible in the scene
     * Now uses programmatic sprites instead of emoji icons
     */
    createCollectible(scene, type, x, y, biome) {
        const collectibleId = `collectible_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create visual representation
        const container = scene.add.container(x, y);
        container.setDepth(15);

        // Standard rarity colors (white/green/blue/purple/gold)
        const rarityColors = {
            common: 0x9E9E9E,
            uncommon: 0x4CAF50,
            rare: 0x2196F3,
            epic: 0x9C27B0,
            biome: 0x9C27B0,
            legendary: 0xFFD700,
            lore: 0x00BCD4
        };

        const rarityColor = rarityColors[type.rarity] || 0x9E9E9E;

        // Outer glow effect based on rarity
        const outerGlow = scene.add.graphics();
        outerGlow.fillStyle(rarityColor, 0.2);
        outerGlow.fillCircle(0, 0, 35);
        container.add(outerGlow);

        // Glow effect
        const glow = scene.add.graphics();
        glow.fillStyle(type.glowColor, 0.3);
        glow.fillCircle(0, 0, 25);
        container.add(glow);

        // Try to use programmatic sprite texture
        const textureName = this.spriteTextureMap[type.id];
        let hasSprite = false;

        if (textureName && scene.textures.exists(textureName)) {
            // Use programmatic sprite
            const sprite = scene.add.image(0, 0, textureName);
            sprite.setScale(0.6);
            container.add(sprite);
            hasSprite = true;
        } else {
            // Fallback: draw a colored circle with glow
            const main = scene.add.graphics();
            main.fillStyle(type.color, 1);
            main.fillCircle(0, 0, 15);
            main.lineStyle(2, 0xFFFFFF, 0.8);
            main.strokeCircle(0, 0, 15);
            container.add(main);

            // Small inner highlight
            const highlight = scene.add.graphics();
            highlight.fillStyle(0xFFFFFF, 0.4);
            highlight.fillCircle(-4, -4, 5);
            container.add(highlight);
        }

        // Rarity indicator (colored ring) - always show
        const rarityRing = scene.add.graphics();
        rarityRing.lineStyle(3, rarityColor, 0.9);
        rarityRing.strokeCircle(0, 0, hasSprite ? 24 : 20);
        container.add(rarityRing);

        // Floating animation
        scene.tweens.add({
            targets: container,
            y: y - 8,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Glow pulse animation
        scene.tweens.add({
            targets: [glow, outerGlow],
            alpha: { from: 0.3, to: 0.6 },
            scaleX: { from: 1, to: 1.15 },
            scaleY: { from: 1, to: 1.15 },
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        // Rarity ring pulse for rare+ items
        if (type.rarity === 'rare' || type.rarity === 'epic' || type.rarity === 'legendary') {
            scene.tweens.add({
                targets: rarityRing,
                alpha: { from: 0.9, to: 0.5 },
                duration: 600,
                yoyo: true,
                repeat: -1
            });
        }

        // Interactive zone
        const hitArea = scene.add.zone(0, 0, 60, 60);
        hitArea.setInteractive({ useHandCursor: true });
        container.add(hitArea);

        // Click to collect
        hitArea.on('pointerdown', () => {
            this.collectItem(scene, collectibleData);
        });

        // Store collectible data
        const collectibleData = {
            id: collectibleId,
            type: type,
            biome: biome,
            x: x,
            y: y,
            container: container,
            collected: false,
            textureName: textureName // Store for toast notification
        };

        return collectibleData;
    }

    /**
     * Collect an item
     * Now uses ToastNotificationSystem for pickup feedback
     */
    collectItem(scene, collectible) {
        if (!collectible || collectible.collected) return;

        collectible.collected = true;

        const type = collectible.type;
        const { x, y } = collectible;

        // Calculate rewards
        const rewards = {};
        if (type.reward.coins) {
            rewards.coins = Phaser.Math.Between(type.reward.coins.min, type.reward.coins.max);
        }
        if (type.reward.xp) {
            rewards.xp = Phaser.Math.Between(type.reward.xp.min, type.reward.xp.max);
        }

        // Grant rewards
        if (rewards.coins && window.EconomyManager) {
            window.EconomyManager.addCoins(rewards.coins, `collectible_${type.id}`);
        }
        if (rewards.xp && window.GameState) {
            window.GameState.updateCreature({ experience: rewards.xp });
        }

        // Track for quests
        if (window.QuestManager) {
            window.QuestManager.trackProgress('collect_items', { count: 1 });

            if (type.questRelevant && type.biome && type.item) {
                window.QuestManager.trackProgress('collect_items', {
                    count: 1,
                    biome: type.biome,
                    item: type.item
                });
            }
        }

        // Track collection - check for first discovery bonus
        const isFirstDiscovery = !this.collectedItems[type.id] || this.collectedItems[type.id] === 0;
        if (!this.collectedItems[type.id]) {
            this.collectedItems[type.id] = 0;
        }
        this.collectedItems[type.id]++;

        // First discovery bonus!
        if (isFirstDiscovery) {
            const discoveryBonus = Math.floor((rewards.coins || 0) * 0.5) + 10;
            if (window.EconomyManager) {
                window.EconomyManager.addCoins(discoveryBonus, `discovery_bonus_${type.id}`);
            }
            rewards.discoveryBonus = discoveryBonus;

            // Track discovery for quests
            if (window.QuestManager) {
                window.QuestManager.trackProgress('discover_species', { count: 1 });
            }

            // Emit discovery event
            this.emit('newDiscovery', {
                type,
                totalDiscovered: Object.keys(this.collectedItems).length
            });

            console.log(`[CollectibleManager] New discovery: ${type.name}! Bonus: +${discoveryBonus} coins`);
        }

        // Add to discovery log
        this.discoveryLog.push({
            typeId: type.id,
            name: type.name,
            biome: collectible.biome,
            timestamp: Date.now(),
            rewards
        });

        // Save state
        this.saveCollectionState();

        // Visual feedback - collection effect on the item
        this.showCollectionEffect(scene, collectible, rewards, isFirstDiscovery);

        // Show toast notification using ToastNotificationSystem
        if (window.ToastNotificationSystem) {
            window.ToastNotificationSystem.showPickupToast(scene, {
                itemName: type.name,
                itemId: type.id,
                rarity: type.rarity,
                rewards: rewards,
                description: type.description || '',
                isFirstDiscovery: isFirstDiscovery,
                textureName: collectible.textureName
            });
        }

        // Emit event
        this.emit('itemCollected', {
            collectible,
            rewards,
            totalCollected: this.collectedItems[type.id]
        });

        // Special handling for lore fragments
        if (type.isLore && isFirstDiscovery) {
            // Delay lore popup so toast can be seen first
            scene.time.delayedCall(800, () => {
                this.showLorePopup(scene, type);
            });
        }

        console.log(`[CollectibleManager] Collected ${type.name}:`, rewards);
    }

    /**
     * Show lore popup when collecting a lore fragment
     */
    showLorePopup(scene, loreType) {
        if (!scene) return;

        const { width, height } = scene.scale;

        // Create overlay
        const overlay = scene.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, width, height);
        overlay.setScrollFactor(0);
        overlay.setDepth(6000);

        // Lore panel
        const panelWidth = Math.min(450, width - 40);
        const panelHeight = 320;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = scene.add.graphics();
        panel.fillStyle(0x1A1A3E, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.lineStyle(3, loreType.color || 0x7B68EE);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15);
        panel.setScrollFactor(0);
        panel.setDepth(6001);

        // Lore icon
        const icon = scene.add.text(width / 2, panelY + 30, loreType.icon || '📜', {
            fontSize: '36px'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(6002);

        // Title
        const title = scene.add.text(width / 2, panelY + 75, `📖 ${loreType.loreTitle || 'Lore Fragment'}`, {
            fontSize: '20px',
            color: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(6002);

        // Lore text
        const loreText = scene.add.text(width / 2, panelY + 120, loreType.loreText || 'A mysterious fragment...', {
            fontSize: '14px',
            color: '#FFFFFF',
            align: 'center',
            lineSpacing: 6,
            wordWrap: { width: panelWidth - 40 }
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(6002);

        // Close button
        const closeBtn = scene.add.text(width / 2, panelY + panelHeight - 40, 'Continue', {
            fontSize: '18px',
            color: '#FFFFFF',
            backgroundColor: '#7B68EE',
            padding: { x: 25, y: 10 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(6002);
        closeBtn.setInteractive({ useHandCursor: true });

        const elements = [overlay, panel, icon, title, loreText, closeBtn];

        closeBtn.on('pointerdown', () => {
            elements.forEach(el => el.destroy());
        });

        closeBtn.on('pointerover', () => closeBtn.setStyle({ backgroundColor: '#6a5acd' }));
        closeBtn.on('pointerout', () => closeBtn.setStyle({ backgroundColor: '#7B68EE' }));

        // ESC to close
        const escHandler = (event) => {
            if (event.key === 'Escape') {
                elements.forEach(el => el.destroy());
                scene.input.keyboard.off('keydown', escHandler);
            }
        };
        scene.input.keyboard.on('keydown', escHandler);

        // Emit lore discovered event
        this.emit('loreDiscovered', {
            loreId: loreType.id,
            loreTitle: loreType.loreTitle,
            totalLore: this.getCollectedLore().length
        });
    }

    /**
     * Show collection visual effect on the item itself
     * Toast notification handles the main pickup feedback
     */
    showCollectionEffect(scene, collectible, rewards, isFirstDiscovery = false) {
        const { container, type } = collectible;
        const { x, y } = container;

        // Standard rarity colors for particle effects
        const rarityColors = {
            common: 0x9E9E9E,
            uncommon: 0x4CAF50,
            rare: 0x2196F3,
            epic: 0x9C27B0,
            legendary: 0xFFD700
        };
        const rarityColor = rarityColors[type.rarity] || 0x9E9E9E;

        // Burst animation on the collectible
        scene.tweens.add({
            targets: container,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                container.destroy();
            }
        });

        // Particle burst with rarity-appropriate colors
        if (window.FXLibrary) {
            const particleCount = isFirstDiscovery ? 20 : 10;
            window.FXLibrary.stardustBurst(scene, x, y, {
                count: particleCount,
                color: [rarityColor, type.glowColor, 0xFFFFFF],
                duration: 1000
            });
        }

        // Simple floating reward indicator at pickup location
        let rewardText = '';
        if (rewards.coins) rewardText += `+${rewards.coins}`;
        if (rewards.xp) rewardText += ` +${rewards.xp}XP`;

        const floatingText = scene.add.text(x, y - 20, rewardText.trim(), {
            fontSize: '16px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(100);

        scene.tweens.add({
            targets: floatingText,
            y: y - 60,
            alpha: 0,
            duration: 1000,
            onComplete: () => floatingText.destroy()
        });

        // Extra sparkle for first discoveries
        if (isFirstDiscovery) {
            const newText = scene.add.text(x, y + 10, 'NEW!', {
                fontSize: '14px',
                color: '#00FF88',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(100);

            scene.tweens.add({
                targets: newText,
                y: y - 30,
                alpha: 0,
                duration: 1200,
                delay: 200,
                onComplete: () => newText.destroy()
            });
        }
    }

    /**
     * Show discovery notification for special items
     */
    showDiscoveryNotification(scene, type) {
        const { width, height } = scene.scale;

        // Banner at top of screen
        const banner = scene.add.graphics();
        banner.fillStyle(0x000000, 0.8);
        banner.fillRect(0, 50, width, 60);
        banner.setDepth(200);
        banner.setAlpha(0);

        const rarityColors = {
            rare: '#0088FF',
            legendary: '#FFD700',
            biome: '#FF00FF'
        };

        const text = scene.add.text(width / 2, 80, `✨ DISCOVERED: ${type.name} ✨`, {
            fontSize: '24px',
            color: rarityColors[type.rarity] || '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201).setAlpha(0);

        // Animate in
        scene.tweens.add({
            targets: [banner, text],
            alpha: 1,
            duration: 300,
            onComplete: () => {
                // Hold then fade out
                scene.time.delayedCall(2000, () => {
                    scene.tweens.add({
                        targets: [banner, text],
                        alpha: 0,
                        duration: 500,
                        onComplete: () => {
                            banner.destroy();
                            text.destroy();
                        }
                    });
                });
            }
        });
    }

    /**
     * Check if player is near a collectible (for auto-collection)
     */
    checkProximityCollection(scene, playerX, playerY, collectionRadius = 50) {
        this.collectibles.forEach(collectible => {
            if (collectible.collected) return;

            const distance = Phaser.Math.Distance.Between(
                playerX, playerY,
                collectible.x, collectible.y
            );

            if (distance < collectionRadius) {
                this.collectItem(scene, collectible);
            }
        });
    }

    /**
     * Get collection statistics
     */
    getCollectionStats() {
        const totalCollected = Object.values(this.collectedItems).reduce((sum, count) => sum + count, 0);

        const byRarity = {
            common: 0,
            uncommon: 0,
            rare: 0,
            biome: 0,
            legendary: 0
        };

        // Count by rarity
        Object.entries(this.collectedItems).forEach(([typeId, count]) => {
            const allTypes = [
                ...this.collectibleTypes.common,
                ...this.collectibleTypes.uncommon,
                ...this.collectibleTypes.rare,
                ...this.collectibleTypes.secret
            ];

            const type = allTypes.find(t => t.id === typeId);
            if (type) {
                byRarity[type.rarity] = (byRarity[type.rarity] || 0) + count;
            }
        });

        return {
            total: totalCollected,
            byRarity,
            uniqueTypes: Object.keys(this.collectedItems).length,
            recentDiscoveries: this.discoveryLog.slice(-10)
        };
    }

    /**
     * Clear all collectibles from scene
     */
    clearCollectibles() {
        this.collectibles.forEach(collectible => {
            if (collectible.container && !collectible.collected) {
                collectible.container.destroy();
            }
        });
        this.collectibles = [];
    }

    /**
     * Save collection state
     */
    saveCollectionState() {
        if (window.GameState) {
            window.GameState.set('collectibles.collected', this.collectedItems);
            window.GameState.set('collectibles.discoveryLog', this.discoveryLog.slice(-50)); // Keep last 50
        }
    }

    /**
     * Load collection state
     */
    loadCollectionState() {
        if (window.GameState) {
            this.collectedItems = window.GameState.get('collectibles.collected') || {};
            this.discoveryLog = window.GameState.get('collectibles.discoveryLog') || [];
        }
    }

    /**
     * Event emitter methods
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.delete(callback);
        }
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[CollectibleManager] Event listener error for ${event}:`, error);
                }
            });
        }
    }
}

// Create singleton and export
const collectibleManager = new CollectibleManager();

if (typeof window !== 'undefined') {
    window.CollectibleManager = collectibleManager;
}

export default collectibleManager;
