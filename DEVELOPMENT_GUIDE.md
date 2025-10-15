# 🚀 Mythical Creature Game - Development Guide

## 🎯 Vibe Coding Principles Compliance

This project follows the **Vibe Coding Playbook** principles for maintainable, secure, and observable software.

---

## 📋 Development Workflow

### 🔄 **Before Making Changes**
```bash
# 1. Validate current game flow integrity
npm run validate-flow

# 2. Check application health
npm run health-check

# 3. Start development server
npm run dev

# Reference: see LOCAL_SERVER_REFERENCE.md for port mappings & additional local servers
```

### ✅ **Pre-Commit Checklist**
```bash
# Automated validation (runs automatically)
npm run pre-commit

# Manual testing
# 1. Test complete game flow: Home → Start → Hatch → Personality → Name → Game
# 2. Test reset functionality
# 3. Check browser console for error-free operation
```

---

## 🏗️ **Architecture Overview**

### **12-Factor App Compliance**

#### ✅ **I. Codebase**
- Single repository with version control
- Multiple deployment environments supported

#### ✅ **II. Dependencies**
- All dependencies declared in `package.json`
- No implicit system dependencies

#### ✅ **III. Config**
- Environment variables in `src/config/env-loader.js`
- No hardcoded secrets (see `.env.example`)
- API configuration externalized

#### ✅ **IV. Backing Services**
- Game state persistence via localStorage
- External APIs treated as attached resources

#### ✅ **V. Build, Release, Run**
- Clear separation of concerns
- Static assets with no build step required
- Release configurations in `netlify.toml` and `vercel.json`

#### ✅ **VI. Processes**
- Stateless game engine (Phaser.js)
- State persistence handled by GameState system

#### ✅ **VII. Port Binding**
- Self-contained with http-server
- Port configuration via environment

#### ✅ **VIII. Concurrency**
- Client-side application with efficient resource usage
- Memory management via MemoryManager system

#### ✅ **IX. Disposability**
- Fast startup with immediate game availability
- Graceful shutdown with state persistence

#### ✅ **X. Dev/Prod Parity**
- Same codebase for all environments
- Environment-specific configuration

#### ✅ **XI. Logs**
- Structured logging with debug levels
- No localStorage logs in production

#### ✅ **XII. Admin Processes**
- Health checks available at `/health`
- Game state validation tools

---

### **🔒 OWASP Security Compliance**

#### ✅ **Input Validation**
- `InputValidator` system for user input
- XSS prevention in creature naming
- Sanitization of localStorage data

#### ✅ **Authentication & Authorization**
- No sensitive authentication required
- Local storage isolation per domain

#### ✅ **Session Management**
- Secure session handling via GameState
- No server-side sessions required

#### ✅ **Cryptography**
- No sensitive data encryption needed
- Secure random generation for creature traits

#### ✅ **Error Handling**
- `ErrorHandler` system with graceful degradation
- No sensitive data in error messages
- Proper fallback mechanisms

#### ✅ **Logging & Monitoring**
- Security-aware logging (no secrets logged)
- Error tracking and reporting

---

### **📊 Observability Implementation**

#### **Health Monitoring**
```javascript
// Health endpoints available:
GET /health        // Basic health check
GET /readiness     // Readiness probe
GET /metrics       // Performance metrics
```

#### **Logging Strategy**
```javascript
// Structured logging levels:
console.log('[GameState] Normal operation');
console.warn('[GameState] Warning condition'); 
console.error('[GameState] Error requiring attention');
```

#### **Performance Monitoring**
- `MemoryManager` tracks resource usage
- Automatic cleanup and optimization
- Performance metrics collection

#### **Error Tracking**
- `ErrorHandler` centralized error management
- User-friendly error messages
- Development vs production error handling

---

## 🛡️ **Protected Code Sections**

### **Critical Files - Require Review for Changes**
1. `src/scenes/HatchingScene.js` - Game flow logic
2. `src/systems/GameState.js` - State persistence 
3. `src/systems/ErrorHandler.js` - Error management
4. `src/config/api-config.js` - Security configuration

### **Validation Commands**
```bash
# Validate game flow integrity
npm run validate-flow

# Check for security issues (manual review)
grep -r "API_KEY\|SECRET\|PASSWORD" src/ || echo "No hardcoded secrets found"

# Health check endpoints
curl http://localhost:8080/health
```

---

## 🧪 **Testing Strategy**

### **Manual Testing Protocol**
1. **Fresh User Flow**
   - Clear localStorage: `localStorage.clear()`
   - Navigate to home screen
   - Click START GAME
   - Verify egg hatching screen appears

2. **Complete Journey**
   - Complete egg hatching
   - Verify personality reveal
   - Name creature successfully  
   - Enter game world

3. **Reset Functionality**
   - Use RESET button
   - Verify complete state reset
   - Confirm fresh game experience

4. **State Persistence**
   - Refresh browser during each scene
   - Verify state maintains correctly
   - Check localStorage integrity

### **Automated Validation**
```bash
# Run integrity checks
npm run validate-flow

# Performance validation
npm run health-check
```

---

## 📚 **Code Quality Standards**

### **Naming Conventions**
- Classes: `PascalCase` (e.g., `GameStateManager`)
- Functions: `camelCase` (e.g., `createCreature`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_NAME_LENGTH`)
- Files: `PascalCase` for classes, `camelCase` for utilities

### **Documentation Standards**
- All critical functions have JSDoc comments
- Complex logic includes inline explanations
- README files for each major system
- Architecture decisions documented

### **Error Handling Patterns**
```javascript
// Standard error handling pattern
try {
    // Operation
    GameState.save();
    console.log('✅ Operation successful');
} catch (error) {
    console.error('❌ Operation failed:', error);
    if (window.errorHandler) {
        window.errorHandler.handleError({
            type: 'save',
            message: 'Failed to save game state',
            error: error,
            severity: 'warning'
        });
    }
    // Fallback behavior
}
```

---

## 🚀 **Deployment Checklist**

### **Pre-Deploy Validation**
```bash
# 1. Code integrity
npm run validate-flow

# 2. Health systems
npm run health-check

# 3. Security review
# - No hardcoded secrets
# - Environment variables configured
# - HTTPS headers configured

# 4. Performance check
# - Memory usage acceptable
# - No console errors
# - Smooth game flow
```

### **Environment Configuration**
- Set environment variables in hosting platform
- Configure security headers (CSP, HSTS)
- Enable monitoring and logging
- Test health endpoints

### **Post-Deploy Verification**
- Health endpoint responding: `https://yourdomain.com/health`
- Game flow working end-to-end
- No console errors in production
- Performance within acceptable limits

---

## 📞 **Support & Maintenance**

### **Issue Reporting**
1. Check game flow integrity: `npm run validate-flow`
2. Review console logs for errors
3. Document reproduction steps
4. Include environment information

### **Common Issues & Solutions**

#### **Game Skipping Egg Hatching**
- **Cause:** Critical game flow code modified
- **Solution:** Run `npm run validate-flow` and restore missing patterns
- **Reference:** `GAME_FLOW_DOCUMENTATION.md`

#### **State Not Persisting**
- **Cause:** localStorage issues or save timing
- **Solution:** Check browser storage settings and GameState.save() calls

#### **Performance Issues**
- **Cause:** Memory leaks or inefficient resource usage  
- **Solution:** Check MemoryManager stats and perform cleanup

---

## 🔧 **Development Commands Reference**

```bash
# Start development server
npm run dev

# Validate game flow integrity  
npm run validate-flow

# Check application health
npm run health-check

# Run pre-commit checks
npm run pre-commit

# Lint code (placeholder - add ESLint for production)
npm run lint

# Build for production (static files - no build needed)
npm run build
```

---

**📅 Last Updated:** $(date)
**🔒 Compliance Status:** ✅ Vibe Coding Principles Compliant
**🛡️ Security Status:** ✅ OWASP Guidelines Followed  
**📊 Monitoring:** ✅ Observability Implemented
