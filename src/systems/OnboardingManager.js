/**
 * OnboardingManager - Coordinates all first-time and daily popups
 *
 * Ensures only one popup shows at a time and they appear in proper sequence:
 * 1. Controls Tutorial (first time only)
 * 2. Crash Story (first time only)
 * 3. Daily Greeting/Bonus (once per day)
 * 4. NASA Content (once per day)
 *
 * Each popup must be dismissed before the next one shows.
 */

import { devLog } from '../utils/devLogger.js';

class OnboardingManager {
    constructor() {
        this.isInitialized = false;
        this.currentPopup = null;
        this.popupQueue = [];
        this.scene = null;
        this.isProcessing = false;

        // Callbacks for when queue completes
        this.onQueueComplete = null;
    }

    /**
     * Initialize the onboarding manager with a scene reference
     * @param {Phaser.Scene} scene - The active scene
     */
    initialize(scene) {
        this.scene = scene;
        this.isInitialized = true;
        this.currentPopup = null;
        this.popupQueue = [];
        this.isProcessing = false;
        devLog('[OnboardingManager] Initialized');
    }

    /**
     * Check if the onboarding flow should run (new player)
     * @returns {boolean}
     */
    isNewPlayer() {
        return !window.GameState?.get('tutorial.controlsSeen');
    }

    /**
     * Check if daily content should show
     * @returns {boolean}
     */
    shouldShowDailyContent() {
        const today = new Date().toISOString().split('T')[0];
        const lastDailyShown = window.GameState?.get('session.lastDailyShown');
        return lastDailyShown !== today;
    }

    /**
     * Start the onboarding flow for the current scene
     * Queues appropriate popups based on player state
     */
    async startOnboardingFlow() {
        if (!this.isInitialized || !this.scene) {
            console.error('[OnboardingManager] Not initialized');
            return;
        }

        if (this.isProcessing) {
            devLog('[OnboardingManager] Already processing queue');
            return;
        }

        devLog('[OnboardingManager] Starting onboarding flow');
        this.isProcessing = true;

        // Build the queue based on player state
        this.popupQueue = [];

        // 1. Controls Tutorial (first time only)
        if (this.isNewPlayer()) {
            this.popupQueue.push({
                id: 'controls',
                type: 'controls_tutorial',
                priority: 1
            });
        }

        // 2. Crash Story (first time only)
        if (!window.GameState?.get('tutorial.crashStorySeen')) {
            this.popupQueue.push({
                id: 'crash_story',
                type: 'crash_story',
                priority: 2
            });
        }

        // 3. Daily Greeting/Bonus (once per day)
        if (this.shouldShowDailyContent()) {
            const dailyBonus = window.GameState?.getDailyLoginBonus?.();
            if (dailyBonus) {
                this.popupQueue.push({
                    id: 'daily_greeting',
                    type: 'daily_greeting',
                    data: dailyBonus,
                    priority: 3
                });
            }
        }

        // 4. NASA Content (once per day, separate from daily greeting)
        if (window.NASAContentSystem?.shouldShowDailyContent?.()) {
            this.popupQueue.push({
                id: 'nasa_content',
                type: 'nasa_content',
                priority: 4
            });
        }

        devLog(`[OnboardingManager] Queue built with ${this.popupQueue.length} items`);

        // Process the queue
        await this.processQueue();
    }

    /**
     * Process the popup queue one at a time
     */
    async processQueue() {
        if (this.popupQueue.length === 0) {
            devLog('[OnboardingManager] Queue complete');
            this.isProcessing = false;
            this.onQueueComplete?.();
            return;
        }

        const popup = this.popupQueue.shift();
        this.currentPopup = popup;
        devLog(`[OnboardingManager] Processing: ${popup.type}`);

        try {
            await this.showPopup(popup);
        } catch (error) {
            console.error(`[OnboardingManager] Error showing ${popup.type}:`, error);
        }

        // Continue with next popup
        this.currentPopup = null;
        await this.processQueue();
    }

    /**
     * Show a specific popup and wait for it to be dismissed
     * @param {Object} popup - The popup configuration
     * @returns {Promise} Resolves when popup is dismissed
     */
    async showPopup(popup) {
        return new Promise((resolve) => {
            switch (popup.type) {
                case 'controls_tutorial':
                    this.showControlsTutorial(resolve);
                    break;
                case 'crash_story':
                    this.showCrashStory(resolve);
                    break;
                case 'daily_greeting':
                    this.showDailyGreeting(popup.data, resolve);
                    break;
                case 'nasa_content':
                    this.showNASAContent(resolve);
                    break;
                default:
                    devLog(`[OnboardingManager] Unknown popup type: ${popup.type}`);
                    resolve();
            }
        });
    }

    /**
     * Show controls tutorial
     */
    showControlsTutorial(onComplete) {
        devLog('[OnboardingManager] Showing controls tutorial');

        if (!this.scene.controlsTutorial) {
            // Import dynamically if not available
            import('../ui/ControlsTutorialOverlay.js').then(module => {
                const ControlsTutorialOverlay = module.default;
                this.scene.controlsTutorial = new ControlsTutorialOverlay(this.scene);
                this.scene.controlsTutorial.show();
                this.waitForTutorialDismiss(onComplete);
            });
        } else {
            this.scene.controlsTutorial.show();
            this.waitForTutorialDismiss(onComplete);
        }
    }

    /**
     * Wait for controls tutorial to be dismissed
     */
    waitForTutorialDismiss(onComplete) {
        const checkInterval = this.scene.time.addEvent({
            delay: 100,
            callback: () => {
                if (!this.scene.controlsTutorial?.isVisible) {
                    checkInterval.remove();
                    // Small delay before next popup
                    this.scene.time.delayedCall(500, onComplete);
                }
            },
            loop: true
        });
    }

    /**
     * Show crash story
     */
    showCrashStory(onComplete) {
        devLog('[OnboardingManager] Showing crash story');

        // Mark as seen before showing to prevent double-show
        window.GameState?.set('tutorial.crashStorySeen', true);
        window.GameState?.save?.();

        // Use scene's showShipMemories method with callback
        if (this.scene.showShipMemoriesWithCallback) {
            this.scene.showShipMemoriesWithCallback(onComplete);
        } else if (this.scene.showShipMemories) {
            this.scene.showShipMemories();
            this.waitForStoryDismiss(onComplete);
        } else {
            devLog('[OnboardingManager] showShipMemories not available');
            onComplete();
        }
    }

    /**
     * Wait for story modal to be dismissed
     */
    waitForStoryDismiss(onComplete) {
        const checkInterval = this.scene.time.addEvent({
            delay: 100,
            callback: () => {
                // Check if story elements are gone
                if (!this.scene.storyModalElements || this.scene.storyModalElements.length === 0) {
                    checkInterval.remove();
                    // Small delay before next popup
                    this.scene.time.delayedCall(500, onComplete);
                }
            },
            loop: true
        });

        // Safety timeout - if story doesn't dismiss after 60 seconds, continue
        this.scene.time.delayedCall(60000, () => {
            checkInterval.remove();
            onComplete();
        });
    }

    /**
     * Show daily greeting
     */
    showDailyGreeting(dailyBonus, onComplete) {
        devLog('[OnboardingManager] Showing daily greeting');

        const creatureName = window.GameState?.get('creature.name') || 'Your creature';
        const creatureHatched = window.GameState?.get('creature.hatched');

        if (!creatureHatched) {
            devLog('[OnboardingManager] Creature not hatched, skipping daily greeting');
            onComplete();
            return;
        }

        // Mark daily as shown
        const today = new Date().toISOString().split('T')[0];
        window.GameState?.set('session.lastDailyShown', today);

        // Use scene's greeting method with callback
        if (this.scene.showDailyGreetingWithCallback) {
            this.scene.showDailyGreetingWithCallback(creatureName, dailyBonus, onComplete);
        } else if (this.scene.showDailyGreetingOverlay) {
            this.scene.showDailyGreetingOverlay(creatureName, dailyBonus);
            this.waitForGreetingDismiss(onComplete);
        } else {
            devLog('[OnboardingManager] showDailyGreetingOverlay not available');
            onComplete();
        }
    }

    /**
     * Wait for greeting to be dismissed
     */
    waitForGreetingDismiss(onComplete) {
        const checkInterval = this.scene.time.addEvent({
            delay: 100,
            callback: () => {
                // Check if greeting elements are gone
                if (!this.scene.greetingElements || this.scene.greetingElements.length === 0) {
                    checkInterval.remove();
                    // Small delay before next popup
                    this.scene.time.delayedCall(500, onComplete);
                }
            },
            loop: true
        });

        // Safety timeout
        this.scene.time.delayedCall(30000, () => {
            checkInterval.remove();
            onComplete();
        });
    }

    /**
     * Show NASA content
     */
    async showNASAContent(onComplete) {
        devLog('[OnboardingManager] Showing NASA content');

        if (!window.NASAContentSystem) {
            devLog('[OnboardingManager] NASAContentSystem not available');
            onComplete();
            return;
        }

        try {
            const contentQueue = await window.NASAContentSystem.getDailyContentQueue();

            if (contentQueue.length > 0) {
                // Import and create modal
                import('../ui/NASAContentModal.js').then(module => {
                    const NASAContentModal = module.default;
                    const nasaModal = new NASAContentModal(this.scene);
                    nasaModal.show(contentQueue, () => {
                        window.NASAContentSystem?.markDailyContentShown();
                        onComplete();
                    });
                });
            } else {
                devLog('[OnboardingManager] No NASA content available');
                onComplete();
            }
        } catch (error) {
            console.error('[OnboardingManager] NASA content error:', error);
            onComplete();
        }
    }

    /**
     * Skip remaining onboarding (for testing or user preference)
     */
    skipRemaining() {
        devLog('[OnboardingManager] Skipping remaining popups');
        this.popupQueue = [];
        this.currentPopup = null;
        this.isProcessing = false;
    }

    /**
     * Check if onboarding is currently showing
     * @returns {boolean}
     */
    isShowingPopup() {
        return this.currentPopup !== null;
    }

    /**
     * Clean up
     */
    cleanup() {
        this.skipRemaining();
        this.scene = null;
        this.isInitialized = false;
        devLog('[OnboardingManager] Cleaned up');
    }
}

// Create singleton
const onboardingManager = new OnboardingManager();
window.OnboardingManager = onboardingManager;

export default onboardingManager;
