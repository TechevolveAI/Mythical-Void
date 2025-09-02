# 👶 Kid Mode UI Specification

## 🎯 Overview
Kid Mode transforms the game interface to be more accessible for younger players (ages 4-8) with larger touch targets, simplified interactions, and visual guidance for next actions.

---

## 📱 Layout Wireframes (Mobile-First)

### (a) Home/Hatching Screen Layout
```
┌─────────────────────────────────┐
│        🌟 Mythical Game 🌟     │  ← Title (larger font)
│                                 │
│         🥚 [EGG SPRITE]         │  ← Centered, bigger
│                                 │
│    ┌───────────────────────┐    │
│    │   🚀 START GAME       │    │  ← Min 64x64px hit target
│    │      (Big Button)     │    │
│    └───────────────────────┘    │
│                                 │
│  ┌─────┐  ┌─────────────────┐   │
│  │ 🔄  │  │  Need Help?     │   │  ← Reset + Help buttons
│  │Reset│  │    Tap me! 💡   │   │    (Kid-friendly copy)
│  └─────┘  └─────────────────┘   │
└─────────────────────────────────┘
```

### (b) Care HUD in GameScene
```
┌─────────────────────────────────┐
│  [CREATURE IN CENTER OF WORLD]  │
│                                 │
│ ┌─────────────────────────────┐ │  ← Top status bar
│ │ 🍎━━━━━ 🌙━━━━━ 🎈━━━━━ │ │
│ │ Hungry   Sleepy   Bored  │ │
│ └─────────────────────────────┘ │
│                                 │
│                                 │
│ ┌───────────────────────────────┐│  ← Bottom CTA strip
│ │  ┌─────────┐  ┌─────────────┐││
│ │  │   📸    │  │   🍎 FEED   │││  ← Photo + Main Action
│ │  │  Photo  │  │  (Hungry!)  │││
│ │  └─────────┘  └─────────────┘││
│ └───────────────────────────────┘│
└─────────────────────────────────┘
```

### (c) Mini-CTA Strip ("What should I do next?")
```
┌─────────────────────────────────┐
│         💭 Your creature        │  ← Contextual message
│        looks hungry! 🍎         │
│                                 │
│ ┌─────────────────────────────┐ │
│ │   🍎 FEED YOUR CREATURE     │ │  ← Primary CTA (64x48px min)
│ │         Tap to help!        │ │
│ └─────────────────────────────┘ │
│                                 │
│  Other things you can do:       │
│  🎈 Play  🌙 Rest  🫧 Clean    │  ← Secondary actions (48x48px)
└─────────────────────────────────┘
```

---

## 🎨 Icon System (16 Core Icons)

| Icon | Name | Emoji | Usage | Hit Target |
|------|------|-------|--------|------------|
| 🍎 | Hunger | 🍎 | Feed action, hunger status | 64x64px |
| 🌙 | Energy | 🌙 | Sleep/rest action, energy status | 64x64px |
| 🎈 | Fun | 🎈 | Play action, happiness status | 64x64px |
| 🫧 | Hygiene | 🫧 | Clean action, hygiene status | 64x64px |
| 🍽️ | Feed | 🍎 | Primary feeding button | 64x48px |
| 🎮 | Play | 🎈 | Primary play button | 64x48px |
| 🛌 | Rest | 🌙 | Primary rest button | 64x48px |
| 🤗 | Pet | 🤗 | Primary pet button | 64x48px |
| 📸 | Photo | 📸 | Capture moment, share | 48x48px |
| ⚙️ | Settings | ⚙️ | Game options | 48x48px |
| 🔊 | Sound | 🔊 | Audio toggle | 48x48px |
| ❓ | Help | ❓ | Tutorial/guidance | 48x48px |
| ← | Back | ← | Navigation back | 48x48px |
| ✓ | Confirm | ✓ | Confirm action | 48x48px |
| ✕ | Cancel | ✕ | Cancel action | 48x48px |
| → | Next | → | Continue/next step | 48x48px |

---

## 🎯 Interaction Rules

### Touch Targets
- **Minimum hit area**: 64x64px for primary actions
- **Secondary actions**: 48x48px minimum
- **Padding**: 8px minimum between interactive elements
- **Visual feedback**: All buttons scale 0.95→1.0 over 100ms on tap

### Button Animations
```javascript
// Standard kid-mode button press
buttonTween = this.tweens.add({
    targets: button,
    scale: { from: 1.0, to: 0.95 },
    duration: 50,
    yoyo: true,
    ease: 'Back.easeOut'
});
```

### Audio/Haptic Feedback
- Every button press: "pip" sound (50ms, pleasant tone)
- Successful actions: "success" chime (200ms)
- Haptic feedback on supported devices (light tap)

---

## ♿ Accessibility Features

### High Contrast Mode
- **Toggle**: Available in settings menu
- **Color Palette**: 
  - Background: #000000 (black) or #FFFFFF (white)
  - Primary buttons: #FFD700 (gold) with #000000 text
  - Status bars: #00FF00 (green), #FF6B6B (red), #4ECDC4 (blue)
  - Text: Minimum 4.5:1 contrast ratio

### Colorblind Support
- **Primary palette**: Uses distinct lightness values
- **Status indicators**: Icons + text labels (not color-only)
- **Red/green alternatives**: Blue/yellow for critical states

### Text-to-Speech Friendly
- **Button labels**: Simple, descriptive text
  - "Feed your creature" (not just "Feed")
  - "Take a photo" (not just "📸")
- **Status descriptions**: "Creature is hungry" (not just red bar)
- **Action confirmations**: "You fed your creature! They feel happy now."

### Screen Reader Support
```html
<!-- Example button markup -->
<button aria-label="Feed your creature to make them happy" 
        aria-describedby="hunger-level">
  🍎 FEED
</button>
<div id="hunger-level" class="sr-only">
  Hunger level: 30%. Your creature is getting hungry.
</div>
```

---

## 🔧 Technical Implementation Notes

### CSS Classes for Kid Mode
```css
.kid-mode {
  --font-scale: 1.2;
  --padding-scale: 1.3;
  --min-hit-target: 64px;
  --button-radius: 12px;
  --animation-duration: 100ms;
}

.kid-mode .button-primary {
  min-width: var(--min-hit-target);
  min-height: var(--min-hit-target);
  font-size: calc(1rem * var(--font-scale));
  padding: calc(12px * var(--padding-scale));
  border-radius: var(--button-radius);
}
```

### Phaser Implementation
```javascript
// Kid Mode button creation helper
function createKidModeButton(scene, x, y, text, emoji, callback) {
  const button = scene.add.container(x, y);
  
  // Background with minimum hit target
  const bg = scene.add.graphics();
  bg.fillStyle(0xFFD700);
  bg.fillRoundedRect(-32, -24, 64, 48, 8);
  
  // Text with emoji fallback
  const label = scene.add.text(0, 0, `${emoji} ${text}`, {
    fontSize: '18px',
    fontFamily: 'Arial, sans-serif',
    color: '#000000',
    align: 'center'
  }).setOrigin(0.5);
  
  button.add([bg, label]);
  button.setSize(64, 48);
  button.setInteractive({ cursor: 'pointer' });
  
  // Kid-friendly animation
  button.on('pointerdown', () => {
    scene.tweens.add({
      targets: button,
      scale: 0.95,
      duration: 50,
      yoyo: true,
      ease: 'Back.easeOut',
      onComplete: callback
    });
    
    // Audio feedback
    scene.sound?.play('kid_button_press', { volume: 0.3 });
  });
  
  return button;
}
```

---

## 🎮 Emotion-to-Action Mapping

### Primary Actions by Creature State
| Emotion | Primary CTA | Button Text | Icon | Secondary Actions |
|---------|-------------|-------------|------|-------------------|
| Hungry | Feed | "🍎 FEED" | 🍎 | Rest, Play |
| Sleepy | Rest | "🌙 NAP TIME" | 🌙 | Pet, Clean |
| Bored | Play | "🎈 PLAY!" | 🎈 | Feed, Photo |
| Excited | Photo | "📸 PHOTO TIME!" | 📸 | Play, Pet |
| Dirty | Clean | "🫧 BATH TIME" | 🫧 | Rest, Feed |
| Default | Pet | "🤗 PET" | 🤗 | Feed, Play, Rest |

### Contextual Messaging
- **Hungry**: "Your creature's tummy is rumbling! 🍎"
- **Sleepy**: "Time for a cozy nap! 🌙"
- **Bored**: "Let's have some fun together! 🎈"
- **Excited**: "Capture this happy moment! 📸"
- **Dirty**: "Splash splash! Bath time! 🫧"
- **Happy**: "Give your creature some love! 🤗"

---

## 📱 Responsive Behavior

### Mobile (≤768px)
- CTA strip fixed to bottom of screen
- Status bars at top, full width
- Main content area scrollable if needed
- Minimum 44px touch targets (iOS guidelines)

### Tablet (769px-1024px)
- CTA strip can float or dock to bottom
- Status bars can be sidebar or top bar
- More spacing between elements

### Desktop (≥1025px)
- Traditional layout with menus
- Hover states on all interactive elements
- Keyboard navigation support
- Mouse cursor changes for interactive elements

---

## 🧪 Testing Checklist

### Kid Mode Functionality
- [ ] Toggle on/off preserves game state
- [ ] All buttons meet minimum 64x64px hit targets
- [ ] Button animations play smoothly (95%→100% scale)
- [ ] Audio feedback plays on all interactions
- [ ] Emoji fallbacks display correctly

### Accessibility
- [ ] High contrast mode toggles successfully
- [ ] Screen reader announces all interactive elements
- [ ] Keyboard navigation works for all controls
- [ ] Color-only information has text/icon alternatives
- [ ] Minimum 4.5:1 contrast ratio maintained

### Responsive Design
- [ ] Layout adapts correctly on phone/tablet/desktop
- [ ] Touch targets remain accessible at all screen sizes
- [ ] Text remains readable at all zoom levels
- [ ] No horizontal scrolling on mobile

---

**📅 Version**: 1.0  
**🎯 Target Age**: 4-8 years old  
**♿ WCAG Level**: AA compliant  
**📱 Supported Devices**: iOS 12+, Android 8+, Modern browsers