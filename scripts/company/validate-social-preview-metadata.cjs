#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
    if (type === 'image/jpeg') {
        if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
        let offset = 2;
        while (offset + 8 < bytes.length) {
            if (bytes[offset] !== 0xff) { offset += 1; continue; }
            const marker = bytes[offset + 1];
            if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
            const length = bytes.readUInt16BE(offset + 2);
            if (length < 2 || offset + length + 2 > bytes.length) return null;
            if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
                return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
            }
            offset += length + 2;
        }
        return null;
    }
    return null;
}

requireValue(manifest.schemaVersion === 2 && manifest.state === 'mixed_truthful_previews_while_gameplay_media_is_rebuilt', 'Social preview manifest identity or state is invalid.');
requireValue(Array.isArray(manifest.pages) && manifest.pages.length === 11, 'Social preview manifest must cover exactly eleven static public pages.');
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
    if (page.classification === 'code_authored_brand_card_with_approved_emblem_not_gameplay') {
        const templateFile = path.join(siteRoot, page.sourceTemplate || '');
        const emblemFile = path.join(siteRoot, page.sourceEmblem || '');
        requireValue(label === '/', `${label} brand-card classification is only approved for the main application shell.`);
        requireValue(/brand art.+not gameplay/i.test(page.disclosure || ''), `${label} brand card must retain its not-gameplay disclosure.`);
        requireValue(fs.existsSync(templateFile) && fs.existsSync(emblemFile), `${label} brand-card source or approved emblem is missing.`);
        if (fs.existsSync(templateFile)) {
            const template = fs.readFileSync(templateFile, 'utf8');
            requireValue(template.includes('BRAND ART — NOT GAMEPLAY') && template.includes('../../public/marketing/mythical-void-emblem-v3.png'), `${label} rendered brand-card source has lost its visible boundary or approved emblem.`);
        }
        requireValue(/^[0-9a-f]{64}$/.test(page.sha256 || '') && crypto.createHash('sha256').update(fs.readFileSync(imageFile)).digest('hex') === page.sha256, `${label} brand-card fingerprint does not match the reviewed file.`);
    }
    if (page.classification === 'ai_assisted_code_authored_brand_art_not_gameplay') {
        const templateFile = path.join(siteRoot, page.sourceTemplate || '');
        const emblemFile = path.join(siteRoot, page.sourceEmblem || '');
        requireValue(label === '/hatch-challenge/', `${label} Hatch Challenge brand-art classification is only approved for its dedicated page.`);
        requireValue(/AI-assisted code-authored brand artwork/i.test(page.disclosure || '') && /not gameplay/i.test(page.disclosure || ''), `${label} Hatch Challenge card must retain its creation and not-gameplay disclosure.`);
        requireValue(page.imageModelUsed === false && page.playerOrCreatureDataUsed === false, `${label} Hatch Challenge preview provenance drifted.`);
        requireValue(fs.existsSync(templateFile) && fs.existsSync(emblemFile), `${label} Hatch Challenge card source or approved emblem is missing.`);
        if (fs.existsSync(templateFile)) {
            const template = fs.readFileSync(templateFile, 'utf8');
            requireValue(template.includes('BRAND ART · NOT GAMEPLAY') && template.includes('/marketing/mythical-void-emblem-v3.png'), `${label} Hatch Challenge card source lost its visible boundary or approved emblem.`);
        }
        requireValue(/^[0-9a-f]{64}$/.test(page.sha256 || '') && crypto.createHash('sha256').update(fs.readFileSync(imageFile)).digest('hex') === page.sha256, `${label} Hatch Challenge card fingerprint does not match the reviewed file.`);
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
