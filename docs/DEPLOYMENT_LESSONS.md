# Deployment Lessons Learned

## Critical Incident: January 2026 Black Screen Bug

This document captures lessons learned from a production outage that caused black screens on mythicalvoid.netlify.app.

---

## Root Causes Identified

### 1. Nested colorGenome Objects (Primary Cause)

**Problem**: `FusionPodScene.generateFallbackColorGenome()` returned nested objects instead of plain hex numbers:

```javascript
// BROKEN - Caused infinite recursion in Phaser's Color class
return {
    primary: { color: 0xFF0000, saturation: 0.8, brightness: 0.7 },  // OBJECT!
    secondary: { color: 0x00FF00, ... },
    accent: { color: 0x0000FF, ... }
};

// CORRECT - Plain hex numbers
return {
    primary: 0xFF0000,
    secondary: 0x00FF00,
    accent: 0x0000FF
};
```

**Error**: "Maximum call stack size exceeded" in Phaser's Color.setTo() method.

**Fix**: Always return plain hex integers for colorGenome properties.

### 2. Missing extractHexColor() Method

**Problem**: GraphicsEngine was calling `this.extractHexColor()` in 33+ places, but the method was **never defined** in the class. It existed in FXLibrary, HatchCinematics, and StageVisualResolver, but not GraphicsEngine.

**Fix**: Added the method to GraphicsEngine with comprehensive object handling.

### 3. Terser Minification Breaking Phaser

**Problem**: Terser's aggressive optimization options were likely breaking Phaser's internal color handling:
- `toplevel: true` - mangles top-level variable names
- `properties: { regex: /^_/ }` - mangles underscore properties
- These can break libraries that rely on specific naming conventions

**Fix**: Switched to esbuild (Vite's default) which is:
- Faster (18s vs 80s build time)
- More conservative optimization
- Less likely to break complex libraries

### 4. Corrupted Saved Data

**Problem**: Creatures saved with nested colorGenome objects caused crashes when loaded.

**Fix**: Added `sanitizeColorGenome()` migration in GameState.load() that automatically fixes bad data.

---

## Netlify Deployment Best Practices

### Build Environment Configuration

```toml
[build.environment]
  NODE_VERSION = "20"           # Pin to LTS - Node 22 has npm bugs
  NODE_ENV = "development"      # CRITICAL: Allows devDependencies to install
  NPM_CONFIG_PRODUCTION = "false"
```

### Build Command

```toml
command = "rm -rf node_modules package-lock.json && npm install && npm run build"
```

**Why delete node_modules and package-lock.json?**
1. package-lock.json generated on Mac doesn't include Linux-specific optional dependencies
2. Cached node_modules can have stale/incompatible binaries
3. Fresh install ensures Netlify gets the correct platform-specific packages

### Common Netlify Deployment Failures

| Error | Cause | Solution |
|-------|-------|----------|
| `vite: not found` | NODE_ENV=production skips devDependencies | Set NODE_ENV=development |
| `Cannot find module @rollup/rollup-linux-x64-gnu` | Optional dependency not installed | Delete package-lock.json, fresh install |
| `EEXIST: file already exists` | npm cache corruption | Add `npm cache clean --force` |
| `Invalid TOML` | Bad netlify.toml syntax | Remove invalid sections like `[edge_functions]` |

### Platform-Specific Dependencies

Some packages have optional native binaries for different platforms:
- `@rollup/rollup-linux-x64-gnu` - Rollup for Linux
- `lightningcss-linux-x64-gnu` - LightningCSS for Linux

These are automatically installed by npm when package-lock.json is deleted on Linux.

---

## Git Workflow Rules

### NEVER Deploy Directly from Main

**Rule**: All development work must happen on feature branches. Main branch is protected.

**Workflow**:
```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes, test locally
npm run dev
npm run build

# Commit and push to feature branch
git push -u origin feature/my-feature

# Create PR, review, then merge to main
# Netlify auto-deploys from main
```

### Branch Naming Conventions

- `feature/` - New features
- `fix/` - Bug fixes
- `hotfix/` - Emergency production fixes
- `docs/` - Documentation only

### Pre-Commit Checklist

Before pushing ANY changes:

1. [ ] Run `npm run dev` - Does the game load?
2. [ ] Run `npm run build` - Does it build without errors?
3. [ ] Run `npm run validate-flow` - Are critical code sections intact?
4. [ ] Test creature rendering - Do creatures appear with colors?
5. [ ] Check console for errors - Any stack overflow warnings?

---

## Code Quality Rules for Color Handling

### Always Use extractHexColor()

When accessing colorGenome properties, ALWAYS use the helper:

```javascript
// WRONG - Direct access can fail if colorGenome has nested objects
const color = colorGenome.primary;

// CORRECT - Safe extraction with fallback
const color = this.extractHexColor(colorGenome.primary, 0x9370DB);
```

### colorGenome Expected Structure

```javascript
{
    primary: 0x9370DB,      // Plain hex integer
    secondary: 0x8A2BE2,    // Plain hex integer
    accent: 0xFFD700,       // Plain hex integer
    shimmerIntensity: 0.5,  // Number 0-1
    colorComplexity: 0.5,   // Number 0-1
    // ... other numeric properties
}
```

### Never Return Nested Color Objects

When creating colorGenome data:

```javascript
// WRONG
return {
    primary: { color: 0xFF0000, saturation: 0.8 }
};

// CORRECT
return {
    primary: 0xFF0000,
    // Store saturation separately if needed
    saturationLevel: 0.8
};
```

---

## Minification Configuration

### Recommended: esbuild (Current)

```javascript
// vite.config.js
build: {
    minify: 'esbuild'  // Fast, safe default
}
```

### If Terser is Needed (with Safe Options)

```javascript
// vite.config.js - ONLY if obfuscation is required
build: {
    minify: 'terser',
    terserOptions: {
        compress: {
            drop_console: false,  // Keep console for debugging
            dead_code: true
        },
        mangle: {
            toplevel: false,      // DON'T mangle top-level (breaks modules)
            keep_classnames: true,
            properties: false     // DON'T mangle properties (breaks Phaser)
        }
    }
}
```

---

## Testing Deployment Changes

### Local Production Build Test

```bash
# Build production bundle
npm run build

# Serve production build locally
npm run preview

# Test at http://localhost:8080
```

### Netlify Deploy Preview

1. Push to feature branch
2. Create PR to main
3. Netlify creates deploy preview URL
4. Test preview before merging

### Rollback Procedure

If production breaks:

1. Go to Netlify dashboard
2. Find last working deploy in "Deploys" tab
3. Click deploy → "Publish deploy"
4. This instantly rolls back production

---

## Monitoring Production

### Key Console Errors to Watch

- `Maximum call stack size exceeded` - Recursive color processing
- `Cannot read property of undefined` - Missing colorGenome data
- `Texture not found` - Graphics generation failed

### Health Checks

The game has built-in logging:
- `[GameState]` - Save/load operations
- `[GraphicsEngine]` - Creature rendering
- `[HatchCinematics]` - Hatching sequence

---

## Incident Response

### If Black Screen Occurs

1. **Check console** for error type
2. **Check Netlify deploy logs** for build issues
3. **Rollback** to last working deploy immediately
4. **Investigate** on a feature branch
5. **Fix and test** locally before deploying

### Emergency Contacts

- Netlify Status: https://www.netlifystatus.com/
- Phaser Issues: https://github.com/photonstorm/phaser/issues

---

## Version History

| Date | Version | Change |
|------|---------|--------|
| 2026-01-25 | 1.1.0 | Switched to esbuild, added color sanitization |
| 2026-01-24 | 1.0.x | Multiple attempted fixes for black screen |
| 2026-01-23 | 1.0.0 | Issue first observed after legal compliance commit |
