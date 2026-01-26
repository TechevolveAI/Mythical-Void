/**
 * EconomyManager - Manages the game's currency system
 * Handles Cosmic Coins (primary) and Stardust (premium earned currency)
 */

class EconomyManager {
    constructor() {
        this.initialized = false;
        this.currencyName = 'cosmicCoins';
        this.premiumCurrencyName = 'stardust';
        this.events = new Phaser.Events.EventEmitter();

        // Stardust to Coins conversion rate
        this.STARDUST_TO_COINS_RATE = 100; // 1 Stardust = 100 Coins
    }

    /**
     * Initialize the economy system
     */
    initialize() {
        if (this.initialized) {
            console.warn('[EconomyManager] Already initialized');
            return;
        }

        // Ensure GameState has currency fields
        if (typeof window !== 'undefined' && window.GameState) {
            const currentCoins = window.GameState.get('player.cosmicCoins');
            if (currentCoins === undefined) {
                window.GameState.set('player.cosmicCoins', 0);
                console.log('[EconomyManager] Initialized player.cosmicCoins to 0');
            }

            const currentStardust = window.GameState.get('player.stardust');
            if (currentStardust === undefined) {
                window.GameState.set('player.stardust', 0);
                console.log('[EconomyManager] Initialized player.stardust to 0');
            }
        }

        this.initialized = true;
        console.log('✅ EconomyManager initialized with Coins + Stardust');
    }

    /**
     * Get current cosmic coins balance
     * @returns {number} Current balance
     */
    getBalance() {
        if (typeof window === 'undefined' || !window.GameState) {
            console.error('[EconomyManager] GameState not available');
            return 0;
        }
        return window.GameState.get('player.cosmicCoins') || 0;
    }

    /**
     * Add cosmic coins with visual feedback event
     * @param {number} amount - Amount to add
     * @param {string} source - Source of coins (e.g., 'collection', 'enemy_drop', 'quest')
     */
    addCoins(amount, source = 'unknown') {
        if (!this.initialized) {
            console.error('[EconomyManager] Not initialized');
            return;
        }

        if (typeof amount !== 'number' || amount <= 0) {
            console.error('[EconomyManager] Invalid amount:', amount);
            return;
        }

        const currentBalance = this.getBalance();
        const newBalance = currentBalance + amount;

        window.GameState.set('player.cosmicCoins', newBalance);

        // Play coin collection sound
        if (typeof window !== 'undefined' && window.AudioManager) {
            window.AudioManager.playCoinCollect();
        }

        // Emit event for UI updates and animations
        this.events.emit('coins:added', {
            amount,
            source,
            oldBalance: currentBalance,
            newBalance: newBalance
        });

        console.log(`[EconomyManager] +${amount} coins from ${source} (${currentBalance} → ${newBalance})`);

        return newBalance;
    }

    /**
     * Remove cosmic coins (for purchases)
     * @param {number} amount - Amount to remove
     * @param {string} reason - Reason for spending (e.g., 'shop_purchase')
     * @returns {boolean} True if successful, false if insufficient funds
     */
    removeCoins(amount, reason = 'unknown') {
        if (!this.initialized) {
            console.error('[EconomyManager] Not initialized');
            return false;
        }

        if (typeof amount !== 'number' || amount <= 0) {
            console.error('[EconomyManager] Invalid amount:', amount);
            return false;
        }

        const currentBalance = this.getBalance();

        if (currentBalance < amount) {
            console.warn(`[EconomyManager] Insufficient funds: need ${amount}, have ${currentBalance}`);

            // Play error sound
            if (typeof window !== 'undefined' && window.AudioManager) {
                window.AudioManager.playError();
            }

            this.events.emit('coins:insufficient', {
                amount,
                currentBalance,
                shortfall: amount - currentBalance
            });
            return false;
        }

        const newBalance = currentBalance - amount;
        window.GameState.set('player.cosmicCoins', newBalance);

        // Play purchase sound
        if (typeof window !== 'undefined' && window.AudioManager) {
            window.AudioManager.playPurchase();
        }

        // Emit event for UI updates
        this.events.emit('coins:spent', {
            amount,
            reason,
            oldBalance: currentBalance,
            newBalance: newBalance
        });

        console.log(`[EconomyManager] -${amount} coins for ${reason} (${currentBalance} → ${newBalance})`);

        return true;
    }

    /**
     * Check if player can afford a purchase
     * @param {number} price - Price to check
     * @returns {boolean} True if affordable
     */
    canAfford(price) {
        if (typeof price !== 'number' || price < 0) {
            console.error('[EconomyManager] Invalid price:', price);
            return false;
        }

        return this.getBalance() >= price;
    }

    /**
     * Purchase an item (combines canAfford + removeCoins)
     * @param {number} price - Price of item
     * @param {string} itemName - Name of item for logging
     * @returns {boolean} True if purchase successful
     */
    purchase(price, itemName = 'Unknown Item') {
        if (!this.canAfford(price)) {
            console.warn(`[EconomyManager] Cannot afford ${itemName} (${price} coins)`);
            return false;
        }

        return this.removeCoins(price, `purchase:${itemName}`);
    }

    /**
     * Format coins for display
     * @param {number} amount - Amount to format
     * @returns {string} Formatted string (e.g., "1,234")
     */
    formatCoins(amount) {
        if (typeof amount !== 'number') return '0';
        return Math.floor(amount).toLocaleString();
    }

    /**
     * Listen to economy events
     * @param {string} event - Event name (coins:added, coins:spent, coins:insufficient)
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

    // ==================== STARDUST METHODS ====================

    /**
     * Get current Stardust balance
     * @returns {number} Current Stardust balance
     */
    getStardust() {
        if (typeof window === 'undefined' || !window.GameState) {
            console.error('[EconomyManager] GameState not available');
            return 0;
        }
        return window.GameState.get('player.stardust') || 0;
    }

    /**
     * Add Stardust (premium earned currency)
     * @param {number} amount - Amount to add
     * @param {string} source - Source of Stardust (e.g., 'achievement', 'milestone')
     */
    addStardust(amount, source = 'unknown') {
        if (!this.initialized) {
            console.error('[EconomyManager] Not initialized');
            return;
        }

        if (typeof amount !== 'number' || amount <= 0) {
            console.error('[EconomyManager] Invalid Stardust amount:', amount);
            return;
        }

        const currentBalance = this.getStardust();
        const newBalance = currentBalance + amount;

        window.GameState.set('player.stardust', newBalance);

        // Play special sound for Stardust (more prestigious)
        if (typeof window !== 'undefined' && window.AudioManager) {
            window.AudioManager.playLevelUp(); // Use level up sound for premium feel
        }

        // Emit event for UI updates
        this.events.emit('stardust:added', {
            amount,
            source,
            oldBalance: currentBalance,
            newBalance: newBalance
        });

        console.log(`[EconomyManager] +${amount} Stardust from ${source} (${currentBalance} → ${newBalance})`);

        return newBalance;
    }

    /**
     * Remove Stardust (for premium purchases)
     * @param {number} amount - Amount to remove
     * @param {string} reason - Reason for spending
     * @returns {boolean} True if successful
     */
    removeStardust(amount, reason = 'unknown') {
        if (!this.initialized) {
            console.error('[EconomyManager] Not initialized');
            return false;
        }

        if (typeof amount !== 'number' || amount <= 0) {
            console.error('[EconomyManager] Invalid Stardust amount:', amount);
            return false;
        }

        const currentBalance = this.getStardust();

        if (currentBalance < amount) {
            console.warn(`[EconomyManager] Insufficient Stardust: need ${amount}, have ${currentBalance}`);

            if (typeof window !== 'undefined' && window.AudioManager) {
                window.AudioManager.playError();
            }

            this.events.emit('stardust:insufficient', {
                amount,
                currentBalance,
                shortfall: amount - currentBalance
            });
            return false;
        }

        const newBalance = currentBalance - amount;
        window.GameState.set('player.stardust', newBalance);

        if (typeof window !== 'undefined' && window.AudioManager) {
            window.AudioManager.playPurchase();
        }

        this.events.emit('stardust:spent', {
            amount,
            reason,
            oldBalance: currentBalance,
            newBalance: newBalance
        });

        console.log(`[EconomyManager] -${amount} Stardust for ${reason} (${currentBalance} → ${newBalance})`);

        return true;
    }

    /**
     * Check if player can afford a Stardust purchase
     * @param {number} price - Stardust price to check
     * @returns {boolean} True if affordable
     */
    canAffordStardust(price) {
        if (typeof price !== 'number' || price < 0) {
            console.error('[EconomyManager] Invalid Stardust price:', price);
            return false;
        }
        return this.getStardust() >= price;
    }

    /**
     * Convert Stardust to Coins (one-way)
     * @param {number} stardustAmount - Amount of Stardust to convert
     * @returns {boolean} True if conversion successful
     */
    convertStardustToCoins(stardustAmount) {
        if (!this.canAffordStardust(stardustAmount)) {
            console.warn('[EconomyManager] Cannot afford Stardust conversion');
            return false;
        }

        const coinsToGrant = stardustAmount * this.STARDUST_TO_COINS_RATE;

        if (this.removeStardust(stardustAmount, 'conversion_to_coins')) {
            this.addCoins(coinsToGrant, 'stardust_conversion');
            console.log(`[EconomyManager] Converted ${stardustAmount} Stardust → ${coinsToGrant} Coins`);
            return true;
        }

        return false;
    }

    /**
     * Format Stardust for display
     * @param {number} amount - Amount to format
     * @returns {string} Formatted string
     */
    formatStardust(amount) {
        if (typeof amount !== 'number') return '0';
        return Math.floor(amount).toLocaleString();
    }

    // ==================== GENERAL METHODS ====================

    /**
     * Get statistics about economy
     * @returns {object} Economy statistics
     */
    getStats() {
        return {
            currentBalance: this.getBalance(),
            formattedBalance: this.formatCoins(this.getBalance()),
            currencyName: this.currencyName,
            stardust: this.getStardust(),
            formattedStardust: this.formatStardust(this.getStardust()),
            premiumCurrencyName: this.premiumCurrencyName
        };
    }

    /**
     * Reset economy (for debugging)
     */
    reset() {
        if (typeof window !== 'undefined' && window.GameState) {
            window.GameState.set('player.cosmicCoins', 0);
            window.GameState.set('player.stardust', 0);
            console.log('[EconomyManager] Economy reset to 0 coins and 0 Stardust');
        }
    }

    /**
     * Grant coins (debug/cheat command)
     * @param {number} amount - Amount to grant
     */
    grantCoins(amount) {
        this.addCoins(amount, 'debug:grant');
    }
}

// Export as singleton
const economyManager = new EconomyManager();

if (typeof window !== 'undefined') {
    window.EconomyManager = economyManager;
}

export default economyManager;
