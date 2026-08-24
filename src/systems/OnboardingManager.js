/**
 * OnboardingManager - Coordinates all first-time and daily popups
 *
 * Ensures only one popup shows at a time and they appear in proper sequence:
 * 1. Crash Story (first time only)
 * 2. Field Controls (first time only)
 * 3. Daily Greeting/Bonus (once per day)
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
        this.flowContext = null;

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
        this.flowContext = null;
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
        const firstSanctuaryVisit = this.isNewPlayer() ||
            !window.GameState?.get('tutorial.crashStorySeen');
        this.flowContext = {
            firstSanctuaryVisit,
            queuedPopupIds: []
        };

        // 1. Establish the mission before teaching controls.
        if (!window.GameState?.get('tutorial.crashStorySeen')) {
            this.popupQueue.push({
                id: 'crash_story',
                type: 'crash_story',
                priority: 1
            });
        }

        // 2. Hand agency back with only the controls needed in the sanctuary.
        if (this.isNewPlayer()) {
            this.popupQueue.push({
                id: 'controls',
                type: 'controls_tutorial',
                priority: 2
            });
        }

        // Returning-session content should not delay the player's first moment of agency.
        if (!firstSanctuaryVisit && this.shouldShowDailyContent()) {
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

        // Daily astronomy content remains available from the menu. It must not
        // interrupt or trap a returning player before they regain movement.

        this.flowContext.queuedPopupIds = this.popupQueue.map(popup => popup.id);
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
            this.onQueueComplete?.(this.flowContext);
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
                default:
                    devLog(`[OnboardingManager] Unknown popup type: ${popup.type}`);
                    resolve();
            }
        });
    }

    /**
     * Show controls tutorial
     */
    async showControlsTutorial(onComplete) {
        devLog('[OnboardingManager] Showing controls tutorial');

        try {
            if (!this.scene.controlsTutorial) {
                const module = await import('../ui/ControlsTutorialOverlay.js');
                const ControlsTutorialOverlay = module.default;
                this.scene.controlsTutorial = new ControlsTutorialOverlay(this.scene);
            }
            this.scene.controlsTutorial.show();
            this.waitForTutorialDismiss(onComplete);
        } catch (error) {
            console.error('[OnboardingManager] Controls tutorial failed:', error);
            onComplete();
        }
    }

    waitForDismissal({ isDismissed, onComplete, safetyDelay }) {
        let settled = false;
        let checkInterval = null;
        let completionTimer = null;
        let safetyTimer = null;

        const complete = (delay = 0) => {
            if (settled) return;
            settled = true;
            checkInterval?.remove?.();
            safetyTimer?.remove?.();

            if (delay > 0) {
                completionTimer = this.scene.time.delayedCall(delay, () => {
                    completionTimer = null;
                    onComplete();
                });
                return;
            }
            onComplete();
        };

        checkInterval = this.scene.time.addEvent({
            delay: 100,
            callback: () => {
                if (isDismissed()) complete(500);
            },
            loop: true
        });
        safetyTimer = this.scene.time.delayedCall(
            safetyDelay,
            () => complete()
        );

        return () => {
            if (settled) return;
            settled = true;
            checkInterval?.remove?.();
            safetyTimer?.remove?.();
            completionTimer?.remove?.();
        };
    }

    /**
     * Wait for controls tutorial to be dismissed
     */
    waitForTutorialDismiss(onComplete) {
        return this.waitForDismissal({
            isDismissed: () => !this.scene.controlsTutorial?.isVisible,
            onComplete,
            safetyDelay: 30000
        });
    }

    /**
     * Show crash story
     */
    showCrashStory(onComplete) {
        devLog('[OnboardingManager] Showing crash story');

        const completeCrashStory = () => {
            window.GameState?.set('tutorial.crashStorySeen', true);
            window.GameState?.save?.();
            onComplete();
        };

        // Use scene's showShipMemories method with callback
        if (this.scene.showShipMemoriesWithCallback) {
            this.scene.showShipMemoriesWithCallback(completeCrashStory);
        } else if (this.scene.showShipMemories) {
            this.scene.showShipMemories();
            this.waitForStoryDismiss(completeCrashStory);
        } else {
            devLog('[OnboardingManager] showShipMemories not available');
            onComplete();
        }
    }

    /**
     * Wait for story modal to be dismissed
     */
    waitForStoryDismiss(onComplete) {
        return this.waitForDismissal({
            isDismissed: () => !this.scene.storyModalElements ||
                this.scene.storyModalElements.length === 0,
            onComplete,
            safetyDelay: 60000
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
        return this.waitForDismissal({
            isDismissed: () => !this.scene.greetingElements ||
                this.scene.greetingElements.length === 0,
            onComplete,
            safetyDelay: 30000
        });
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
        this.flowContext = null;
        this.onQueueComplete = null;
        devLog('[OnboardingManager] Cleaned up');
    }
}

// Create singleton
const onboardingManager = new OnboardingManager();
window.OnboardingManager = onboardingManager;

export default onboardingManager;
