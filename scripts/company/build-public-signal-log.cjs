#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { isWithdrawnPublicVisual, readVisualPublicationRegister } = require('./visual-publication-policy.cjs');

const root = path.resolve(__dirname, '../..');
const defaultDataPath = path.join(root, 'public/updates/releases.json');
const defaultOutputPath = path.join(root, 'public/updates/index.html');
const siteOrigin = 'https://mythicalvoid.com';

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function displayDate(value) {
    return new Intl.DateTimeFormat('en-IE', {
        day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC'
    }).format(new Date(`${value}T00:00:00Z`)).toUpperCase();
}

function releasePath(entry) {
    return `/updates/${entry.id.toLowerCase()}/`;
}

function releaseUrl(entry) {
    return `${siteOrigin}${releasePath(entry)}`;
}

function visualMarkup(entry, index, register) {
    if (entry.image && !isWithdrawnPublicVisual(entry.image, register)) {
        return `<figure class="signal-entry-image">
                    <img src="${escapeHtml(entry.image)}" alt="${escapeHtml(entry.imageAlt)}" loading="${index === 0 ? 'eager' : 'lazy'}">
                    <figcaption>${escapeHtml(entry.disclosure)}</figcaption>
                </figure>`;
    }
    if (entry.visualKind === 'space_discovery') {
        return `<figure class="signal-entry-space-visual" role="img" aria-label="${escapeHtml(entry.visualAlt)}">
                    <div class="signal-entry-space-orbits" aria-hidden="true"><i></i><i></i><i></i><span></span><span></span><span></span></div>
                    <strong>REAL SPACE</strong>
                    <em>→</em>
                    <strong>IMPOSSIBLE LIFE</strong>
                    <figcaption>${escapeHtml(entry.disclosure)}</figcaption>
                </figure>`;
    }
    if (entry.visualKind === 'text_only_release') {
        return `<div class="signal-entry-no-media signal-entry-text-only" role="img" aria-label="${escapeHtml(entry.visualAlt)}">
                    <span>LIVE GAME UPDATE</span>
                    <small>${escapeHtml(entry.disclosure)}</small>
                </div>`;
    }
    return '<div class="signal-entry-no-media"><span>VISUAL WITHHELD</span><small>Awaiting a stronger human-reviewed moment.</small></div>';
}

function buildReleasePage(data, entry) {
    const register = readVisualPublicationRegister();
    const canonicalUrl = releaseUrl(entry);
    const socialImage = `${siteOrigin}/marketing/mythical-void-brand-link-card-v1.png`;
    const shareTitle = `Mythical Void update: ${entry.title}`;
    const shareText = `${entry.title}. ${entry.summary} Read what changed in Mythical Void, then play free in your browser.`;
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: entry.title,
        description: entry.summary,
        datePublished: entry.publishedOn,
        dateModified: entry.publishedOn,
        mainEntityOfPage: canonicalUrl,
        author: { '@type': 'Organization', name: 'Mythical Void', url: `${siteOrigin}/studio/` },
        publisher: {
            '@type': 'Organization',
            name: 'Mythical Void',
            url: `${siteOrigin}/`,
            logo: { '@type': 'ImageObject', url: `${siteOrigin}/marketing/mythical-void-mark-192.png` }
        },
        about: { '@type': 'VideoGame', name: 'Mythical Void', url: `${siteOrigin}/play/` },
        isPartOf: { '@type': 'CollectionPage', name: data.page.title, url: data.page.canonicalUrl },
        image: socialImage
    };

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(entry.summary)}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta name="theme-color" content="#090711">
    <meta property="og:title" content="${escapeHtml(entry.title)} | Mythical Void">
    <meta property="og:description" content="${escapeHtml(entry.summary)}">
    <meta property="og:image" content="${socialImage}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Mythical Void emblem and the words Play free in your browser. Brand art, not gameplay.">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Mythical Void">
    <meta property="article:published_time" content="${entry.publishedOn}T12:00:00.000Z">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(entry.title)} | Mythical Void">
    <meta name="twitter:description" content="${escapeHtml(entry.summary)}">
    <meta name="twitter:image" content="${socialImage}">
    <meta name="twitter:image:alt" content="Mythical Void emblem and the words Play free in your browser. Brand art, not gameplay.">
    <link rel="canonical" href="${canonicalUrl}">
    <link rel="describedby" type="text/markdown" href="${siteOrigin}/llms.txt">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="alternate" type="application/rss+xml" title="Mythical Void — The Latest News" href="${siteOrigin}/updates/feed.xml">
    <link rel="alternate" type="application/feed+json" title="Mythical Void — The Latest News" href="${siteOrigin}/updates/feed.json">
    <link rel="icon" type="image/png" sizes="32x32" href="/marketing/mythical-void-mark-32.png">
    <link rel="stylesheet" href="/discovery.css">
    <title>${escapeHtml(entry.title)} | Mythical Void Update</title>
    <script type="application/ld+json">${JSON.stringify(structuredData, null, 2).replaceAll('<', '\\u003c')}</script>
</head>
<body class="updates-page release-page">
    <a class="skip-link" href="#main">Skip to what changed</a>
    <header class="site-header"><div class="header-inner"><a class="brand" href="/" aria-label="Mythical Void home"><img src="/marketing/mythical-void-emblem-v3.png" alt=""><span>MYTHICAL VOID</span></a><nav class="site-nav" aria-label="Main navigation"><a href="/updates/">Latest news</a><a href="/story/">The story</a><a href="/parents/">For grown-ups</a><a class="button button-primary" href="/play/">Play now →</a></nav></div></header>
    <main id="main">
        <section class="release-article-hero"><div class="section-inner">
            <a class="release-back" href="/updates/">← All game updates</a>
            <p class="kicker">${escapeHtml(entry.category)}</p>
            <h1>${escapeHtml(entry.title)}</h1>
            <p class="hero-copy">${escapeHtml(entry.summary)}</p>
            <div class="release-meta"><time datetime="${escapeHtml(entry.publishedOn)}">${escapeHtml(displayDate(entry.publishedOn))}</time><span>LIVE IN EARLY ACCESS</span></div>
            <div class="hero-actions"><a class="button button-primary" href="${escapeHtml(entry.destination)}"${entry.download ? ' download' : ''}>${escapeHtml(entry.linkText)} →</a><a class="button button-quiet" href="/updates/">Read every update</a></div>
        </div></section>
        <section class="content-section release-detail-section"><div class="section-inner release-detail-grid">
            <div class="release-detail-visual">${visualMarkup(entry, 0, register)}</div>
            <article class="release-detail-copy">
                <p class="kicker">WHAT CHANGED</p>
                <ul>${entry.details.map(detail => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>
                <aside class="release-evidence-note"><strong>ABOUT THIS UPDATE</strong><p>${escapeHtml(entry.disclosure)}</p><p>This page records something that is already available. It does not invent player numbers, reviews or promises about what comes next.</p></aside>
            </article>
        </div></section>
        <section class="content-section alt playable-share-section" aria-labelledby="share-update-title" data-share-section data-share-card data-share-url="${canonicalUrl}" data-share-title="${escapeHtml(shareTitle)}" data-share-text="${escapeHtml(shareText)}" data-share-success="Thanks for sharing this update.">
            <div class="section-inner playable-share-card">
                <div><p class="kicker">PASS THE UPDATE ON</p><h2 id="share-update-title">Know someone who would care about this change?</h2><p>Send them this permanent update page. The address contains no tracking code, and Mythical Void never asks who receives it.</p></div>
                <div class="playable-share-actions"><button class="button button-primary" type="button" data-share-game data-copy-label="Copy update link"><span data-share-label>Share this update</span> →</button><button class="button button-quiet" type="button" data-copy-game>Copy update link</button><p class="playable-share-status" data-share-status role="status" aria-live="polite"></p></div>
            </div>
        </section>
        <section class="final-cta"><div class="section-inner"><p class="kicker">TRY THE CURRENT BUILD</p><h2>See the change inside the game.</h2><p>Mythical Void is free to start in a modern browser. No download or account is needed.</p><div class="hero-actions"><a class="button button-primary" href="/play/">Play Mythical Void →</a><a class="button button-quiet" href="/playable-now/">Is this your kind of game?</a></div></div></section>
    </main>
    <footer class="site-footer"><div class="footer-inner"><a class="brand" href="/"><img src="/marketing/mythical-void-emblem-v3.png" alt=""><span>MYTHICAL VOID</span></a><nav class="footer-links" aria-label="Footer navigation"><a href="/updates/">What's new</a><a href="/story/">The story</a><a href="/creature-genetics/">Creature genetics</a><a href="/nasa-space-science/">NASA & STEM</a><a href="/parents/">For grown-ups</a><a href="/privacy/">Privacy & safety</a></nav><small>© 2026 Mythical Void. Made in Ireland for curious minds everywhere.</small></div></footer>
    <script src="/pwa-install.js?v=20260827-installable-game"></script>
    <script src="/discovery.js?v=20260906-plain-language"></script>
</body>
</html>
`;
}

function buildUpdatesSitemap(data) {
    const entries = (data.entries || []).filter(entry => entry.status === 'live');
    const urls = entries.map(entry => `  <url>
    <loc>${releaseUrl(entry)}</loc>
    <lastmod>${entry.publishedOn}</lastmod>
  </url>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function buildSignalLog(data) {
    const register = readVisualPublicationRegister();
    const entries = (data.entries || []).filter(entry => entry.status === 'live');
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: data.page.title,
        url: data.page.canonicalUrl,
        description: data.page.description,
        isPartOf: { '@type': 'WebSite', name: 'Mythical Void', url: 'https://mythicalvoid.com/' },
        about: { '@type': 'VideoGame', name: 'Mythical Void', url: 'https://mythicalvoid.com/play/' },
        hasPart: entries.map(entry => ({
            '@type': 'Article',
            headline: entry.title,
            datePublished: entry.publishedOn,
            url: releaseUrl(entry),
            ...(entry.image && !isWithdrawnPublicVisual(entry.image, register) ? { image: `https://mythicalvoid.com${entry.image}` } : {}),
            description: entry.summary
        }))
    };
    const cards = entries.map((entry, index) => {
        return `
            <article class="signal-entry${index === 0 ? ' signal-entry-latest' : ''}" id="${escapeHtml(entry.id.toLowerCase())}">
                ${visualMarkup(entry, index, register)}
                <div class="signal-entry-copy">
                    <div class="signal-entry-meta"><span>${escapeHtml(entry.category)}</span><time datetime="${escapeHtml(entry.publishedOn)}">${escapeHtml(displayDate(entry.publishedOn))}</time></div>
                    <h2><a href="${escapeHtml(releasePath(entry))}">${escapeHtml(entry.title)}</a></h2>
                    <p class="section-lead">${escapeHtml(entry.summary)}</p>
                    <ul>${entry.details.map(detail => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>
                    <a class="text-link" href="${escapeHtml(entry.destination)}"${entry.download ? ' download' : ''}>${escapeHtml(entry.linkText)} →</a>
                </div>
            </article>`;
    }).join('');

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(data.page.description)}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta name="theme-color" content="#090711">
    <meta property="og:title" content="${escapeHtml(data.page.title)}">
    <meta property="og:description" content="${escapeHtml(data.page.introduction)}">
    <meta property="og:image" content="https://mythicalvoid.com/marketing/mythical-void-creature-universe-hero-v2.webp">
    <meta property="og:image:type" content="image/webp">
    <meta property="og:image:width" content="1672">
    <meta property="og:image:height" content="941">
    <meta property="og:image:alt" content="An imagined luminous universe filled with many possible alien creature forms">
    <meta property="og:url" content="${escapeHtml(data.page.canonicalUrl)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Mythical Void">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(data.page.title)}">
    <meta name="twitter:description" content="Real Mythical Void releases, useful new resources and honest notes about what changed.">
    <meta name="twitter:image" content="https://mythicalvoid.com/marketing/mythical-void-creature-universe-hero-v2.webp">
    <meta name="twitter:image:alt" content="An imagined luminous universe filled with many possible alien creature forms">
    <link rel="canonical" href="${escapeHtml(data.page.canonicalUrl)}">
    <link rel="describedby" type="text/markdown" href="https://mythicalvoid.com/llms.txt">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="alternate" type="application/rss+xml" title="Mythical Void — The Latest News" href="https://mythicalvoid.com/updates/feed.xml">
    <link rel="alternate" type="application/feed+json" title="Mythical Void — The Latest News" href="https://mythicalvoid.com/updates/feed.json">
    <link rel="icon" type="image/png" sizes="32x32" href="/marketing/mythical-void-mark-32.png">
    <link rel="stylesheet" href="/discovery.css">
    <title>${escapeHtml(data.page.title)}</title>
    <script type="application/ld+json">${JSON.stringify(structuredData, null, 2).replaceAll('<', '\\u003c')}</script>
</head>
<body class="updates-page">
    <a class="skip-link" href="#main">Skip to the latest updates</a>
    <header class="site-header"><div class="header-inner"><a class="brand" href="/" aria-label="Mythical Void home"><img src="/marketing/mythical-void-emblem-v3.png" alt=""><span>MYTHICAL VOID</span></a><nav class="site-nav" aria-label="Main navigation"><a href="/story/">The story</a><a href="/creature-genetics/">Creatures</a><a href="/studio/">The studio</a><a class="button button-primary" href="/play/">Play now →</a></nav></div></header>
    <main id="main">
        <section class="hero updates-hero"><div class="section-inner hero-grid"><div><p class="kicker">FROM THE STUDIO // LATEST NEWS</p><h1>${escapeHtml(data.page.heading)}</h1><p class="hero-copy">${escapeHtml(data.page.introduction)}</p><div class="hero-actions"><a class="button button-primary" href="#latest">See the latest update →</a><a class="button button-quiet" href="/play/">Play the current game</a><a class="button button-quiet" href="/updates/feed.xml">Follow the news</a></div></div><figure class="hero-visual"><img src="/marketing/mythical-void-creature-universe-hero-v2.webp" alt="Many imagined alien organisms gathered in a luminous Mythical Void realm"><figcaption><strong>IMAGINED UNIVERSE ART.</strong> AI-generated marketing artwork inspired by the creature system. It is not gameplay.</figcaption></figure></div></section>
        <section class="truth-strip" aria-label="How the Latest News works"><div class="section-inner truth-grid"><div><span>${entries.length} live notes</span><small>Only changes with a working public destination.</small></div><div><span>Plain words</span><small>Made to be understood without technical knowledge.</small></div><div><span>Clear labels</span><small>Gameplay and generated artwork stay visibly separate.</small></div><div><span>Free to play</span><small>No download or account is needed to begin.</small></div></div></section>
        <section class="content-section signal-log-section" id="latest"><div class="section-inner"><div class="story-section-heading"><p class="kicker">LATEST UPDATES</p><h2>Newly live.</h2><p>Each note links to the thing that changed, so you can see it for yourself.</p></div><div class="signal-timeline">${cards}
        </div></div></section>
        <section class="content-section alt"><div class="section-inner split"><div><p class="kicker">WHY THIS LOG EXISTS</p><h2>Progress you can check.</h2></div><div><p class="section-lead">The Latest News is the public source for meaningful Mythical Void releases.</p><p>It can include game improvements, new story pages, family and STEM resources, public artwork, and important changes to how the studio works.</p><p class="source-note"><strong>Follow without an account:</strong> add the <a class="text-link" href="/updates/feed.xml">RSS feed</a> to a feed reader. The <a class="text-link" href="/updates/feed.json">JSON feed</a> gives future studio tools the same checked source.</p><p class="source-note"><strong>It will not include:</strong> vague future promises, invented customer praise, private information, follower counts treated as players, or generated artwork described as gameplay.</p></div></div></section>
        <section class="final-cta"><div class="section-inner"><p class="kicker">THE CURRENT BUILD IS WAITING</p><h2>Read what changed. Then enter the Void.</h2><p>The browser game is free to start, with no download or account needed.</p><div class="hero-actions"><a class="button button-primary" href="/play/">Play Mythical Void →</a><a class="button button-quiet" href="/story/">Follow Project Beacon</a></div></div></section>
    </main>
    <footer class="site-footer"><div class="footer-inner"><a class="brand" href="/"><img src="/marketing/mythical-void-emblem-v3.png" alt=""><span>MYTHICAL VOID</span></a><nav class="footer-links" aria-label="Footer navigation"><a href="/updates/">What's new</a><a href="/story/">The story</a><a href="/creature-genetics/">Creature genetics</a><a href="/educators/">For groups & educators</a><a href="/nasa-space-science/">NASA & STEM</a><a href="/parents/">For grown-ups</a><a href="/press/">Press & creators</a><a href="/privacy/">Privacy & safety</a></nav><small>© 2026 Mythical Void. Made in Ireland for curious minds everywhere.</small></div></footer>
    <script src="/pwa-install.js?v=20260827-installable-game"></script>
    <script src="/discovery.js?v=20260906-plain-language"></script>
</body>
</html>
`;
}

if (require.main === module) {
    const dataPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultDataPath;
    const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : defaultOutputPath;
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buildSignalLog(data));
    const outputDir = path.dirname(outputPath);
    const liveEntries = (data.entries || []).filter(entry => entry.status === 'live');
    for (const name of fs.readdirSync(outputDir)) {
        if (/^update-\d{3}$/.test(name)) fs.rmSync(path.join(outputDir, name), { recursive: true, force: true });
    }
    for (const entry of liveEntries) {
        const entryDir = path.join(outputDir, entry.id.toLowerCase());
        fs.mkdirSync(entryDir, { recursive: true });
        fs.writeFileSync(path.join(entryDir, 'index.html'), buildReleasePage(data, entry));
    }
    fs.writeFileSync(path.join(outputDir, 'sitemap.xml'), buildUpdatesSitemap(data));
    console.log(`Built ${outputPath}, ${liveEntries.length} release pages and the updates sitemap.`);
}

module.exports = {
    buildReleasePage,
    buildSignalLog,
    buildUpdatesSitemap,
    defaultDataPath,
    defaultOutputPath,
    releasePath,
    releaseUrl,
    visualMarkup
};
