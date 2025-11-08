/**
 * EconomyManager - Manages the game's currency system (Cosmic Coins)
 * Handles earning, spending, and validating currency transactions
 */

class EconomyManager {
    constructor() {
        this.initialized = false;
        this.currencyName = 'cosmicCoins';
        this.events = new Phaser.Events.EventEmitter();
    }

    /**
     * Initialize the economy system
     */
    initialize() {
        if (this.initialized) {
            console.warn('[EconomyManager] Already initialized');
            return;
        }

        // Ensure GameState has currency field
        if (typeof window !== 'undefined' && window.GameState) {
            const currentCoins = window.GameState.get('player.cosmicCoins');
            if (currentCoins === undefined) {
                window.GameState.set('player.cosmicCoins', 0);
                console.log('[EconomyManager] Initialized player.cosmicCoins to 0');
            }
        }

        this.initialized = true;
        console.log('✅ EconomyManager initialized');
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
            this.events.emit('coins:insufficient', {
                amount,
                currentBalance,
                shortfall: amount - currentBalance
            });
            return false;
        }

        const newBalance = currentBalance - amount;
        window.GameState.set('player.cosmicCoins', newBalance);

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

    /**
     * Get statistics about economy
     * @returns {object} Economy statistics
     */
    getStats() {
        return {
            currentBalance: this.getBalance(),
            formattedBalance: this.formatCoins(this.getBalance()),
            currencyName: this.currencyName
        };
    }

    /**
     * Reset economy (for debugging)
     */
    reset() {
        if (typeof window !== 'undefined' && window.GameState) {
            window.GameState.set('player.cosmicCoins', 0);
            console.log('[EconomyManager] Economy reset to 0 coins');
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
