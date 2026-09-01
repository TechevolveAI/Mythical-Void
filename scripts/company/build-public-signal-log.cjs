#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { isWithdrawnPublicVisual, readVisualPublicationRegister } = require('./visual-publication-policy.cjs');

const root = path.resolve(__dirname, '../..');
const defaultDataPath = path.join(root, 'public/updates/releases.json');
const defaultOutputPath = path.join(root, 'public/updates/index.html');

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
    return '<div class="signal-entry-no-media"><span>VISUAL WITHHELD</span><small>Awaiting a stronger human-reviewed moment.</small></div>';
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
            url: `https://mythicalvoid.com/updates/#${entry.id.toLowerCase()}`,
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
                    <h2>${escapeHtml(entry.title)}</h2>
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
    <script src="/discovery.js"></script>
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
    const count = (data.entries || []).filter(entry => entry.status === 'live').length;
    console.log(`Built ${outputPath} from ${count} live Latest News entries.`);
}

module.exports = { buildSignalLog, defaultDataPath, defaultOutputPath, visualMarkup };
