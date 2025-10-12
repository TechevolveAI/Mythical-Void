/**
 * RaritySystem - Handles creature rarity rolling with pity system
 * Features: 5 rarity tiers, pity counter (guaranteed Epic+ after 10), probability tracking
 */

class RaritySystem {
    constructor() {
        // Rarity tier definitions
        this.rarities = {
            common: {
                name: 'Common',
                probability: 50,
                colorRange: { hue: [90, 150], sat: [40, 70], light: [45, 65] },
                examples: [0x228B22, 0x32CD32, 0x90EE90, 0x00FA9A],
                emoji: '🟢',
                displayColor: '#32CD32'
            },
            uncommon: {
                name: 'Uncommon',
                probability: 25,
                colorRange: { hue: [15, 45], sat: [50, 80], light: [50, 70] },
                examples: [0xFF8C00, 0xFFA500, 0xFF7F50, 0xFFB347],
                emoji: '🟠',
                displayColor: '#FF8C00'
            },
            rare: {
                name: 'Rare',
                probability: 15,
                colorRange: { hue: [340, 20], sat: [60, 85], light: [45, 65] },
                examples: [0xDC143C, 0xFF6B6B, 0xE74C3C, 0xFF1744],
                emoji: '🔴',
                displayColor: '#DC143C'
            },
            epic: {
                name: 'Epic',
                probability: 8,
                colorRange: { hue: [260, 290], sat: [50, 75], light: [40, 60] },
                examples: [0x9370DB, 0x8A2BE2, 0x6A0DAD, 0x4B0082],
                emoji: '🟣',
                displayColor: '#9370DB'
            },
            legendary: {
                name: 'Legendary',
                probability: 2,
                colorRange: { hue: [40, 60], sat: [70, 100], light: [50, 75] },
                examples: [0xFFD700, 0xFFC700, 0xFFB000, 0xF9A825],
                emoji: '🟨',
                displayColor: '#FFD700',
                metallic: true
            }
        };

        this.PITY_THRESHOLD = 10; // Guarantee Epic+ after 10 hatches
    }

    /**
     * Initialize pity system for a player
     */
    initializePitySystem() {
        return {
            hatchesSinceEpic: 0,
            guaranteedEpicNext: false,
            totalHatches: 0,
            pitiesTriggered: 0,
            lastHatchTime: null,
            history: [] // Last 20 hatches for stats
        };
    }

    /**
     * Roll rarity with pity system
     */
    rollRarity(pityData) {
        if (!pityData) {
            console.warn('[RaritySystem] No pity data provided, creating default');
            pityData = this.initializePitySystem();
        }

        // Check if pity threshold reached
        if (pityData.hatchesSinceEpic >= this.PITY_THRESHOLD) {
            pityData.guaranteedEpicNext = true;
            console.log('🎁 [RaritySystem] PITY ACTIVATED! Guaranteed Epic or Legendary!');
        }

        let rarity;

        // If pity is active, force Epic or Legendary
        if (pityData.guaranteedEpicNext) {
            rarity = this.rollPityRarity();
            pityData.hatchesSinceEpic = 0;
            pityData.guaranteedEpicNext = false;
            pityData.pitiesTriggered++;
            console.log(`✨ [RaritySystem] PITY HATCH: ${rarity.toUpperCase()}!`);
        } else {
            // Standard roll
            rarity = this.rollStandardRarity();
        }

        // Update pity counter
        if (rarity === 'epic' || rarity === 'legendary') {
            pityData.hatchesSinceEpic = 0;
        } else {
            pityData.hatchesSinceEpic++;
        }

        pityData.totalHatches++;
        pityData.lastHatchTime = Date.now();

        // Add to history (keep last 20)
        pityData.history.push({
            rarity,
            timestamp: Date.now(),
            wasPity: pityData.pitiesTriggered > 0 && (rarity === 'epic' || rarity === 'legendary')
        });
        if (pityData.history.length > 20) {
            pityData.history.shift();
        }

        console.log(`[RaritySystem] Rolled ${rarity} | Pity counter: ${pityData.hatchesSinceEpic}/${this.PITY_THRESHOLD}`);

        return { rarity, pityData };
    }

    /**
     * Standard probability roll
     */
    rollStandardRarity() {
        const roll = Math.random() * 100;

        if (roll < 50) return 'common';        // 0-50 (50%)
        if (roll < 75) return 'uncommon';      // 50-75 (25%)
        if (roll < 90) return 'rare';          // 75-90 (15%)
        if (roll < 98) return 'epic';          // 90-98 (8%)
        return 'legendary';                    // 98-100 (2%)
    }

    /**
     * Pity rarity roll (70% Epic, 30% Legendary)
     */
    rollPityRarity() {
        return Math.random() < 0.7 ? 'epic' : 'legendary';
    }

    /**
     * Get rarity info
     */
    getRarityInfo(rarity) {
        return this.rarities[rarity] || this.rarities.common;
    }

    /**
     * Get color from rarity palette
     */
    generateColorForRarity(rarity) {
        const rarityInfo = this.rarities[rarity];
        if (!rarityInfo) return 0x9370DB; // Default purple

        const { hue, sat, light } = rarityInfo.colorRange;

        // Handle hue wrap-around for red-pink
        let selectedHue;
        if (hue[0] > hue[1]) {
            // Wraps around 0 (e.g., 340-20 for red-pink)
            const range1 = 360 - hue[0];
            const range2 = hue[1];
            const totalRange = range1 + range2;
            const random = Math.random() * totalRange;

            if (random < range1) {
                selectedHue = hue[0] + random;
            } else {
                selectedHue = random - range1;
            }
        } else {
            selectedHue = this.randomInRange(hue[0], hue[1]);
        }

        const selectedSat = this.randomInRange(sat[0], sat[1]);
        const selectedLight = this.randomInRange(light[0], light[1]);

        return this.hslToHex(selectedHue, selectedSat, selectedLight);
    }

    /**
     * HSL to Hex conversion
     */
    hslToHex(h, s, l) {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return parseInt(`0x${f(0)}${f(8)}${f(4)}`);
    }

    /**
     * Random in range helper
     */
    randomInRange(min, max) {
        return min + Math.random() * (max - min);
    }

    /**
     * Shift hue for accent colors
     */
    shiftHue(baseColor, shift) {
        // Extract RGB
        const r = (baseColor >> 16) & 0xFF;
        const g = (baseColor >> 8) & 0xFF;
        const b = baseColor & 0xFF;

        // Convert to HSL
        const max = Math.max(r, g, b) / 255;
        const min = Math.min(r, g, b) / 255;
        const l = (max + min) / 2;

        let h = 0, s = 0;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            if (max === r / 255) h = ((g / 255 - b / 255) / d + (g < b ? 6 : 0));
            else if (max === g / 255) h = ((b / 255 - r / 255) / d + 2);
            else h = ((r / 255 - g / 255) / d + 4);

            h /= 6;
        }

        // Shift hue
        h = (h * 360 + shift) % 360;
        s = s * 100;
        const lightness = l * 100;

        return this.hslToHex(h, s, lightness);
    }

    /**
     * Get pity progress text
     */
    getPityProgressText(pityData) {
        if (!pityData) return 'Hatch Progress: Unknown';

        const remaining = this.PITY_THRESHOLD - pityData.hatchesSinceEpic;

        if (pityData.guaranteedEpicNext) {
            return '🌟 PITY READY! Next hatch guaranteed Epic+!';
        }

        if (remaining <= 3) {
            return `⚡ ${remaining} hatches until guaranteed Epic+!`;
        }

        return `Hatches until pity: ${remaining}/${this.PITY_THRESHOLD}`;
    }

    /**
     * Get pity progress percentage
     */
    getPityProgress(pityData) {
        if (!pityData) return 0;
        return (pityData.hatchesSinceEpic / this.PITY_THRESHOLD) * 100;
    }

    /**
     * Calculate statistics
     */
    calculateStats(pityData) {
        if (!pityData || !pityData.history || pityData.history.length === 0) {
            return {
                totalHatches: 0,
                commonRate: 0,
                uncommonRate: 0,
                rareRate: 0,
                epicRate: 0,
                legendaryRate: 0,
                pityRate: 0
            };
        }

        const counts = {
            common: 0,
            uncommon: 0,
            rare: 0,
            epic: 0,
            legendary: 0,
            pity: 0
        };

        pityData.history.forEach(entry => {
            counts[entry.rarity]++;
            if (entry.wasPity) counts.pity++;
        });

        const total = pityData.history.length;

        return {
            totalHatches: total,
            commonRate: (counts.common / total * 100).toFixed(1),
            uncommonRate: (counts.uncommon / total * 100).toFixed(1),
            rareRate: (counts.rare / total * 100).toFixed(1),
            epicRate: (counts.epic / total * 100).toFixed(1),
            legendaryRate: (counts.legendary / total * 100).toFixed(1),
            pityRate: (counts.pity / total * 100).toFixed(1)
        };
    }
}

// Create singleton
window.RaritySystem = RaritySystem;
window.raritySystem = new RaritySystem();

console.log('✅ [RaritySystem] Rarity system with pity mechanism loaded');
