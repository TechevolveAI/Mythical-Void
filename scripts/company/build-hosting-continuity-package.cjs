#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const outputDir = path.join(root, 'dist-continuity');
const indexPath = path.join(outputDir, 'index.html');
const routeCopies = ['play', 'game', 'privacy', 'terms'];

const redirects = `# Static continuity routes. Optional server features stay unavailable.\n/api/* /api/unavailable.json 200\n/.netlify/functions/* /api/unavailable.json 200\n/space-signal/* /space-discovery/ 301\n/press/gameplay/* /press/ 302\n/press/gameplay-video/* /press/ 302\n/press/social/* /press/ 302\n/press/social-video/* /press/ 302\n/press/creator-kit/* /press/ 302\n/resources/mythical-void-play-share-card.pdf /press/ 302\n/resources/previews/play-share-card.png /press/ 302\n/* /index.html 200\n`;

const headers = `/*\n  Strict-Transport-Security: max-age=31536000; includeSubDomains\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()\n  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.nasa.gov https://apod.nasa.gov https://mars.nasa.gov https://mkcmdbzcihjgidjuypqe.supabase.co; media-src 'self' blob: https://mkcmdbzcihjgidjuypqe.supabase.co; connect-src 'self' https://mkcmdbzcihjgidjuypqe.supabase.co https://api.nasa.gov; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/sw.js\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/pwa-install.js\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/updates/feed.xml\n  Content-Type: application/rss+xml; charset=utf-8\n\n/updates/feed.json\n  Content-Type: application/feed+json; charset=utf-8\n`;

function buildContinuityPackage(baseDir = outputDir) {
    const entry = path.join(baseDir, 'index.html');
    if (!fs.existsSync(entry)) {
        throw new Error(`Continuity build is missing ${entry}. Run vite build --mode continuity first.`);
    }

    const index = fs.readFileSync(entry, 'utf8');
    if (!index.includes('data-hosting-continuity="static"')) {
        throw new Error('Continuity marker is missing from the built entry page.');
    }

    fs.copyFileSync(entry, path.join(baseDir, '404.html'));
    routeCopies.forEach(route => {
        const routeDir = path.join(baseDir, route);
        fs.mkdirSync(routeDir, { recursive: true });
        fs.copyFileSync(entry, path.join(routeDir, 'index.html'));
    });

    const apiDir = path.join(baseDir, 'api');
    fs.mkdirSync(apiDir, { recursive: true });
    fs.writeFileSync(path.join(apiDir, 'unavailable.json'), `${JSON.stringify({
        schemaVersion: 1,
        available: false,
        status: 'unavailable',
        mode: 'static_continuity',
        message: 'This optional live service is unavailable on the emergency static copy.'
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(baseDir, '_redirects'), redirects);
    fs.writeFileSync(path.join(baseDir, '_headers'), headers);

    const manifest = {
        schemaVersion: 1,
        mode: 'static_continuity',
        purpose: 'Keep the public story and browser game reachable during a primary-host outage.',
        capabilities: {
            website: 'available',
            browserGame: 'available',
            savedProgress: 'local_or_existing_cloud_path',
            livePresence: 'unavailable',
            adultFeedbackSending: 'unavailable',
            liveSpaceDiscovery: 'saved_fallback_only',
            inGameNASALearning: 'direct_data_with_local_image_fallback',
            generatedCreaturePictures: 'graceful_fallback_only',
            generatedCreatureFilms: 'graceful_fallback_only',
            websiteAnalytics: 'disabled'
        },
        requiredHumanActions: [
            'Approve a secondary hosting provider and its current terms.',
            'Create the hosting project.',
            'Approve any domain or DNS change.',
            'Run the live verification before sharing the address.'
        ],
        externalActionTaken: false,
        deploymentAuthorized: false,
        customDomainChangeAuthorized: false
    };
    fs.writeFileSync(path.join(baseDir, 'hosting-continuity.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
}

if (require.main === module) {
    const manifest = buildContinuityPackage();
    process.stdout.write(`${JSON.stringify({
        outputDir,
        mode: manifest.mode,
        externalActionTaken: manifest.externalActionTaken
    }, null, 2)}\n`);
}

module.exports = {
    buildContinuityPackage,
    headers,
    redirects,
    routeCopies
};
