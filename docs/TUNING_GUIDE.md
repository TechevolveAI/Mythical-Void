# 🎛️ Kid Mode & Hatch Cinematics - Tuning Guide

## 🎯 Overview
This guide explains how to adjust the Kid Mode UI and Hatch Cinematics systems using the configuration files.

---

## 👶 Kid Mode Configuration (`src/config/kid-mode.json`)

### **Core Scaling Factors**
```json
{
  "fontScale": 1.2,        // Font size multiplier (1.0 = normal, 1.5 = 50% larger)
  "paddingScale": 1.3,     // Spacing multiplier (1.0 = normal, 2.0 = double spacing) 
  "hitboxMin": 64,         // Minimum button size in pixels (recommended: 44-80px)
  "emojiFallbacks": true   // Show emojis alongside text (true/false)
}
```

**Tuning Tips:**
- **fontScale**: 1.1-1.3 for subtle changes, 1.4+ for significant accessibility needs
- **hitboxMin**: iOS recommends 44px minimum, Android 48px, Kid Mode 64px+
- **paddingScale**: Increase if buttons feel cramped, decrease for compact layouts

### **Visual Appearance**
```json
{
  "colors": {
    "primary": "#FFD700",      // Gold - primary action buttons
    "secondary": "#87CEEB",    // Sky blue - secondary actions  
    "success": "#32CD32",      // Green - positive feedback
    "warning": "#FFB347",      // Orange - attention needed
    "error": "#FF6B6B"         // Red - problems/errors
  }
}
```

**Color Guidelines:**
- Use high contrast colors (4.5:1 ratio minimum)
- Test with colorblind simulators
- Primary should be warm/inviting (gold, orange, green)
- Avoid pure red/green combinations

### **Accessibility Settings**
```json
{
  "accessibility": {
    "highContrast": false,     // Enable high contrast mode
    "textToSpeech": true,      // Support screen readers
    "hapticFeedback": true,    // Vibration on supported devices
    "minimumContrast": 4.5     // WCAG AA compliance
  }
}
```

### **Audio Settings**
```json
{
  "audio": {
    "buttonPressVolume": 0.3,  // Volume for button clicks (0.0-1.0)
    "successVolume": 0.5,      // Volume for success sounds
    "enableAudio": true        // Master audio toggle
  }
}
```

**Audio Tuning:**
- Keep volumes low (0.1-0.5) to avoid startling users
- Test on different devices (phones tend to be louder)
- Provide easy mute option for classroom use

### **Responsive Behavior**
```json
{
  "responsive": {
    "mobileBreakpoint": 768,   // Switch to mobile layout below this width
    "ctaPosition": "bottom",   // "bottom", "top", or "floating"
    "statusBarPosition": "top" // "top", "bottom", or "overlay"
  }
}
```

---

## 🎬 Hatch Cinematics Configuration (`src/config/hatch-cinematics.json`)

### **Timing Control (The 8-Beat Structure)**
```json
{
  "timings": {
    "crack": 0.5,        // Beat 1: Initial crack appearance (0.0-0.5s)
    "glowPulse": 2.0,    // Beat 2: Magical glow pulses (0.5-2.5s)
    "particleLeak": 1.0, // Beat 3: Sparkles leak out (2.5-3.5s)
    "shellPop": 0.2,     // Beat 4: Shell breaks open (3.5-3.7s)
    "creatureBlink": 0.8,// Beat 5: Creature appears (3.7-4.5s)
    "traitCards": 1.2,   // Beat 6: Trait cards fan out (4.5-5.7s)  
    "nameInput": 0.6,    // Beat 7: Name input descends (5.7-6.3s)
    "firstEmote": 0.4    // Beat 8: Happy emote (6.3-6.7s)
  }
}
```

**Timing Guidelines:**
- **Total duration**: Should be 8-10 seconds (current: ~6.7s)
- **Fast builds**: Reduce all timings by 20% (multiply by 0.8)
- **Dramatic builds**: Increase key moments (traitCards, nameInput) by 50%
- **Minimum values**: Keep shellPop ≤ 0.3s for impact, crack ≥ 0.3s for visibility

### **Visual Effects**
```json
{
  "effects": {
    "crackLineWidth": 2,     // Thickness of crack lines (1-4 recommended)
    "glowRadius": 60,        // Glow effect size in pixels
    "particleCount": 15,     // Number of sparkle particles (10-25)
    "shakeAmplitude": 3,     // Screen shake intensity (1-5px)
    "shakeDuration": 120,    // Screen shake length in ms (80-200)
    "cardFanAngle": 45,      // Trait cards spread angle (30-60 degrees)
    "cardSpacing": 80        // Distance between cards (60-120px)
  }
}
```

**Effect Tuning:**
- **Low-end devices**: Reduce particleCount to 8-10, smaller glow radius
- **Dramatic effect**: Increase particleCount to 20+, larger glow radius  
- **Subtle experience**: Reduce shakeAmplitude to 1-2px
- **Accessibility**: Set shakeAmplitude to 0 for motion sensitivity

### **Audio Integration**
```json
{
  "sfx": {
    "crack": "hatch_crack",     // Low rumble bass sound
    "glow": "hatch_glow",       // Magical shimmer
    "pop": "hatch_pop",         // Sharp shell break
    "blink": "creature_blink",  // Gentle creature chirp
    "cards": "trait_cards",     // Whoosh for cards
    "whoosh": "name_whoosh",    // Cozy descent sound
    "emote": "happy_emote",     // Joyful creature sound
    "volumes": {
      "crack": 0.4,             // Individual volume controls
      "pop": 0.7,               // Pop should be prominent
      "emote": 0.8              // Happy ending should be clear
    }
  }
}
```

### **Performance Optimization**
```json
{
  "performance": {
    "enableParticles": true,    // Disable particles on low-end devices
    "enableScreenshake": true,  // Disable shake for accessibility
    "enableSounds": true,       // Master audio toggle
    "maxParticles": 20,         // Hard limit on particle count
    "particleLifetime": 2000    // How long particles exist (ms)
  }
}
```

### **Debug & Development**
```json
{
  "debug": {
    "showTimings": false,      // Display timing info on screen
    "logTelemetry": true,      // Console logging for timing analysis
    "skipBeats": [],           // Skip specific beats for testing: ["crack", "glow"]
    "speedMultiplier": 1.0     // Speed up/slow down entire sequence
  }
}
```

**Debug Features:**
- **showTimings**: Useful for fine-tuning beat transitions
- **skipBeats**: Test individual effects in isolation
- **speedMultiplier**: 0.5 for slow motion analysis, 2.0 for quick testing
- **logTelemetry**: Provides precise timing data in console

---

## 🎨 Common Tuning Scenarios

### **Scenario 1: Classroom/Quiet Environment**
```json
{
  "kid-mode": {
    "audio": { "enableAudio": false },
    "accessibility": { "hapticFeedback": false }
  },
  "hatch-cinematics": {
    "performance": { "enableSounds": false },
    "effects": { "shakeAmplitude": 0 }
  }
}
```

### **Scenario 2: High-Energy Dramatic Experience**
```json
{
  "kid-mode": {
    "audio": { "successVolume": 0.8 },
    "colors": { "primary": "#FF6B47" }
  },
  "hatch-cinematics": {
    "effects": {
      "particleCount": 25,
      "glowRadius": 80,
      "shakeAmplitude": 5
    },
    "timings": {
      "traitCards": 1.8,
      "nameInput": 1.0
    }
  }
}
```

### **Scenario 3: Accessibility-First (Motion Sensitivity)**
```json
{
  "kid-mode": {
    "accessibility": {
      "highContrast": true,
      "minimumContrast": 7.0
    }
  },
  "hatch-cinematics": {
    "effects": {
      "shakeAmplitude": 0,
      "particleCount": 5,
      "glowRadius": 40
    },
    "performance": {
      "enableScreenshake": false
    }
  }
}
```

### **Scenario 4: Mobile Performance Optimization**
```json
{
  "hatch-cinematics": {
    "effects": {
      "particleCount": 8,
      "glowRadius": 45
    },
    "performance": {
      "maxParticles": 12,
      "particleLifetime": 1500
    },
    "timings": {
      "glowPulse": 1.5,
      "traitCards": 0.8
    }
  }
}
```

---

## 🔧 Testing Your Changes

### **Quick Test Commands**
```bash
# Validate all systems still work
npm run validate-flow

# Test Kid Mode specifically
# Add ?kid=1 to URL to enable Kid Mode immediately

# Check console for timing logs
# Look for "cinematic:debug" and "ui:debug" messages
```

### **Manual Testing Checklist**

**Kid Mode Tests:**
- [ ] Buttons are minimum 64px and clickable
- [ ] Text is readable at increased size
- [ ] Color contrast meets accessibility standards
- [ ] Audio feedback plays (if enabled)
- [ ] Emotion-to-action mapping works correctly

**Hatch Cinematics Tests:**
- [ ] All 8 beats play in sequence
- [ ] Total duration feels appropriate (8-10s ideal)
- [ ] Visual effects don't overlap incorrectly
- [ ] Audio timing syncs with visual beats
- [ ] Performance acceptable on target devices

### **Performance Monitoring**
```javascript
// Add to console to monitor performance
setInterval(() => {
    console.log('FPS:', game.loop.actualFps.toFixed(1));
    console.log('Memory:', (performance.memory?.usedJSHeapSize / 1048576).toFixed(1) + 'MB');
}, 5000);
```

---

## 📊 Telemetry Data

### **Available Metrics**
- `hatch/phase_start` - Each beat beginning with timing
- `hatch/phase_end` - Each beat completion
- `hatch/sequence_complete` - Full cinematic finished
- `ui/kidmode_toggled` - Kid Mode enable/disable
- `ui/emotion_changed` - Creature emotion state changes

### **Analyzing Timing Data**
```javascript
// Listen for cinematic telemetry
GameState.on('telemetry/hatch_cinematic', (data) => {
    console.log(`Beat ${data.phase}: ${data.offset.toFixed(2)}s`);
});
```

---

## ⚠️ Important Notes

### **Don't Break the Game Flow**
- Never modify the core timing structure that could affect the critical save-before-restart fix
- The 100ms delay in HatchingScene is essential and protected by validation
- Test thoroughly after any timing changes

### **Browser Compatibility**
- Audio may not play without user interaction on some browsers
- Particle effects may be limited on older devices
- Test on actual mobile devices, not just browser dev tools

### **File Locations**
- Kid Mode config: `src/config/kid-mode.json`
- Cinematics config: `src/config/hatch-cinematics.json`
- Validation: `npm run validate-flow`
- Tests: `src/__tests__/`

---

**🎯 Happy Tuning!** Remember to validate changes with `npm run validate-flow` and test the complete user journey after modifications.