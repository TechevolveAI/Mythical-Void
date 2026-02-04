# Mythical Void - Website Creation Brief for Manus

## Overview

Create a high-converting landing page for **Mythical Void**, an indie creature-raising action-adventure game. The primary goal is **audience building** - getting players to try the free browser game and join our community.

---

## URLs & Destinations

| Purpose | URL |
|---------|-----|
| **This Website** | mythicalvoid.com |
| **Game (Play Now buttons)** | https://mythical-void.netlify.app |
| **Discord** | [To be added] |
| **Twitter/X** | [To be added] |

---

## Brand Identity

### Name
**Mythical Void**

### Tagline (Primary)
> "Your creature. Your journey. Your choice to stay or go."

### Tagline (Secondary - use for variety)
> "Raise your creature. Battle the void. Find your way home."

### Elevator Pitch
Mythical Void is a creature-raising action-adventure where you bond with a procedurally-unique mythical companion and battle through cosmic realms to repair your crashed ship. Every creature is one-of-a-kind. Will you escape the void, or have you found where you truly belong?

### Target Audience
- **Primary**: Ages 8-15 who love creature games, adventure, and exploration
- **Secondary**: Adult gamers who enjoy indie games, creature collectors, and emotional narratives
- **Tone**: Magical, adventurous, mysterious but warm - sophisticated enough for teens, accessible for kids

### Value Proposition
1. **Every creature is truly unique** - Procedural genetics means no two are alike
2. **Real action gameplay** - Not just nurturing; battle bosses, explore biomes
3. **Meaningful choice** - The escape-or-stay narrative creates emotional investment
4. **Free & instant** - No download, no paywall, play immediately in browser
5. **Kid-safe** - EU AI Act compliant, family-friendly content

---

## Design System

### Color Palette

```css
:root {
  /* Core palette - use these exact values */
  --void-deep: #0D0B1E;        /* Primary backgrounds, darkest */
  --void-nebula: #2D1B4E;      /* Secondary backgrounds, cards */
  --stellar-violet: #7B4FBF;   /* Primary brand, buttons, links */
  --cosmic-magenta: #E95793;   /* Accent, CTAs, hover states */
  --stardust-gold: #FFD166;    /* Rewards, highlights, warmth */
  --aurora-cyan: #4ECDC4;      /* Energy, secondary accent */
  --star-white: #F0E6FF;       /* Text on dark, highlights */

  /* Functional colors */
  --text-primary: #F0E6FF;
  --text-secondary: rgba(240, 230, 255, 0.7);
  --card-bg: rgba(45, 27, 78, 0.6);
  --card-border: rgba(123, 79, 191, 0.3);
  --glow-color: rgba(123, 79, 191, 0.5);
}
```

### Gradients

```css
/* Hero section background */
.hero-bg {
  background: linear-gradient(135deg, #0D0B1E 0%, #2D1B4E 40%, #1A0A2E 100%);
}

/* Primary CTA buttons */
.btn-primary {
  background: linear-gradient(90deg, #7B4FBF 0%, #E95793 100%);
  box-shadow: 0 4px 20px rgba(233, 87, 147, 0.4);
}

/* Accent glow effect */
.glow {
  box-shadow: 0 0 30px rgba(123, 79, 191, 0.5);
}
```

### Typography

All fonts are Google Fonts (free, no licensing issues):

| Use | Font | Weight | Size (Desktop) | Size (Mobile) |
|-----|------|--------|----------------|---------------|
| Logo text | Orbitron | 700 | 32px | 24px |
| Hero headline | Nunito | 800 | 56px | 36px |
| Section headlines | Nunito | 700 | 42px | 28px |
| Subheadlines | Nunito | 600 | 24px | 20px |
| Body text | Nunito | 400 | 18px | 16px |
| Buttons | Poppins | 600 | 16px | 14px |
| Captions/small | Nunito | 400 | 14px | 12px |

```css
/* Font import */
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Orbitron:wght@700&family=Poppins:wght@500;600&display=swap');
```

---

## UX/UI Requirements

### Core UX Principles

1. **Instant clarity** - Within 3 seconds, visitors know: it's a creature game, it's free, they can play now
2. **Emotional hook** - The creatures are the stars; they should feel irresistible
3. **Friction-free** - One click to play; no signup required
4. **Mobile-first** - Majority of traffic will be mobile; design for thumb zones
5. **Fast loading** - Optimize images; lazy load below-fold; aim for <3s load time

### Visual Hierarchy (Per Section)

1. **Hero**: Logo → Headline → Creature image → CTA button (eyes flow naturally)
2. **Features**: Icon → Title → Description (scannable in 2 seconds)
3. **Creatures**: Image first (emotional), then label (informational)
4. **CTA sections**: Minimal text, maximum button prominence

### Button Design

**Primary CTA ("Play Now")**
- Gradient background: #7B4FBF → #E95793
- Padding: 18px 48px
- Border-radius: 12px
- Font: Poppins 600, 18px, uppercase, letter-spacing: 2px
- Box-shadow: 0 4px 25px rgba(233, 87, 147, 0.5)
- Hover: Scale 1.05, shadow intensifies, subtle pulse animation
- Text: "PLAY NOW - FREE"

**Secondary CTA ("Watch Trailer")**
- Transparent background
- Border: 2px solid #7B4FBF
- Same sizing as primary
- Hover: Fill with semi-transparent violet

### Card Design (Creatures, Features)

```css
.card {
  background: rgba(45, 27, 78, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(123, 79, 191, 0.3);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s ease;
}

.card:hover {
  transform: translateY(-8px);
  border-color: rgba(123, 79, 191, 0.6);
  box-shadow: 0 20px 40px rgba(13, 11, 30, 0.5),
              0 0 30px rgba(123, 79, 191, 0.3);
}
```

### Animations (Subtle & Purposeful)

1. **Hero creature**: Gentle floating animation (translateY ±10px over 4s)
2. **Stars background**: Slow twinkle (opacity 0.3-1 randomly)
3. **CTA buttons**: Subtle pulse glow on idle (draws attention)
4. **Scroll reveals**: Fade-in + slide-up as sections enter viewport
5. **Creature cards**: Lift on hover with enhanced glow

### Responsive Breakpoints

```css
/* Mobile first */
@media (min-width: 640px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1280px) { /* Large desktop */ }
```

---

## Page Structure

### Section 1: Hero (100vh)

**Layout**: Split - text left, creature right (stacked on mobile)

**Content**:
- Logo (logo owl.png) - top left, links to top of page
- Navigation (minimal): Play | About | Community - top right
- Headline: "Your creature. Your journey. Your choice to stay or go."
- Subheadline: "Bond with a one-of-a-kind mythical companion. Battle through cosmic realms. Play free in your browser."
- Primary CTA: "PLAY NOW - FREE" → links to https://mythical-void.netlify.app
- Secondary CTA: "Watch Trailer" → scrolls to trailer section or opens modal
- Hero creature: Creature baby 6.png (the teal one) with floating animation and glow
- Scroll indicator: Animated chevron at bottom

**Background**: Cosmic gradient with subtle animated star particles

---

### Section 2: Social Proof Bar (Optional but recommended)

**Layout**: Horizontal strip, centered text

**Content**:
- "Join [X] players exploring the void" (can be placeholder initially)
- Or: "Featured on [logos]" if you get press coverage
- Or: Three short testimonial snippets

**Style**: Semi-transparent bar, subtle border top/bottom

---

### Section 3: Video/Trailer

**Layout**: Centered, 16:9 aspect ratio container

**Content**:
- Section headline: "See the Void in Action"
- Embedded video player (YouTube/Vimeo)
- If no video: Animated GIF carousel of gameplay moments
- Caption: "Real gameplay footage - no cinematics, no tricks"

**Style**: Video container has glow effect, rounded corners

---

### Section 4: Creature Showcase

**Layout**: Section headline + 6-card grid (3x2 desktop, 2x3 tablet, 1x6 mobile scroll)

**Content**:
- Headline: "Every Creature is Unique"
- Subheadline: "Procedurally generated through advanced genetics - no two are ever the same"
- 6 creature cards:

| Image | Name/Label | Affinity Tag |
|-------|------------|--------------|
| Creature baby 6.png | "Nova" | ⭐ Star Affinity • Curious |
| Irish Ghost (Purple).png | "Wisp" | 🌀 Void Affinity • Playful |
| Creature baby 2.png | "Pebble" | 💎 Crystal Affinity • Gentle |
| Creature baby 4.png | "Zephyr" | 🌌 Nebula Affinity • Wise |
| baby creature.png | "Luna" | 🌙 Moon Affinity • Energetic |
| Creature baby 3.png | "Bloom" | ✨ Legendary Cosmic |

- Each card: Image with cosmic glow, creature name, affinity badge
- Footer text: "Your companion will be unlike any other. They're waiting for you."

---

### Section 5: Features Grid

**Layout**: 6 cards in 3x2 grid (2x3 on tablet, 1x6 on mobile)

**Content**:

| Icon | Title | Description |
|------|-------|-------------|
| 🧬 | Unique Genetics | Every creature is procedurally generated with unique colors, patterns, personalities, and abilities |
| ⚔️ | Epic Boss Battles | Fight through 5 cosmic biomes and defeat legendary guardians to collect your ship parts |
| 🚀 | A Meaningful Choice | Repair your crashed ship to escape—but will you want to leave when the time comes? |
| 🌌 | NASA Space Weather | Real space weather data from NASA affects your creature's mood and the void's atmosphere |
| 💜 | Deep Bonding | Care for your creature, shape their personality, and watch them evolve through life stages |
| 🔄 | Legacy System | Breed creatures to pass on genetic traits across generations |

**Style**: Icon above title, centered text, subtle hover lift

---

### Section 6: The Story

**Layout**: Split - atmospheric image left, text right (reversed on mobile)

**Content**:
- Image: Angry Cosmic Forest.png or boss imagery
- Headline: "Stranded in the Stars"
- Story text (3 short paragraphs):

> You were a scientist aboard The Wanderer-7, investigating strange energy readings at the edge of known space. When you discovered a tear in reality itself, the void reached back.

> Now stranded in a dimension where stars shine in impossible colors, you find a glowing egg among the wreckage. When it hatches, something magical is born—a creature that bonds to you alone.

> Together, you'll battle through cosmic realms, defeat the guardians of the void, and collect the scattered parts of your ship. But as your bond deepens, you'll face the ultimate question: is Earth still home?

---

### Section 7: Boss Teaser

**Layout**: Full-width image background with overlay text

**Content**:
- Background: Scorpion Lobster Boss.png (with dark overlay for text readability)
- Headline: "Face the Guardians"
- Subheadline: "Five legendary bosses guard the pieces of your ship. Each with unique attacks, multiple phases, and secrets to discover."
- CTA: "Challenge Them" → links to game

**Style**: Parallax scroll effect on background, dramatic lighting

---

### Section 8: How It Works

**Layout**: 3 steps in horizontal row (vertical on mobile)

**Content**:

| Step | Title | Description | Visual hint |
|------|-------|-------------|-------------|
| 1 | Discover Your Egg | Find a mysterious egg glowing among the wreckage of your ship | Egg icon or image |
| 2 | Bond & Grow | Watch your creature hatch, care for them, and watch them evolve | Baby creature |
| 3 | Battle & Explore | Fight through cosmic biomes together to find your way home | Boss/action hint |

**Style**: Connected by subtle line/arrow, numbered circles

---

### Section 9: Final CTA (Pre-footer)

**Layout**: Full-width, centered, maximum emphasis

**Content**:
- Background: Cosmic gradient, more dramatic than hero
- Headline: "Your Creature is Waiting"
- Subheadline: "No download. No signup. Just you and the void."
- Primary CTA (LARGE): "PLAY NOW - FREE" → https://mythical-void.netlify.app
- Trust badges below button: "🎮 Browser-based • 👨‍👩‍👧 Kid-safe • 🇪🇺 EU AI Act Compliant"

---

### Section 10: Footer

**Layout**: 3 columns (logo + tagline | links | social)

**Content**:
- Column 1: Small logo, tagline, copyright "© 2025 Mythical Void"
- Column 2: Links - Play Game | Privacy Policy | Terms of Service | Contact
- Column 3: Social icons - Discord | Twitter/X | TikTok | YouTube

**Style**: Darker background (#0D0B1E), subtle top border

---

## Technical Requirements

### Performance
- Target: Lighthouse score 90+ on mobile
- Lazy load all images below the fold
- Use WebP format with PNG fallbacks
- Compress all images (TinyPNG or similar)
- Minimize CSS/JS

### SEO
```html
<title>Mythical Void - Your Creature. Your Journey. Play Free.</title>
<meta name="description" content="Bond with a procedurally-unique mythical creature and battle through cosmic realms in this free browser game. No download required.">
<meta name="keywords" content="mythical void, creature game, indie game, browser game, free game, creature raising, action adventure">
```

### Open Graph (Social Sharing)
```html
<meta property="og:title" content="Mythical Void - Your Creature. Your Journey.">
<meta property="og:description" content="Bond with a one-of-a-kind mythical creature. Battle through cosmic realms. Play free in your browser.">
<meta property="og:image" content="[URL to hero creature or logo]">
<meta property="og:url" content="https://mythicalvoid.com">
<meta property="og:type" content="website">
```

### Twitter Card
```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Mythical Void - Your Creature. Your Journey.">
<meta name="twitter:description" content="Every creature is unique. Find yours in the void.">
<meta name="twitter:image" content="[URL to hero creature]">
```

### Favicon
Use the logo owl.png converted to appropriate favicon sizes (16x16, 32x32, 180x180 for Apple touch)

### Analytics
Add placeholder for Google Analytics or Plausible tracking code

---

## Image Assets Included

### Logo
- `logo/logo owl.png` - Primary logo (owl in void portal)
- `logo/LOGO design.png` - Alternative (egg with antlers)

### Creatures (for showcase)
- `creatures/Creature baby 6.png` - Teal, cute (HERO)
- `creatures/Irish Ghost (Purple).png` - Purple ghost
- `creatures/Creature baby 2.png` - Tan with green scarf
- `creatures/Creature baby 4.png` - Green serpentine
- `creatures/baby creature.png` - Pink on planet
- `creatures/Creature baby 3.png` - Tall pink/green (LEGENDARY)

### Bosses
- `bosses/Scorpion Lobster Boss.png` - Primary boss showcase
- `bosses/void scorpion.png` - Cave variant
- `bosses/Main boss plus sub bosses.png` - Group shot

### Environment
- `environment/Angry Cosmic Forest.png` - Forest biome/boss
- `environment/tree.png` - Environmental element

---

## Final Checklist

Before deploying, verify:

- [ ] All "Play Now" buttons link to https://mythical-void.netlify.app
- [ ] Logo links to top of page (or stays static)
- [ ] All images have alt text for accessibility
- [ ] Mobile navigation works (hamburger menu)
- [ ] All sections scroll smoothly
- [ ] Contact/social links are updated
- [ ] Privacy Policy and Terms pages exist (even if placeholder)
- [ ] Favicon displays correctly
- [ ] Page loads under 3 seconds on 3G
- [ ] No console errors
- [ ] Forms work (if newsletter added later)

---

## Success Metrics

This landing page succeeds if:
1. **Bounce rate < 50%** - People engage, don't immediately leave
2. **Click-through to game > 20%** - 1 in 5 visitors clicks "Play Now"
3. **Average time on page > 60s** - People are reading/exploring
4. **Mobile experience rated "excellent"** - No complaints about usability

---

*This brief should be attached along with all images from the /marketing-assets folder when submitting to Manus.*
