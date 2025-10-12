import Phaser from 'phaser';

if (typeof window !== 'undefined' && !window.Phaser) {
    window.Phaser = Phaser;
}

const modulesToLoad = [
    './config/env-loader.js',
    './config/api-config.js',
    './systems/ErrorHandler.js',
    './systems/InputValidator.js',
    './systems/UITheme.js',
    './systems/MemoryManager.js',
    './systems/ResponsiveManager.js',
    './systems/UXEnhancements.js',
    './systems/KidMode.js',
    './systems/HatchCinematics.js',
    './systems/FXLibrary.js',
    './systems/ParallaxBiome.js',
    './systems/RaritySystem.js',      // NEW: Rarity with pity
    './systems/RerollSystem.js',      // NEW: Reroll mechanics
    './systems/CreatureGenetics.js',
    './systems/GeneticsEngine.js',
    './systems/GameState.js',
    './systems/GraphicsEngine.js',
    './systems/CreatureAI.js',
    './systems/CareSystem.js',
    './systems/AchievementSystem.js',
    './systems/TutorialSystem.js',
    './scenes/HatchingScene.js',
    './scenes/PersonalityScene.js',
    './scenes/NamingScene.js',
    './scenes/GameScene.js'
];

for (const modulePath of modulesToLoad) {
    await import(modulePath);
}

export { Phaser };
