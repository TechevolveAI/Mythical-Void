# 🔊 Audio Assets

This directory contains audio files for the Mythical Creature Game.

## Kid Mode Sounds
- `kid_button_press.mp3` - Gentle "pip" sound for button presses (50ms)
- `success.mp3` - Pleasant success chime (200ms)

## Hatch Cinematic Sounds  
- `hatch_crack.mp3` - Low rumble bass for egg crack (500ms)
- `hatch_glow.mp3` - Magical shimmer for glow pulse (2000ms) 
- `hatch_pop.mp3` - Sharp pop for shell breaking (200ms)
- `creature_blink.mp3` - Gentle chirp for creature appearance (800ms)
- `trait_cards.mp3` - Whoosh for cards fanning out (1200ms)
- `name_whoosh.mp3` - Cozy whoosh for name input (600ms)
- `happy_emote.mp3` - Joyful emote sound (400ms)

## Sound Specifications
- **Format**: MP3 or OGG for web compatibility
- **Quality**: 44.1kHz, 16-bit minimum
- **Volume**: Normalized to prevent clipping
- **Duration**: As specified above for timing sync

## Temporary Fallbacks
Until real audio files are added, the system will:
1. Try to play the sound file
2. Log a debug message if file not found
3. Continue without audio (graceful degradation)

## Adding New Audio
1. Place audio files in this directory
2. Update the configuration files:
   - `src/config/kid-mode.json` (audio settings)
   - `src/config/hatch-cinematics.json` (sfx mapping)
3. Test audio playback in both Kid Mode and normal mode

## Browser Compatibility
- Modern browsers support MP3 and OGG
- Some browsers require user interaction before playing audio
- Volume controls respect user preferences
- Mute functionality available in settings