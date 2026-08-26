#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '../..');
const manifestPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(repositoryRoot, 'public/press/mythical-void-social-previews.json');
const siteRoot = process.argv[3] ? path.resolve(process.argv[3]) : repositoryRoot;
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function metaContent(html, attribute, key) {
    const expression = new RegExp(`<meta\\s+[^>]*${attribute}=["']${escapeRegExp(key)}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i');
    return html.match(expression)?.[1] || null;
}

function canonicalHref(html) {
    return html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] || null;
}

function imageDimensions(file, type) {
    const bytes = fs.readFileSync(file);
    if (type === 'image/png') {
        if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
        return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }
    if (type === 'image/webp') {
        if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') return null;
        const format = bytes.subarray(12, 16).toString('ascii');
        if (format === 'VP8 ') return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
        if (format === 'VP8X') return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
        return null;
    }
    return null;
}

requireValue(manifest.schemaVersion === 2 && manifest.state === 'human_reviewed_preview_fallback_while_gameplay_media_is_rebuilt', 'Social preview manifest identity or state is invalid.');
requireValue(Array.isArray(manifest.pages) && manifest.pages.length === 10, 'Social preview manifest must cover exactly ten static public pages.');
requireValue(new Set((manifest.pages || []).map(page => page.route)).size === manifest.pages?.length, 'Social preview routes must be unique.');

for (const page of manifest.pages || []) {
    const label = page.route || 'unknown route';
    const htmlFile = path.join(siteRoot, page.htmlPath || '');
    const imageFile = path.join(siteRoot, page.imagePath || '');
    requireValue(fs.existsSync(htmlFile), `${label} HTML file is missing.`);
    requireValue(fs.existsSync(imageFile), `${label} preview image is missing.`);
    if (!fs.existsSync(htmlFile) || !fs.existsSync(imageFile)) continue;

    const html = fs.readFileSync(htmlFile, 'utf8');
    const expectedCanonical = `https://mythicalvoid.com${page.route}`;
    const ogTitle = metaContent(html, 'property', 'og:title');
    const ogDescription = metaContent(html, 'property', 'og:description');
    const twitterTitle = metaContent(html, 'name', 'twitter:title');
    const twitterDescription = metaContent(html, 'name', 'twitter:description');
    const previewText = [ogTitle, ogDescription, twitterTitle, twitterDescription].join(' ');

    requireValue(canonicalHref(html) === expectedCanonical, `${label} canonical URL is missing or incorrect.`);
    requireValue(metaContent(html, 'property', 'og:url') === expectedCanonical, `${label} Open Graph URL must match its canonical URL.`);
    requireValue(Boolean(ogTitle && ogDescription && twitterTitle && twitterDescription), `${label} needs complete Open Graph and social-card wording.`);
    requireValue(metaContent(html, 'property', 'og:image') === page.imageUrl, `${label} Open Graph image has drifted from the manifest.`);
    requireValue(metaContent(html, 'property', 'og:image:type') === page.imageType, `${label} Open Graph image type is missing or incorrect.`);
    requireValue(Number(metaContent(html, 'property', 'og:image:width')) === page.width, `${label} Open Graph image width is missing or incorrect.`);
    requireValue(Number(metaContent(html, 'property', 'og:image:height')) === page.height, `${label} Open Graph image height is missing or incorrect.`);
    requireValue(metaContent(html, 'property', 'og:image:alt') === page.alt, `${label} Open Graph image alt text has drifted from the manifest.`);
    requireValue(metaContent(html, 'name', 'twitter:card') === 'summary_large_image', `${label} must request a large social preview card.`);
    requireValue(metaContent(html, 'name', 'twitter:image') === page.imageUrl, `${label} social-card image has drifted from the manifest.`);
    requireValue(metaContent(html, 'name', 'twitter:image:alt') === page.alt, `${label} social-card image needs matching alt text.`);
    requireValue(page.alt?.length >= 35 && page.alt?.length <= 160, `${label} preview alt text must be useful and concise.`);
    requireValue(!/[?&](?:utm_|fbclid|gclid)/i.test(`${expectedCanonical} ${page.imageUrl}`), `${label} preview metadata must not add tracking parameters.`);
    requireValue(!/\bcompanions?\b/i.test(previewText), `${label} preview wording uses retired companion language.`);
    requireValue(!/no two creatures|every creature is unique|infinite unique/i.test(previewText), `${label} preview wording contains an unsupported uniqueness promise.`);
    requireValue(!/\b\d[\d,.]*\s+(?:players|customers|downloads|followers|visits)\b/i.test(previewText), `${label} preview wording contains an unverified audience metric.`);

    const dimensions = imageDimensions(imageFile, page.imageType);
    requireValue(Boolean(dimensions), `${label} preview image format does not match its declared type.`);
    requireValue(dimensions?.width === page.width && dimensions?.height === page.height, `${label} preview image dimensions do not match the real file.`);
    requireValue(fs.statSync(imageFile).size > 10_000, `${label} preview image is unexpectedly small.`);

    if (page.classification === 'ai_generated_marketing_illustration' || page.classification === 'ai_generated_marketing_illustration_not_gameplay') {
        requireValue(/not gameplay/i.test(page.disclosure || ''), `${label} generated artwork must be disclosed as not gameplay.`);
    }
    if ((page.classification || '').startsWith('branded_social_artwork_with_authentic_gameplay_frame')) {
        requireValue(/not a raw screenshot/i.test(page.disclosure || '') && /real gameplay/i.test(page.disclosure || '') && /no player information/i.test(page.disclosure || ''), `${label} branded artwork must retain its gameplay and privacy disclosure.`);
    }
    if (page.classification === 'branded_renderer_proof_layout_with_authentic_game_sprite_exports') {
        requireValue(/not a playable scene/i.test(page.disclosure || '') && /exact export/i.test(page.disclosure || '') && /running game renderer/i.test(page.disclosure || ''), `${label} renderer proof must retain its non-gameplay and authentic-export disclosure.`);
    }
    if (page.classification === 'branded_founder_story_artwork_with_ai_marketing_background_and_authentic_gameplay_frame') {
        requireValue(/not a raw screenshot/i.test(page.disclosure || '') && /not gameplay/i.test(page.disclosure || '') && /real gameplay/i.test(page.disclosure || '') && /no player information/i.test(page.disclosure || '') && /identifying detail of the child/i.test(page.disclosure || ''), `${label} founder-story artwork must retain its generated-art, real-gameplay, privacy and child-identity boundaries.`);
    }
    if (/nasa/i.test(page.classification || '')) {
        requireValue(/NASA does not endorse Mythical Void/i.test(page.disclosure || ''), `${label} NASA preview must retain its non-endorsement boundary.`);
    }
}

const pressLimitation = manifest.knownLimitations?.find(item => item.route === '/press/');
requireValue(Boolean(pressLimitation) && /inherits the homepage's static link-preview metadata/i.test(pressLimitation.currentState || '') && /Do not claim/i.test(pressLimitation.boundary || ''), 'The application-rendered press-room preview limitation must remain explicit.');
requireValue(manifest.authority?.publishingToOwnedWebsiteAuthorized === true && manifest.authority?.autonomousSocialPostingAuthorized === false && manifest.authority?.trackingParametersPermitted === false && manifest.authority?.externalActionPerformed === false, 'Social preview metadata may be published to the owned site without authorizing social posting, tracking links or other external action.');

if (errors.length) {
    console.error(`Social preview metadata validation failed (${errors.length}):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Social preview metadata valid: ${manifest.pages.length} route-specific pages, checked image files, accessible preview text, no posting authority.`);
