/**
 * ErrorHandler - Centralized error handling system with recovery options
 * Provides user-friendly error messages and recovery mechanisms
 */

class ErrorHandler {
    constructor() {
        this.errorQueue = [];
        this.maxErrors = 10;
        this.errorContainer = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the error handler system
     */
    initialize() {
        if (this.isInitialized) return;

        // Create error container
        this.createErrorContainer();

        // Set up global error handlers
        this.setupGlobalHandlers();

        // Set up Phaser error handling
        this.setupPhaserErrorHandling();

        this.isInitialized = true;
        console.log('[ErrorHandler] Error handling system initialized');
    }

    /**
     * Create the error message container
     */
    createErrorContainer() {
        // Remove existing container if present
        const existing = document.getElementById('error-handler-container');
        if (existing) {
            existing.remove();
        }

        // Create new container
        const container = document.createElement('div');
        container.id = 'error-handler-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 400px;
            z-index: 100000;
            pointer-events: none;
        `;
        document.body.appendChild(container);
        this.errorContainer = container;
    }

    /**
     * Set up global error handlers
     */
    setupGlobalHandlers() {
        // Handle uncaught errors
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'runtime',
                message: event.message,
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                error: event.error,
                severity: 'error'
            });

            // Prevent default error handling
            event.preventDefault();
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'promise',
                message: event.reason?.message || 'Unhandled promise rejection',
                error: event.reason,
                severity: 'warning'
            });

            // Prevent default handling
            event.preventDefault();
        });
    }

    /**
     * Set up Phaser-specific error handling
     */
    setupPhaserErrorHandling() {
        // Will be called from main.js after Phaser initialization
    }

    /**
     * Handle an error with appropriate user feedback
     */
    handleError(errorInfo) {
        // Log to console for debugging
        console.error('[ErrorHandler]', errorInfo);

        // Add to error queue
        this.errorQueue.push({
            ...errorInfo,
            timestamp: Date.now()
        });

        // Trim queue if too long
        if (this.errorQueue.length > this.maxErrors) {
            this.errorQueue.shift();
        }

        // Determine if error is recoverable
        const isRecoverable = this.isErrorRecoverable(errorInfo);

        // Show user-friendly error message
        this.showErrorMessage(errorInfo, isRecoverable);

        // Auto-recover if possible
        if (isRecoverable) {
            this.attemptAutoRecovery(errorInfo);
        }
    }

    /**
     * Determine if an error is recoverable
     */
    isErrorRecoverable(errorInfo) {
        // Network errors are usually recoverable
        if (errorInfo.type === 'network') return true;

        // Save/load errors can be retried
        if (errorInfo.message?.includes('save') || errorInfo.message?.includes('load')) return true;

        // Asset loading errors can be retried
        if (errorInfo.message?.includes('texture') || errorInfo.message?.includes('asset')) return true;

        // API errors can fallback
        if (errorInfo.message?.includes('API') || errorInfo.message?.includes('fetch')) return true;

        // Scene transition errors might be recoverable
        if (errorInfo.message?.includes('scene')) return true;

        return false;
    }

    /**
     * Show user-friendly error message
     */
    showErrorMessage(errorInfo, isRecoverable) {
        if (!this.errorContainer) return;

        // Create error element
        const errorElement = document.createElement('div');
        errorElement.style.cssText = `
            background: ${errorInfo.severity === 'error' ? 'rgba(220, 53, 69, 0.95)' : 'rgba(255, 193, 7, 0.95)'};
            color: white;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            pointer-events: auto;
            animation: slideIn 0.3s ease-out;
        `;

        // Add animation styles
        if (!document.getElementById('error-handler-styles')) {
            const style = document.createElement('style');
            style.id = 'error-handler-styles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes fadeOut {
                    to {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Create message content
        const icon = errorInfo.severity === 'error' ? '❌' : '⚠️';
        const title = this.getFriendlyErrorTitle(errorInfo);
        const message = this.getFriendlyErrorMessage(errorInfo);

        errorElement.innerHTML = `
            <div style="display: flex; align-items: start;">
                <span style="font-size: 20px; margin-right: 10px;">${icon}</span>
                <div style="flex: 1;">
                    <div style="font-weight: bold; margin-bottom: 5px;">${title}</div>
                    <div style="opacity: 0.9; font-size: 13px;">${message}</div>
                    ${isRecoverable ? this.getRecoveryOptions(errorInfo) : ''}
                </div>
                <button onclick="ErrorHandler.dismissError(this)" style="
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    font-size: 20px;
                    padding: 0;
                    margin-left: 10px;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">×</button>
            </div>
        `;

        // Add to container
        this.errorContainer.appendChild(errorElement);

        // Auto-dismiss after delay (longer for errors)
        const dismissDelay = errorInfo.severity === 'error' ? 8000 : 5000;
        setTimeout(() => {
            this.dismissErrorElement(errorElement);
        }, dismissDelay);
    }

    /**
     * Get user-friendly error title
     */
    getFriendlyErrorTitle(errorInfo) {
        if (errorInfo.type === 'network') return 'Connection Issue';
        if (errorInfo.type === 'promise') return 'Background Operation Failed';
        if (errorInfo.message?.includes('save')) return 'Save Failed';
        if (errorInfo.message?.includes('load')) return 'Load Failed';
        if (errorInfo.message?.includes('texture')) return 'Graphics Loading Error';
        if (errorInfo.message?.includes('scene')) return 'Scene Transition Error';
        if (errorInfo.message?.includes('API')) return 'API Connection Issue';
        return errorInfo.severity === 'error' ? 'Something Went Wrong' : 'Warning';
    }

    /**
     * Get user-friendly error message
     */
    getFriendlyErrorMessage(errorInfo) {
        if (errorInfo.type === 'network') {
            return 'Please check your internet connection and try again.';
        }
        if (errorInfo.message?.includes('save')) {
            return 'Your progress could not be saved. We\'ll try again automatically.';
        }
        if (errorInfo.message?.includes('load')) {
            return 'Could not load your saved game. Starting with defaults.';
        }
        if (errorInfo.message?.includes('texture')) {
            return 'Some graphics failed to load. The game may look different.';
        }
        if (errorInfo.message?.includes('scene')) {
            return 'Failed to transition between game screens.';
        }
        if (errorInfo.message?.includes('API')) {
            return 'Cannot connect to game services. Some features may be limited.';
        }
        return 'The game encountered an issue but should continue working.';
    }

    /**
     * Get recovery option buttons
     */
    getRecoveryOptions(errorInfo) {
        const options = [];

        if (errorInfo.type === 'network' || errorInfo.message?.includes('API')) {
            options.push(`
                <button onclick="ErrorHandler.retryLastAction()" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    padding: 4px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    margin-top: 8px;
                    margin-right: 5px;
                    transition: background 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
                   onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                    Retry
                </button>
            `);
        }

        if (errorInfo.severity === 'error') {
            options.push(`
                <button onclick="ErrorHandler.reloadGame()" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    padding: 4px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    margin-top: 8px;
                    transition: background 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
                   onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                    Restart Game
                </button>
            `);
        }

        return options.length > 0 ? `<div>${options.join('')}</div>` : '';
    }

    /**
     * Attempt automatic recovery
     */
    attemptAutoRecovery(errorInfo) {
        // Auto-retry network requests
        if (errorInfo.type === 'network') {
            setTimeout(() => {
                console.log('[ErrorHandler] Attempting network retry...');
                // Trigger network retry logic
                if (window.mythicalGame) {
                    window.mythicalGame.events.emit('network-retry');
                }
            }, 2000);
        }

        // Auto-retry save operations
        if (errorInfo.message?.includes('save')) {
            setTimeout(() => {
                console.log('[ErrorHandler] Attempting to save again...');
                if (window.GameState) {
                    GameState.save();
                }
            }, 3000);
        }

        // Fallback for API errors
        if (errorInfo.message?.includes('API')) {
            console.log('[ErrorHandler] Switching to offline mode...');
            if (window.CreatureAI) {
                window.CreatureAI.enableFallbackMode();
            }
        }
    }

    /**
     * Dismiss error element with animation
     */
    dismissErrorElement(element) {
        if (!element || !element.parentNode) return;
        
        element.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            if (element.parentNode) {
                element.remove();
            }
        }, 300);
    }

    /**
     * Static method to dismiss error (for onclick)
     */
    static dismissError(button) {
        const errorElement = button.closest('div').parentNode;
        if (window.errorHandler) {
            window.errorHandler.dismissErrorElement(errorElement);
        }
    }

    /**
     * Static method to retry last action
     */
    static retryLastAction() {
        console.log('[ErrorHandler] Retrying last action...');
        if (window.mythicalGame) {
            window.mythicalGame.events.emit('retry-last-action');
        }
    }

    /**
     * Static method to reload game
     */
    static reloadGame() {
        console.log('[ErrorHandler] Reloading game...');
        // Save current state first
        if (window.GameState) {
            GameState.save();
        }
        // Reload page
        setTimeout(() => {
            window.location.reload();
        }, 100);
    }

    /**
     * Get error statistics
     */
    getErrorStats() {
        const stats = {
            total: this.errorQueue.length,
            errors: this.errorQueue.filter(e => e.severity === 'error').length,
            warnings: this.errorQueue.filter(e => e.severity === 'warning').length,
            recent: this.errorQueue.slice(-5)
        };
        return stats;
    }

    /**
     * Clear error queue
     */
    clearErrors() {
        this.errorQueue = [];
        if (this.errorContainer) {
            this.errorContainer.innerHTML = '';
        }
    }
}

// Create global instance
window.ErrorHandler = ErrorHandler;
window.errorHandler = new ErrorHandler();