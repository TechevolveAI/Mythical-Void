# Mythical Void

**A free browser adventure where you hatch a strange alien creature, cross six
living realms and decide what Project Beacon should tell Earth.**

[Play Mythical Void](https://mythicalvoid.com/playable-now/) ·
[Start the game](https://mythicalvoid.com/play/) ·
[Family guide](https://mythicalvoid.com/parents/) ·
[Press and creator facts](https://mythicalvoid.com/press/)

No download, account, payment details, game adverts or public chat are needed.
The game is in early access and works in a modern desktop or mobile browser.

Recover Wanderer-77, hatch and name an alien creature shaped by a genetics
system, cross six living realms, release guardians trapped by the Void, build a
shared sanctuary and decide what Project Beacon should become.

Mythical Void began in Ireland as a father-and-son experiment: Kevin and his
nine-year-old son exploring what imagination and generative AI tools could make
possible. Optional NASA-sourced material opens a doorway from the fictional
universe into real space discovery; NASA does not make or endorse the game.

AI helps this tiny independent studio explore, build and test. People remain
responsible for the story, safety boundaries, public claims and important
choices. Generated universe artwork is never presented as gameplay.

## Developer documentation

The public website is served at `/` and the Phaser game starts at `/play/`.
The detailed notes below support development and testing; historical plans in
`archive/` may not describe the current game.

## 📁 Documentation Structure

**Current Features & Development Guides** (in root directory):
- [README.md](README.md) - This file, game overview and getting started
- [CLAUDE.md](CLAUDE.md) - Architecture guide for AI assistants and developers
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment instructions
- [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) - Development setup and workflows
- [GAME_FLOW_DOCUMENTATION.md](GAME_FLOW_DOCUMENTATION.md) - Critical game flow logic
- [SECURITY.md](SECURITY.md) - Security practices and compliance
- [TECHNICAL_IMPLEMENTATION.md](TECHNICAL_IMPLEMENTATION.md) - Technical architecture details
- [TUNING_GUIDE.md](TUNING_GUIDE.md) - Game balance and tuning
- [VIBE_CODING_COMPLIANCE.md](VIBE_CODING_COMPLIANCE.md) - Security standards
- [LOCAL_SERVER_REFERENCE.md](LOCAL_SERVER_REFERENCE.md) - Local development reference

**Future Plans & Historical Analysis** (in `/archive/` directory):
- `/archive/planning/` - MVP roadmaps and implementation plans
- `/archive/future-features/` - Specs for features not yet built
- `/archive/gap-analysis/` - Feature gap reports and business analysis
- `/archive/vision/` - Long-term vision documents

**Note**: If documentation is in `/archive/`, it describes future features NOT in the current game yet!

## 🎮 How to Play

### Hatching Scene
1. **Click the floating egg** to start the hatching process
2. Watch as the egg **changes color** from cream → pink → red during hatching
3. The **hatching percentage** shows your progress (0-100%)
4. After hatching completes, `SoulRevealScene` handles the reveal and naming step
5. **Press SPACE** to continue into `GameScene`, where the main sanctuary loop begins

### Game Scene
1. **Move your creature** using:
   - **Arrow Keys** or **WASD** for movement
   - Smooth diagonal movement supported
2. **Explore the large world** (1600x1200 pixels)
   - Camera automatically follows your creature
   - **Position display** shows your current coordinates
3. **Interact with the environment**:
   - **Trees and rocks**: Solid obstacles with collision detection
   - **Flowers**: Walk near them and **press SPACE to smell** them
   - Sparkle effects appear during interactions
4. `GameScene` now acts as the main sanctuary/orchestration scene for inventory, shop, hub, and overlay routing, with HUD-specific work moving into a dedicated controller

## 🚀 Getting Started

### Prerequisites
- Node.js installed on your system

### Installation & Running
```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Create a production build (optional)
npm run build
```

The Vite dev server is configured for port **8080**. After running `npm run dev`, open the printed root URL for the storefront or add `/play/` to launch the game. Vite will use the next free port when 8080 is busy.

Looking for the manual test harness instead? Run `npm test` and open the URL it prints (starts at `http://localhost:8080/test-framework.html` with automatic fallback to nearby ports).

### Configuration

Environment values exposed to the browser must use the `VITE_` prefix. Create an `.env.local` (ignored by git) and add entries such as `VITE_ENABLE_API_FEATURES=true` to toggle optional integrations.

Optional cloud saves use the dedicated Supabase project configured by
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Cloud saving remains
disabled until the player explicitly opts in; local browser saves continue to
work without Supabase. See [docs/cloud-saves.md](docs/cloud-saves.md).

## 🎨 Game Features

### Visual Style
- **Programmatically created sprites** using Phaser graphics
- **Colorful, family-friendly** art style
- **Smooth animations** including:
  - Egg floating animation
  - Wing flapping walk cycle (4 frames)
  - Sparkle effects
  - Color transitions during hatching

### Gameplay Mechanics
- **Physics-based collision detection** with environment objects
- **Normalized diagonal movement** for smooth controls
- **Camera system** that follows the player through the large world
- **Interactive environment** with feedback systems
- **Progressive egg hatching** with visual and percentage feedback

### World Design
- **Large explorable world** (1600x1200)
- **Randomly placed environment objects**:
  - 20 trees of varying sizes
  - 30 rocks with different scales
  - 40 interactive flowers
- **Procedural background texturing**
- **Collision boundaries** to keep player in world

## 🛠️ Technical Details

- **Framework**: Phaser.js 3.70.0
- **Physics**: Arcade Physics System
- **Canvas Size**: 800x600
- **World Size**: 1600x1200 (2x larger than viewport)
- **Sprites**: All created programmatically (no external image files needed)

## 📁 Project Structure

```
├── index.html          # Shared website and game document shell
├── package.json        # NPM configuration
├── src/
│   ├── main.js         # Route-aware website/game entry point
│   ├── game.js         # Phaser initialization and config
│   ├── site/           # Public storefront UI and styles
│   ├── config/         # Configuration management
│   │   ├── env-loader.js     # Environment variable loader
│   │   └── api-config.js     # API configuration (secure)
│   ├── scenes/         # Game scenes
│   │   ├── HatchingScene.js   # Egg hatching gameplay
│   │   ├── SoulRevealScene.js # Reveal + naming flow
│   │   ├── NamingScene.js     # Legacy compatibility flow
│   │   └── GameScene.js       # Main sanctuary/orchestration gameplay; HUD split into a controller
│   └── systems/        # Core game systems
│       ├── GameState.js      # Game progress management
│       ├── GraphicsEngine.js # Programmatic graphics
│       ├── ErrorHandler.js   # Error management
│       └── ...               # Additional systems
├── docs/               # Documentation
│   └── openapi.yaml    # API specification
├── .env                # Environment variables (not in git)
├── .env.example        # Environment template
├── netlify.toml        # Netlify deployment config
├── vercel.json         # Vercel deployment config
├── DEPLOYMENT.md       # Deployment guide
├── SECURITY.md         # Security documentation
└── assets/             # Game assets
    ├── images/
    └── sounds/
```

## 🎯 Game Controls

| Control | Action |
|---------|--------|
| **Mouse Click** | Click egg to start hatching (Hatching Scene) |
| **Arrow Keys** | Move creature |
| **WASD** | Alternative movement controls |
| **SPACE** | Start adventure / Interact with flowers |

## ✨ Special Effects

- **Floating egg animation** with gentle up/down movement
- **Progressive color changes** during hatching process
- **Shaking animation** while hatching
- **Sparkle effects** when creature appears and during flower interactions
- **Wing flapping animation** while walking
- **Smooth camera following** with world boundaries

## 🛡️ Security Features

This project follows the **Vibe Coding Playbook** security standards:
- **Secure environment configuration** - No hardcoded API keys
- **OWASP Top 10 compliance** - Security headers and input validation
- **Health monitoring** - Built-in health check endpoints
- **12-factor app methodology** - Configuration via environment variables

## 🚀 Deployment Ready

The project includes production-ready deployment configurations:
- **Netlify** - `netlify.toml` with security headers
- **Vercel** - `vercel.json` with optimized settings  
- **Self-hosted** - Comprehensive deployment guide
- **API documentation** - OpenAPI 3.1 specification

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for detailed deployment instructions and [`SECURITY.md`](SECURITY.md) for security documentation.

## 🏥 Health Monitoring

Built-in health check endpoints:
- `/health` - Basic health status
- `/readiness` - Detailed system readiness
- `/metrics` - System performance metrics

Test in browser console:
```javascript
await callHealthEndpoint('/health');
await callHealthEndpoint('/readiness');
```

Enjoy your magical adventure! 🌟
