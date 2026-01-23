# SafetyManager Removal & Codebase Cleanup Plan

## Summary

SafetyManager is confirmed **dead code** - imported and initialized but never actually used by any game logic. This document outlines the safe removal process.

---

## Evidence of Dead Code

### SafetyManager Usage Analysis

**Files that reference SafetyManager:**
| File | Type | Reference |
|------|------|-----------|
| `src/systems/SafetyManager.js` | Code | The system itself |
| `src/global-init.js` | Code | Import statement only |
| `CLAUDE.md` | Docs | Documentation reference |
| `docs/TESTING.md` | Docs | Test file reference |
| `docs/CLEANUP_RECOMMENDATIONS.md` | Docs | Mentioned in list |
| `docs/archive/` | Docs | Archive references |
| `docs/planning/SAFE_AI_DIRECTOR_DESIGN.md` | Docs | Design reference |

**Files that actually CALL SafetyManager methods:** NONE

The SafetyManager provides these features that are **never used**:
- `isKidProfileActive()` - Never called
- `isGuardianPinSet()` - Never called
- `verifyGuardianPin()` - Never called
- `setGuardianPin()` - Never called
- `enableKidProfile()` / `disableKidProfile()` - Never called
- `auditLog()` - Never called
- `getAuditLog()` - Never called

---

## Cleanup Steps

### Step 1: Remove SafetyManager Code

**Delete file:**
```
src/systems/SafetyManager.js
```

**Remove import from global-init.js:**
```javascript
// DELETE THIS LINE:
import './systems/SafetyManager.js';
```

### Step 2: Remove Test File (if exists)

Check if `src/__tests__/SafetyManager.test.js` exists and remove it.

### Step 3: Update Documentation

**CLAUDE.md changes:**
1. Remove SafetyManager from initialization order (line ~53)
2. Remove "SafetyManager handles parental controls" mention (line ~1035)
3. Remove from architecture diagram (line ~1111)
4. Remove from "Security & Safety" section reference

**Other docs to update:**
- `docs/TESTING.md` - Remove SafetyManager test reference
- `docs/CLEANUP_RECOMMENDATIONS.md` - Remove SafetyManager mention

### Step 4: Clean Up GameState Safety Keys

SafetyManager stored data in GameState under these keys (can be left for backward compatibility or cleaned):
- `safety.kidProfileEnabled`
- `safety.guardianPinHash`
- `safety.auditLog`

**Recommendation:** Leave these keys alone - they don't hurt anything and may be useful if parental controls are ever reimplemented.

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Breaking functionality | **None** | SafetyManager is never called |
| Test failures | **Low** | Remove any SafetyManager tests |
| Import errors | **Low** | Single import to remove |

---

## KidMode Status

**KidMode IS being used** - do NOT remove. It's actively integrated in:
- `src/systems/UITheme.js`
- `src/systems/ResponsiveManager.js`
- `src/scenes/GameScene.js`
- `src/scenes/HatchingScene.js`

KidMode runs invisibly (always enabled) and affects:
- UI text sizes
- Button sizes
- Content filtering
- Simplified actions

---

## Additional Cleanup Opportunities

While cleaning up, consider these other candidates identified during audit:

### Low-Priority Cleanup
1. **Archive old planning docs** - Move completed plans to `docs/archive/`
2. **Remove commented-out code** - Search for large comment blocks
3. **Consolidate config files** - Some overlap between personality configs

### Do NOT Remove
- KidMode (actively used)
- CreatureMemory (used for creature history)
- Any system referenced in actual game scenes

---

## Execution Checklist

- [ ] Delete `src/systems/SafetyManager.js`
- [ ] Remove import from `src/global-init.js`
- [ ] Delete `src/__tests__/SafetyManager.test.js` (if exists)
- [ ] Update `CLAUDE.md` (4 locations)
- [ ] Update `docs/TESTING.md`
- [ ] Update `docs/CLEANUP_RECOMMENDATIONS.md`
- [ ] Run `npm run dev` to verify no errors
- [ ] Run `npm run build` to verify production build
- [ ] Run `npm run test:unit` to verify tests pass

---

## Timeline

This cleanup can be done in a single session (~15 minutes of actual changes).

---

*Plan created for SafetyManager removal - confirmed dead code with zero runtime usage.*
