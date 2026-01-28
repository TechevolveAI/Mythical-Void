import { defineConfig } from 'vite';

/**
 * Mythical Void - Vite Build Configuration
 *
 * Code Splitting Strategy:
 * - vendor: Phaser.js (largest dependency, ~1.5MB, rarely changes)
 * - core: Essential systems needed for all gameplay
 * - onboarding: First-time user flow scenes
 * - gameplay: Main game scene and related systems
 * - levels: Platformer levels (loaded on demand)
 * - menus: Shop, Inventory, Achievements (loaded on demand)
 * - advanced: Breeding, Fusion, Mini-games (loaded on demand)
 */

export default defineConfig({
  server: {
    port: 8080,
    open: true
  },
  preview: {
    port: 8080,
    open: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Use esbuild for minification (Vite's default)
    // Terser's aggressive optimization was causing issues with Phaser's Color class
    minify: 'esbuild',
    // Target modern browsers for better tree-shaking
    target: 'es2020',
    // Increase chunk size warning limit (Phaser is large)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: (id) => {
          // Vendor chunk: Phaser.js (largest, rarely changes - good for caching)
          if (id.includes('node_modules/phaser')) {
            return 'vendor-phaser';
          }

          // Other vendor dependencies
          if (id.includes('node_modules')) {
            return 'vendor';
          }

          // Core systems - always needed
          if (id.includes('/systems/') && (
            id.includes('ErrorHandler') ||
            id.includes('MemoryManager') ||
            id.includes('GameState') ||
            id.includes('GraphicsEngine') ||
            id.includes('InputValidator') ||
            id.includes('UITheme') ||
            id.includes('ResponsiveManager') ||
            id.includes('UXEnhancements') ||
            id.includes('KidMode') ||
            id.includes('AudioManager') ||
            id.includes('FXLibrary')
          )) {
            return 'core';
          }

          // Creature systems - needed for all creature interactions
          if (id.includes('/systems/') && (
            id.includes('CreatureGenetics') ||
            id.includes('CreatureDNA') ||
            id.includes('CreatureAI') ||
            id.includes('PersonalitySystem') ||
            id.includes('RaritySystem') ||
            id.includes('RerollSystem') ||
            id.includes('StageVisualResolver') ||
            id.includes('CreatureAnimationController') ||
            id.includes('ThoughtBubbleSystem')
          )) {
            return 'creature';
          }

          // Onboarding scenes - first user experience
          if (id.includes('/scenes/') && (
            id.includes('HatchingScene') ||
            id.includes('PersonalityScene') ||
            id.includes('NamingScene') ||
            id.includes('SoulRevealScene')
          )) {
            return 'onboarding';
          }

          // Main gameplay scene
          if (id.includes('/scenes/GameScene')) {
            return 'gameplay';
          }

          // Platformer levels - loaded when entering hub/levels
          if (id.includes('/scenes/levels/') ||
              id.includes('PlatformerLevelScene') ||
              id.includes('HubWorldScene')) {
            return 'levels';
          }

          // Menu scenes - loaded on demand
          if (id.includes('/scenes/') && (
            id.includes('ShopScene') ||
            id.includes('InventoryScene') ||
            id.includes('AchievementMenuScene') ||
            id.includes('CreatureProfileScene')
          )) {
            return 'menus';
          }

          // Advanced features - loaded on demand
          if (id.includes('/scenes/') && (
            id.includes('FusionPodScene') ||
            id.includes('BreedingHatchScene') ||
            id.includes('VoidMiniGameScene') ||
            id.includes('CreatureGatheringScene') ||
            id.includes('WelcomeBackScene') ||
            id.includes('AbilitySelectionScene')
          )) {
            return 'advanced';
          }

          // Manager systems - loaded with gameplay
          if (id.includes('/systems/') && (
            id.includes('EconomyManager') ||
            id.includes('InventoryManager') ||
            id.includes('EnemyManager') ||
            id.includes('ProjectileManager') ||
            id.includes('QuestManager') ||
            id.includes('CollectibleManager') ||
            id.includes('CareSystem') ||
            id.includes('AchievementSystem')
          )) {
            return 'managers';
          }

          // Config files
          if (id.includes('/config/')) {
            return 'config';
          }

          // UI components
          if (id.includes('/ui/')) {
            return 'ui-components';
          }

          // Utils
          if (id.includes('/utils/')) {
            return 'utils';
          }
        }
      }
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['phaser'],
    // Don't pre-bundle large dependencies that we're chunking
    exclude: []
  }
});
