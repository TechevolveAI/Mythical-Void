import Phaser from 'phaser';

// Import Logger first (other systems may use it)
import './utils/Logger.js';

// Static imports for proper bundling in production
import './config/env-loader.js';
import './config/api-config.js';
import './systems/ErrorHandler.js';
import './systems/InputValidator.js';
import './systems/UITheme.js';
import './systems/MemoryManager.js';
import './systems/ResponsiveManager.js';
import './systems/UXEnhancements.js';
import './systems/KidMode.js';
import './systems/HatchCinematics.js';
import './systems/FXLibrary.js';
import './systems/ParallaxBiome.js';
import './systems/RaritySystem.js';
import './systems/RerollSystem.js';
import './systems/CreatureGenetics.js';
import './systems/BreedingEngine.js';
import './systems/GameState.js';
import './systems/EconomyManager.js';
import './systems/AudioManager.js';
import './systems/EnemyManager.js';
import './systems/ProjectileManager.js';
import './systems/InventoryManager.js';
import './systems/CreatureMemory.js';
import './systems/SafetyManager.js';
import './systems/GraphicsEngine.js';
import './systems/CreatureAI.js';
import './systems/CareSystem.js';
import './systems/AchievementSystem.js';
import './systems/TutorialSystem.js';
import './scenes/HatchingScene.js';
import './scenes/PersonalityScene.js';
import './scenes/NamingScene.js';
import './scenes/GameScene.js';
import './scenes/ShopScene.js';
import './scenes/InventoryScene.js';

if (typeof window !== 'undefined' && !window.Phaser) {
    window.Phaser = Phaser;
}

// Modules are now loaded synchronously via static imports
const preloadModulesReady = Promise.resolve();

export { Phaser, preloadModulesReady };
