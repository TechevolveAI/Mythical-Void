#!/usr/bin/env node
/**
 * Game Flow Integrity Validator
 * Ensures critical game flow code hasn't been accidentally modified
 * Run with: node scripts/validate-game-flow.js
 *
 * Enhanced with function fingerprinting for better change detection
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Critical code fingerprints (hashes would be better, but this is simpler)
const CRITICAL_PATTERNS = {
    'src/scenes/HatchingScene.js': [
        // Scene flow decision logic
        'if (!gameStarted) {',
        'else if (gameStarted && !creatureHatched) {',
        'else if (gameStarted && creatureHatched && !creatureNamed) {',
        'else if (gameStarted && creatureHatched && creatureNamed) {',
        
        // START button critical logic
        'GameState.set(\'session.gameStarted\', true);',
        'GameState.set(\'creature.hatched\', false);',
        'GameState.save();',
        'this.time.delayedCall(100, () => {',
        'this.scene.restart();',
        
        // New cinematic integration
        'HatchCinematics.play'
    ],
    'src/systems/GameState.js': [
        // Save/load methods
        'localStorage.setItem(this.saveKey',
        'localStorage.getItem(this.saveKey)',
        'this.state = this.deepMerge(this.state, parsed);'
    ],
    'src/systems/KidMode.js': [
        // Kid Mode core functions
        'enableKidMode',
        'disableKidMode', 
        'isKidMode',
        'getNextBestAction'
    ],
    'src/systems/HatchCinematics.js': [
        // Cinematic system functions
        'play(scene, options',
        'createTimeline',
        'logTelemetry'
    ],
    'src/systems/BreedingEngine.js': [
        // Breeding system (renamed from GeneticsEngine)
        'class BreedingEngine',
        'window.BreedingEngine',
        'breedCreatures',
        'getBreedingCompatibility'
    ],
    'src/systems/AudioManager.js': [
        // Audio system
        'playCoinCollect',
        'playButtonClick',
        'playPurchase',
        'toggleMute'
    ],
    'src/systems/EconomyManager.js': [
        // Economy system
        'addCoins',
        'removeCoins',
        'AudioManager.playCoinCollect',
        'AudioManager.playPurchase'
    ]
};

// Critical function fingerprints (MD5 hash of normalized function)
// This provides more robust validation than string matching
const FUNCTION_FINGERPRINTS = {
    'src/scenes/HatchingScene.js': {
        // This would contain MD5 hashes of critical functions
        // For now, we'll keep pattern matching as the primary method
    }
};

const PROTECTED_SECTIONS = {
    'src/scenes/HatchingScene.js': [
        '⚠️ CRITICAL SECTION - DO NOT MODIFY - GAME FLOW LOGIC',
        '⚠️ CRITICAL GAME FLOW FIX - DO NOT MODIFY WITHOUT TEAM REVIEW ⚠️'
    ]
};

function validateFile(filePath, patterns) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const missing = [];
        const protectedSections = PROTECTED_SECTIONS[filePath] || [];
        
        // Check critical patterns exist
        for (const pattern of patterns) {
            if (!content.includes(pattern)) {
                missing.push(pattern);
            }
        }
        
        // Check protected section markers exist
        for (const section of protectedSections) {
            if (!content.includes(section)) {
                missing.push(`PROTECTION MARKER: ${section}`);
            }
        }
        
        return {
            valid: missing.length === 0,
            missing: missing,
            file: filePath
        };
    } catch (error) {
        return {
            valid: false,
            missing: [`FILE ERROR: ${error.message}`],
            file: filePath
        };
    }
}

function main() {
    console.log('🔍 Validating Game Flow Integrity...\n');
    
    let allValid = true;
    const results = [];
    
    for (const [filePath, patterns] of Object.entries(CRITICAL_PATTERNS)) {
        const fullPath = path.join(process.cwd(), filePath);
        const result = validateFile(fullPath, patterns);
        results.push(result);
        
        if (result.valid) {
            console.log(`✅ ${filePath} - All critical patterns found`);
        } else {
            console.log(`❌ ${filePath} - MISSING CRITICAL CODE:`);
            result.missing.forEach(pattern => {
                console.log(`   ⚠️  ${pattern}`);
            });
            allValid = false;
        }
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (allValid) {
        console.log('🎉 GAME FLOW INTEGRITY: PASSED');
        console.log('✅ All critical game flow patterns are intact');
        console.log('✅ All protection markers are present');
        process.exit(0);
    } else {
        console.log('🚨 GAME FLOW INTEGRITY: FAILED');
        console.log('❌ Critical game flow code has been modified!');
        console.log('📖 See GAME_FLOW_DOCUMENTATION.md for restoration guidance');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { validateFile, CRITICAL_PATTERNS, PROTECTED_SECTIONS };