/**
 * TutorialSystem - Simple progressive onboarding system
 * Provides basic hints for movement and interaction
 */

function getGameState() {
    if (typeof window === 'undefined' || !window.GameState) {
        throw new Error('GameState system not ready');
    }
    return window.GameState;
}

class TutorialSystem {
    constructor() {
        this.initialized = false;
        this.currentTutorial = null;
        this.completedTutorials = [];
        this.tutorialSteps = {
            movement: {
                id: 'movement',
                title: 'Movement',
                message: 'Use WASD or Arrow Keys to move your creature around the world',
                condition: (gameState, scene) => {
                    // Check if player has moved significantly from start
                    const pos = gameState.world.currentPosition;
                    return pos && (Math.abs(pos.x - 800) > 100 || Math.abs(pos.y - 600) > 100);
                },
                completed: false
            },
            interaction: {
                id: 'interaction',
                title: 'Interaction',
                message: 'Press SPACE when near flowers to interact and gain XP',
                condition: (gameState, scene) => {
                    // Check if player has interacted with flowers
                    return (gameState.world.discoveredObjects.flowers || 0) >= 1;
                },
                completed: false
            },
            care: {
                id: 'care',
                title: 'Creature Care',
                message: 'Press TAB to open care menu, then F/P/R to feed, play, or rest with your creature',
                condition: (gameState, scene) => {
                    // Check if player has performed any care action
                    const care = gameState.creature.care;
                    return care && (care.dailyCare.feedCount > 0 || care.dailyCare.playCount > 0 || care.dailyCare.restCount > 0);
                },
                completed: false
            },
            levelUp: {
                id: 'levelUp',
                title: 'Level Up',
                message: 'Keep exploring and interacting to gain XP and level up your creature!',
                condition: (gameState, scene) => {
                    // Check if creature has reached level 2
                    return (gameState.creature.level || 1) >= 2;
                },
                completed: false
            }
        };
    }

    /**
     * Initialize the tutorial system
     */
    initialize() {
        if (this.initialized) return;

        // Load tutorial progress from GameState
        const savedTutorials = getGameState().get('tutorials') || {};
        Object.keys(this.tutorialSteps).forEach(stepId => {
            if (savedTutorials[stepId]) {
                this.tutorialSteps[stepId].completed = savedTutorials[stepId].completed || false;
            }
        });

        this.initialized = true;
        console.log('[TutorialSystem] Initialized with', Object.keys(this.tutorialSteps).length, 'tutorial steps');
    }

    /**
     * Get the next tutorial step that should be shown
     */
    getNextTutorial(gameState, scene) {
        for (const [stepId, step] of Object.entries(this.tutorialSteps)) {
            if (!step.completed && !this.isCompleted(step, gameState, scene)) {
                return step;
            }
        }
        return null;
    }

    /**
     * Check if a tutorial step is completed
     */
    isCompleted(step, gameState, scene) {
        return step.condition(gameState, scene);
    }

    /**
     * Mark a tutorial step as completed
     */
    completeTutorial(stepId) {
        if (this.tutorialSteps[stepId]) {
            this.tutorialSteps[stepId].completed = true;
            this.completedTutorials.push(stepId);

            // Save to GameState
            getGameState().set(`tutorials.${stepId}`, {
                completed: true,
                completedAt: Date.now()
            });

            console.log(`[TutorialSystem] Completed tutorial: ${stepId}`);
        }
    }

    /**
     * Check all tutorial steps and complete any that meet conditions
     */
    checkTutorials(gameState, scene) {
        let completedSteps = [];

        Object.entries(this.tutorialSteps).forEach(([stepId, step]) => {
            if (!step.completed && this.isCompleted(step, gameState, scene)) {
                this.completeTutorial(stepId);
                completedSteps.push(step);
            }
        });

        return completedSteps;
    }

    /**
     * Get tutorial completion percentage
     */
    getCompletionPercentage() {
        const total = Object.keys(this.tutorialSteps).length;
        const completed = this.completedTutorials.length;
        return Math.round((completed / total) * 100);
    }

    /**
     * Get tutorial progress text
     */
    getProgressText() {
        const completed = this.completedTutorials.length;
        const total = Object.keys(this.tutorialSteps).length;
        return `Tutorial: ${completed}/${total} (${this.getCompletionPercentage()}%)`;
    }

    /**
     * Reset all tutorials (for testing)
     */
    resetTutorials() {
        Object.values(this.tutorialSteps).forEach(step => {
            step.completed = false;
        });
        this.completedTutorials = [];
        getGameState().set('tutorials', {});
        console.log('[TutorialSystem] All tutorials reset');
    }
}

// Export for use in other modules
window.TutorialSystem = new TutorialSystem();
