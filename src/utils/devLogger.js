/**
 * Development Logger Utility
 * Provides console logging that only runs in development mode
 * In production builds, these logs are stripped out
 */

/**
 * Check if running in development mode
 * @returns {boolean} True if in development
 */
export const isDev = () => {
    return import.meta.env.DEV || import.meta.env.MODE === 'development';
};

/**
 * Log only in development mode
 * @param {...any} args - Arguments to log
 */
export const devLog = (...args) => {
    if (isDev()) {
        console.log(...args);
    }
};

/**
 * Warn only in development mode
 * @param {...any} args - Arguments to warn
 */
export const devWarn = (...args) => {
    if (isDev()) {
        console.warn(...args);
    }
};

/**
 * Debug-level logging (always suppressed in production)
 * @param {...any} args - Arguments to log
 */
export const devDebug = (...args) => {
    if (isDev()) {
        console.log('[DEBUG]', ...args);
    }
};

// Note: console.error should always be kept for production error tracking
// Use console.error directly for errors that need to be tracked in production
