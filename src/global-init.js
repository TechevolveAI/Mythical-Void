/**
 * Global Module Initialization
 *
 * Code Splitting Strategy:
 * - Core systems are statically imported (always needed)
 * - Scenes are statically imported for reliability but chunked by Vite
 * - SceneLoader enables lazy loading for future scenes
 *
 * Chunk Categories (defined in vite.config.js):
 * - vendor-phaser: Phaser.js (~1.5MB, cached separately)
 * - core: Essential systems (GameState, GraphicsEngine, etc.)
 * - creature: Creature-related systems
 * - onboarding: First-time user flow scenes
 * - gameplay: Main game scene
 * - levels: Platformer levels
 * - menus: Shop, Inventory, etc.
 * - advanced: Breeding, Fusion, etc.
 */

import Phaser from 'phaser';

// ============================================
// CORE UTILITIES (Always loaded first)
// ============================================
import './utils/Logger.js';
import './utils/DevTools.js';
import './utils/SceneLoader.js';
import './utils/ChunkPreloader.js';
import './utils/WebGLContextGuard.js';

// ============================================
// CONFIGURATION
// ============================================
import './config/env-loader.js';
import './config/api-config.js';

// ============================================
// CORE SYSTEMS (Always needed)
// ============================================
import './systems/ErrorHandler.js';
import './systems/InputValidator.js';
import './systems/UITheme.js';
import './systems/MemoryManager.js';
import './systems/MobileViewportController.js';
import './systems/ResponsiveManager.js';
import './systems/UXEnhancements.js';
import './systems/FusionConsent.js';
import './systems/FusionAuthority.js';
import './systems/SharedFusionInvitationService.js';
import './systems/KidMode.js';
import './systems/AudioManager.js';
import './systems/FXLibrary.js';

// ============================================
// CREATURE SYSTEMS
// ============================================
import './systems/HatchCinematics.js';
import './systems/ParallaxBiome.js';
import './systems/RaritySystem.js';
import './systems/RerollSystem.js';
import './systems/CreatureGenetics.js';
import './systems/CreaturePortraitSpec.js';
import './systems/CreatureDNA.js';
import './systems/PersonalitySystem.js';
import './systems/CreatureAIController.js';
import './systems/BreedingEngine.js';
import './systems/StageVisualResolver.js';
import './systems/CreatureAnimationController.js';
import './systems/ThoughtBubbleSystem.js';
import './systems/CreatureAgency.js';
import './systems/SenseiMemory.js';
import './systems/ShipEvidence.js';
import './systems/ProtectedReturnProtocol.js';
import './systems/CurrentVeilMission.js';
import './systems/CompanionIdentityArchive.js';

// ============================================
// GAME STATE & MANAGERS
// ============================================
import './systems/GameState.js';
import './systems/EconomyManager.js';
import './systems/EnemyManager.js';
import './systems/ProjectileManager.js';
import './systems/InventoryManager.js';
import './systems/CreatureMemory.js';
import './systems/LongTermMemory.js';
import './systems/AgentToolRegistry.js';
import './systems/GraphicsEngine.js';
import './systems/CreatureAI.js';
import './systems/CareSystem.js';
import './systems/AchievementSystem.js';
import './systems/TutorialSystem.js';
import './systems/MobileControls.js';
import './systems/ChatManager.js';
import './systems/QuestManager.js';
import './systems/CollectibleManager.js';
import './systems/ui/ToastNotificationSystem.js';

// ============================================
// ADVANCED SYSTEMS
// ============================================
import './systems/CampfireRestSystem.js';
import './systems/NatureAttunementSystem.js';
import './systems/CreatureLifecycle.js';
import './systems/CreatureSkills.js';
import './systems/EvolutionCelebration.js';
import './systems/CreatureAgent.js';
import './systems/FeedbackManager.js';
import './systems/BirthEventSystem.js';
import './systems/SecretAbilityManager.js';
import './systems/BossFightManager.js';
import './systems/SoulPhraseGenerator.js';
import './systems/SpaceWeatherSystem.js';
import './systems/NASAContentSystem.js';
import './systems/OnboardingManager.js';
import './systems/CombatJuice.js';
import './systems/CloudSaveManager.js';
import './systems/LivingPortraitService.js';
import './systems/CompanionMediaService.js';
import './systems/FendCommunity.js';
import './systems/FendResidents.js';
import './systems/GuardianResidents.js';
import './systems/RescuedResidents.js';
import './systems/GuardianOutcomes.js';
import './systems/SanctuaryCommunity.js';
import './systems/FendCulture.js';
import './systems/CompanionConsent.js';
import './systems/RemainAndDefendCampaign.js';

// ============================================
// SCENES - Onboarding Flow (Critical Path)
// ============================================
import './scenes/HatchingScene.js';
import './scenes/PersonalityScene.js';
import './scenes/NamingScene.js';
import './scenes/SoulRevealScene.js';

// ============================================
// SCENES - Main Gameplay
// ============================================
import './scenes/GameScene.js';

// ============================================
// SCENES - Menus & UI (registered on demand by SceneLoader)
// ============================================

// ============================================
// SCENES - Hub & Levels
// ============================================
import './scenes/HubWorldScene.js';
// Platformer scenes loaded via main.js

// ============================================
// SCENES - Advanced Features
// ============================================
import './scenes/FusionPodScene.js';
import './scenes/BreedingHatchScene.js';
import './scenes/WelcomeBackScene.js';
import './scenes/VoidMiniGameScene.js';
import './scenes/CreatureGatheringScene.js';
import './scenes/AbilitySelectionScene.js';

// ============================================
// GLOBAL EXPORTS
// ============================================
if (typeof window !== 'undefined' && !window.Phaser) {
    window.Phaser = Phaser;
}

// Mark all statically imported scenes as loaded in SceneLoader
if (typeof window !== 'undefined' && window.SceneLoader) {
    const staticScenes = [
        'HatchingScene', 'PersonalityScene', 'NamingScene', 'SoulRevealScene',
        'GameScene', 'HubWorldScene', 'FusionPodScene',
        'BreedingHatchScene', 'WelcomeBackScene', 'VoidMiniGameScene',
        'CreatureGatheringScene', 'AbilitySelectionScene'
    ];
    staticScenes.forEach(scene => window.SceneLoader.loadedScenes.add(scene));
}

// Modules are now loaded synchronously via static imports
// Vite handles code splitting via manualChunks in vite.config.js
const preloadModulesReady = Promise.resolve();

export { Phaser, preloadModulesReady };
