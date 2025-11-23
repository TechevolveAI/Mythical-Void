# Deployment Guide

This document provides comprehensive deployment instructions following the Vibe Coding Playbook standards and 12-factor app methodology.

## 📋 Pre-deployment Checklist

### Security ✅
- [x] API keys moved to environment variables (`.env`)
- [x] Secrets excluded from git (`.gitignore` updated)
- [x] OWASP security headers implemented
- [x] Content Security Policy configured
- [x] API features disabled by default in production

### Architecture ✅
- [x] Health check endpoints implemented (`/health`, `/readiness`)
- [x] OpenAPI specification created (`/docs/openapi.yaml`)
- [x] Environment configuration system in place
- [x] Error handling and monitoring configured

### Code Quality ✅
- [x] Linting configured (ESLint)
- [x] Testing framework implemented
- [x] Modular project structure maintained

## 🚀 Deployment Options

### Option 1: Netlify (Recommended)

#### Quick Deploy
1. **Connect Repository**
   ```bash
   # If using git, ensure repository is clean
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Deploy via Netlify Dashboard**
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import from Git"
   - Select your repository
   - Build settings are pre-configured in `netlify.toml`

3. **Manual Deploy (Alternative)**
   ```bash
   # Install Netlify CLI
   npm install -g netlify-cli
   
   # Deploy from project directory
   cd /path/to/mythical-void/getting-started-sample
   netlify deploy --prod --dir .
   ```

#### Environment Variables Setup
```bash
# In Netlify dashboard: Site settings → Environment variables
NODE_ENV=production
ENABLE_API_FEATURES=false

# Only add if you need AI features:
XAI_API_KEY=your_actual_key_here
XAI_ENDPOINT=https://api.x.ai/v1/chat/completions
XAI_MODEL=grok-4-latest
```

### Option 2: Vercel

#### Deploy with Vercel CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project directory
cd /path/to/mythical-void/getting-started-sample
vercel --prod
```

#### Deploy via Dashboard
1. Go to [vercel.com](https://vercel.com)
2. Import your git repository
3. Configuration is pre-configured in `vercel.json`

### Option 3: GitHub Pages

#### Setup GitHub Pages
```bash
# Create gh-pages branch
git checkout -b gh-pages
git push origin gh-pages

# Go to repository settings → Pages
# Set source to "Deploy from a branch" → gh-pages
```

Note: GitHub Pages doesn't support server-side environment variables, so API features will be disabled.

### Option 4: Self-hosted (Apache/Nginx)

#### Apache Configuration
```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    DocumentRoot /path/to/mythical-void/getting-started-sample
    
    # Security headers
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    
    # Enable compression
    LoadModule deflate_module modules/mod_deflate.so
    <Location />
        SetOutputFilter DEFLATE
        SetEnvIfNoCase Request_URI \.(?:gif|jpe?g|png)$ no-gzip
    </Location>
</VirtualHost>
```

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /path/to/mythical-void/getting-started-sample;
    index index.html;
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Fallback for SPA
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 🔧 Configuration Management

### Environment Variables

#### Required for Production
```bash
NODE_ENV=production
ENABLE_API_FEATURES=false  # Set to true only if you need AI features
```

#### Optional (for AI features)
```bash
XAI_API_KEY=your_xai_api_key
XAI_ENDPOINT=https://api.x.ai/v1/chat/completions
XAI_MODEL=grok-4-latest
```

#### Additional Configuration
```bash
# Game settings
GAME_SAVE_PREFIX=mythical_creature_game
AUTO_SAVE_INTERVAL=30000
MAX_SAVE_SLOTS=3

# Security
CORS_ORIGINS=https://yourdomain.com
```

### Build-time Configuration

For platforms that support build-time environment injection, create `.env.production`:

```bash
# .env.production
NODE_ENV=production
ENABLE_API_FEATURES=false
```

## 🏥 Health Checks

### Monitoring Endpoints

Your deployed application will have these health check endpoints:

- **`/health`** - Basic health status (quick check)
- **`/healthz`** - Kubernetes-style health endpoint  
- **`/readiness`** - Detailed readiness check
- **`/readyz`** - Kubernetes-style readiness endpoint
- **`/metrics`** - System metrics for monitoring

### Test Health Endpoints

```bash
# Test after deployment
curl https://yourdomain.com/health
curl https://yourdomain.com/readiness

# Or test in browser console
await callHealthEndpoint('/health');
await callHealthEndpoint('/readiness');
```

## 🔍 Monitoring & Maintenance

### Production Monitoring

1. **Set up uptime monitoring** (Uptime Robot, Pingdom, etc.)
   - Monitor `https://yourdomain.com/health`
   - Alert if status is not "healthy"

2. **Error tracking** (Sentry, LogRocket, etc.)
   - Integrate with the existing ErrorHandler system

3. **Performance monitoring**
   - Use the built-in `/metrics` endpoint
   - Monitor page load times and game performance

### Log Analysis

Check browser console for:
- ✅ "Game initialized successfully"
- ✅ "Environment configuration loaded"
- ✅ "Health endpoints created"
- ⚠️ Any warning messages about missing configuration

## 🔒 Security Considerations

### Pre-deployment Security Checklist

- [ ] **API keys secured** - No keys in source code
- [ ] **HTTPS enabled** - Force SSL/TLS
- [ ] **Security headers configured** - CSP, HSTS, etc.
- [ ] **Dependencies updated** - No known vulnerabilities
- [ ] **Access controls** - Restrict admin interfaces

### Post-deployment Security

1. **SSL/TLS Certificate**
   ```bash
   # Most platforms handle this automatically
   # For self-hosted, use Let's Encrypt:
   certbot --apache -d yourdomain.com
   ```

2. **Security Headers Verification**
   ```bash
   # Test security headers
   curl -I https://yourdomain.com
   ```

3. **API Security** (if enabled)
   - Use API rate limiting
   - Monitor for unusual usage patterns
   - Rotate API keys regularly

## 🚨 Troubleshooting

### Common Issues

#### "Environment not loaded" error
- Check `.env` file exists and is readable
- Verify environment variables are set correctly
- For static hosting, ensure build-time injection works

#### Health checks failing
- Check browser console for specific error messages
- Verify all required scripts are loading
- Test each system component individually

#### Game not loading
- Check network tab for failed script loads
- Verify Phaser.js CDN is accessible
- Check for JavaScript errors in console

### Debug Mode

Enable debug logging:
```bash
# Add to environment variables
DEBUG=true
```

### Getting Help

1. Check the browser console for error messages
2. Test health endpoints: `await callHealthEndpoint('/health')`
3. Review the deployment platform's logs
4. Check this repository's issues for common problems

## 📈 Performance Optimization

### Production Optimizations

1. **Enable compression** (gzip/brotli)
2. **Set up CDN** for static assets
3. **Optimize images** in `/assets/` folder
4. **Enable caching** for static resources

### Monitoring Performance

```javascript
// Check performance in browser console
console.log(await callHealthEndpoint('/metrics'));

// Monitor memory usage
setInterval(() => {
  const memory = performance.memory;
  console.log(`Memory: ${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`);
}, 10000);
```

## 🎯 Next Steps

After successful deployment:

1. **Test all game functions** thoroughly
2. **Set up monitoring** and alerts
3. **Configure backup** systems (if applicable)
4. **Plan for scaling** (if needed)
5. **Document any custom configurations**

## 📚 Resources

- [12-Factor App Methodology](https://12factor.net/)
- [OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/)
- [Netlify Documentation](https://docs.netlify.com/)
- [Vercel Documentation](https://vercel.com/docs)
- [Vibe Coding Playbook](link-to-playbook)

---

**Deployment Status**: ✅ Ready for production deployment

Your Mythical Creature Game is now configured following industry best practices and is ready for secure, scalable deployment! 🚀