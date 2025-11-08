/**
 * Logger - Centralized logging system with levels and filtering
 * Replaces scattered console.log statements throughout the codebase
 *
 * Log Levels:
 * - DEBUG: Detailed debugging information (development only)
 * - INFO: General informational messages
 * - WARN: Warning messages for non-critical issues
 * - ERROR: Error messages for critical failures
 *
 * Usage:
 *   Logger.debug('GameState', 'State updated:', newState);
 *   Logger.info('HatchingScene', 'Creature hatched successfully');
 *   Logger.warn('GraphicsEngine', 'Texture cache full');
 *   Logger.error('API', 'Failed to fetch data:', error);
 */

class LoggerClass {
    constructor() {
        this.levels = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3,
            NONE: 4
        };

        // Set default level based on environment
        this.currentLevel = this.levels.DEBUG;
        this.enabledCategories = new Set(); // Empty = all enabled
        this.disabledCategories = new Set();

        // Load config from environment
        this.loadConfig();
    }

    loadConfig() {
        // Check for Vite environment variables
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            const logLevel = import.meta.env.VITE_LOG_LEVEL;
            if (logLevel && this.levels[logLevel.toUpperCase()] !== undefined) {
                this.currentLevel = this.levels[logLevel.toUpperCase()];
            }
        }

        // Production mode: only show WARN and ERROR by default
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) {
            this.currentLevel = this.levels.WARN;
        }
    }

    /**
     * Set the minimum log level
     * @param {string} level - DEBUG, INFO, WARN, ERROR, or NONE
     */
    setLevel(level) {
        const upperLevel = level.toUpperCase();
        if (this.levels[upperLevel] !== undefined) {
            this.currentLevel = this.levels[upperLevel];
            console.log(`[Logger] Log level set to: ${upperLevel}`);
        } else {
            console.warn(`[Logger] Invalid log level: ${level}`);
        }
    }

    /**
     * Enable logging only for specific categories
     * @param {string[]} categories - Array of category names to enable
     */
    enableOnly(categories) {
        this.enabledCategories = new Set(categories);
        console.log(`[Logger] Enabled categories:`, categories);
    }

    /**
     * Disable logging for specific categories
     * @param {string[]} categories - Array of category names to disable
     */
    disable(categories) {
        categories.forEach(cat => this.disabledCategories.add(cat));
        console.log(`[Logger] Disabled categories:`, categories);
    }

    /**
     * Clear all category filters
     */
    clearFilters() {
        this.enabledCategories.clear();
        this.disabledCategories.clear();
        console.log(`[Logger] All category filters cleared`);
    }

    /**
     * Check if a category should be logged
     */
    shouldLog(level, category) {
        // Check log level
        if (level < this.currentLevel) {
            return false;
        }

        // Check category filters
        if (this.disabledCategories.has(category)) {
            return false;
        }

        if (this.enabledCategories.size > 0 && !this.enabledCategories.has(category)) {
            return false;
        }

        return true;
    }

    /**
     * Format a log message with timestamp and category
     */
    format(level, category, ...args) {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const levelStr = Object.keys(this.levels).find(k => this.levels[k] === level);
        return [`[${timestamp}] [${levelStr}] [${category}]`, ...args];
    }

    /**
     * Log a DEBUG message (development only)
     */
    debug(category, ...args) {
        if (this.shouldLog(this.levels.DEBUG, category)) {
            console.log(...this.format(this.levels.DEBUG, category, ...args));
        }
    }

    /**
     * Log an INFO message
     */
    info(category, ...args) {
        if (this.shouldLog(this.levels.INFO, category)) {
            console.log(...this.format(this.levels.INFO, category, ...args));
        }
    }

    /**
     * Log a WARN message
     */
    warn(category, ...args) {
        if (this.shouldLog(this.levels.WARN, category)) {
            console.warn(...this.format(this.levels.WARN, category, ...args));
        }
    }

    /**
     * Log an ERROR message
     */
    error(category, ...args) {
        if (this.shouldLog(this.levels.ERROR, category)) {
            console.error(...this.format(this.levels.ERROR, category, ...args));
        }
    }

    /**
     * Create a scoped logger for a specific category
     * Returns an object with bound methods for that category
     */
    scope(category) {
        return {
            debug: (...args) => this.debug(category, ...args),
            info: (...args) => this.info(category, ...args),
            warn: (...args) => this.warn(category, ...args),
            error: (...args) => this.error(category, ...args)
        };
    }

    /**
     * Group related log messages
     */
    group(label) {
        console.group(label);
    }

    groupEnd() {
        console.groupEnd();
    }
}

// Create singleton instance
const Logger = new LoggerClass();

// Export for ES modules
export default Logger;

// Also export to window for legacy compatibility
if (typeof window !== 'undefined') {
    window.Logger = Logger;
}
