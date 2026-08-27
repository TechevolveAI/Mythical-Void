#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '../..');
const fieldGuideSourcePath = path.join(repositoryRoot, 'src/data/creature-field-guide.json');
const profileSourcePath = path.join(repositoryRoot, 'public/press/gameplay/real-creature-showcase/source-profiles.json');
const outputDirectory = path.join(repositoryRoot, 'public/creature-field-guide');

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function displayWords(value) {
    return String(value || '')
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function profileSummary(profile) {
    const mutations = profile.mutations.map(item => displayWords(item.type));
    const specialFeatures = profile.specialFeatures.map(item => displayWords(item.type));
    return {
        id: profile.id,
        species: profile.species,
        speciesLabel: profile.speciesLabel,
        rarity: profile.rarity,
        geneBody: profile.geneBody,
        body: profile.body,
        head: profile.head,
        aura: profile.aura,
        personality: profile.personality,
        affinity: profile.affinity,
        mutations: profile.mutations,
        specialFeatures: profile.specialFeatures,
        shiny: profile.shiny,
        shinyType: profile.shinyType,
        colors: profile.colors,
        image: `/press/gameplay/real-creature-showcase/${profile.id.toLowerCase()}-real-render.png`,
        readableTraits: [
            displayWords(profile.rarity),
            `${displayWords(profile.personality)} nature`,
            `${displayWords(profile.affinity)} affinity`,
            `${displayWords(profile.body)} form`,
            ...mutations,
            ...specialFeatures.slice(0, Math.max(0, 2 - mutations.length)),
            ...(profile.shiny ? ['Shiny'] : [])
        ].slice(0, 7)
    };
}

function buildFieldGuideData(fieldGuideSource, profileManifest) {
    const profileById = new Map(profileManifest.profiles.map(profile => [profile.id, profile]));
    return {
        ...fieldGuideSource,
        generatedFrom: {
            fieldGuideSource: 'src/data/creature-field-guide.json',
            rendererProfileSource: 'public/press/gameplay/real-creature-showcase/source-profiles.json',
            rendererState: profileManifest.state,
            candidatesExplored: profileManifest.candidatesExplored,
            profilesSelected: profileManifest.profilesSelected
        },
        realms: fieldGuideSource.realms.map(realm => ({
            ...realm,
            sightings: realm.sightings.map(sighting => {
                const profile = profileById.get(sighting.creatureId);
                if (!profile) throw new Error(`Unknown renderer profile ${sighting.creatureId}`);
                return { ...sighting, profile: profileSummary(profile) };
            })
        }))
    };
}

function renderTraitList(profile) {
    return profile.readableTraits.map(trait => `<li>${escapeHtml(trait)}</li>`).join('');
}

function renderSighting(sighting) {
    const profile = sighting.profile;
    return `
        <article class="field-sighting" style="--creature-colour:${escapeHtml(profile.colors.primary)}">
            <div class="field-sighting-visual">
                <span class="field-sighting-id">${escapeHtml(profile.id)} // VERIFIED PROFILE</span>
                <div class="field-sighting-glyph" aria-hidden="true"><i></i><i></i><i></i><strong>${escapeHtml(sighting.name.slice(0, 1))}</strong></div>
                <small>Visual withheld while the creature capture is rebuilt.</small>
            </div>
            <div class="field-sighting-copy">
                <p class="field-story-label">FIELD-GUIDE STORY</p>
                <h3>${escapeHtml(sighting.name)}</h3>
                <p class="field-species">${escapeHtml(profile.speciesLabel)}</p>
                <ul class="field-traits" aria-label="Verified renderer traits">${renderTraitList(profile)}</ul>
                <p>${escapeHtml(sighting.story)}</p>
                <blockquote><strong>Beacon note:</strong> ${escapeHtml(sighting.beaconNote)}</blockquote>
            </div>
        </article>`;
}

function renderRealm(realm) {
    return `
    <section class="field-realm" id="${escapeHtml(realm.id)}" data-field-realm>
        <div class="section-inner">
            <header class="field-realm-header">
                <div class="field-realm-number">REALM ${escapeHtml(realm.number)}</div>
                <div>
                    <p class="kicker">${escapeHtml(realm.guardian)} // ${escapeHtml(realm.guardianRole)}</p>
                    <h2>${escapeHtml(realm.label)}</h2>
                </div>
            </header>
            <div class="field-realm-context">
                <div class="field-realm-signal" aria-label="Project Beacon realm signal for ${escapeHtml(realm.label)}"><span>REALM ${escapeHtml(realm.number)}</span><strong>${escapeHtml(realm.label)}</strong><small>SIGNAL PARTIALLY RESTORED</small></div>
                <div class="field-realm-truth">
                    <span>WHAT THE GAME TEACHES</span>
                    <p>${escapeHtml(realm.knownGameTruth)}</p>
                    <span>PROJECT BEACON ASKS</span>
                    <p>${escapeHtml(realm.projectBeaconQuestion)}</p>
                </div>
            </div>
            <div class="field-sighting-grid">${realm.sightings.map(renderSighting).join('')}</div>
        </div>
    </section>`;
}

function buildFieldGuideHtml(data) {
    const routeLinks = data.realms.map(realm => `<a href="#${escapeHtml(realm.id)}"><span>${escapeHtml(realm.number)}</span>${escapeHtml(realm.label)}</a>`).join('');
    const structuredData = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Project Beacon Creature Field Guide',
        url: 'https://mythicalvoid.com/creature-field-guide/',
        description: 'Twelve Mythical Void creature profiles placed carefully across the game’s six realms, with verified traits and clearly labelled field-guide stories.',
        isPartOf: { '@type': 'WebSite', name: 'Mythical Void', url: 'https://mythicalvoid.com/' }
    }).replace(/</g, '\\u003c');
    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Meet 12 Mythical Void creature profiles across six realms. Explore verified traits and official field-guide stories connected to Project Beacon.">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta name="theme-color" content="#090711">
    <meta property="og:title" content="Project Beacon Creature Field Guide | Mythical Void">
    <meta property="og:description" content="Twelve creature profiles. Six realms. Official stories that make the living universe easier to enter.">
    <meta property="og:image" content="https://mythicalvoid.com/marketing/mythical-void-creature-universe-hero-v2.webp">
    <meta property="og:image:type" content="image/webp">
    <meta property="og:image:width" content="1672">
    <meta property="og:image:height" content="941">
    <meta property="og:image:alt" content="An imagined luminous universe filled with many possible alien creature forms">
    <meta property="og:url" content="https://mythicalvoid.com/creature-field-guide/">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Mythical Void">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Project Beacon Creature Field Guide | Mythical Void">
    <meta name="twitter:description" content="Meet 12 verified creature profiles across the six realms of Mythical Void.">
    <meta name="twitter:image" content="https://mythicalvoid.com/marketing/mythical-void-creature-universe-hero-v2.webp">
    <meta name="twitter:image:alt" content="An imagined luminous universe filled with many possible alien creature forms">
    <link rel="canonical" href="https://mythicalvoid.com/creature-field-guide/">
    <link rel="describedby" type="text/markdown" href="https://mythicalvoid.com/llms.txt">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="alternate" type="application/rss+xml" title="Mythical Void — The Signal Log" href="https://mythicalvoid.com/updates/feed.xml">
    <link rel="alternate" type="application/feed+json" title="Mythical Void — The Signal Log" href="https://mythicalvoid.com/updates/feed.json">
    <link rel="icon" type="image/png" sizes="32x32" href="/marketing/mythical-void-mark-32.png">
    <link rel="stylesheet" href="/discovery.css">
    <title>Project Beacon Creature Field Guide | Mythical Void</title>
    <script type="application/ld+json">${structuredData}</script>
</head>
<body class="creature-field-guide-page">
    <a class="skip-link" href="#main">Skip to the field guide</a>
    <header class="site-header"><div class="header-inner"><a class="brand" href="/" aria-label="Mythical Void home"><img src="/marketing/mythical-void-emblem-v3.png" alt=""><span>MYTHICAL VOID</span></a><nav class="site-nav" aria-label="Main navigation"><a href="/creature-genetics/">Creature engine</a><a href="/story/">The story</a><a href="/parents/">For grown-ups</a><a class="button button-primary" href="/play/">Play now →</a></nav></div></header>
    <main id="main">
        <section class="hero field-guide-hero"><div class="section-inner hero-grid"><div><p class="kicker">PROJECT BEACON // FIELD RECORD 001</p><h1>The Void remembers every signal.</h1><p class="hero-copy">Twelve creature profiles. Six living realms. One difficult question: what should Project Beacon carry home?</p><div class="hero-actions"><a class="button button-primary" href="#mythical_forest">Enter the field guide →</a><a class="button button-quiet" href="/play/">Play the current game</a></div></div><figure class="hero-visual"><img src="/marketing/mythical-void-creature-universe-hero-v2.webp" alt="Many imagined alien organisms gathered in a luminous Mythical Void realm"><figcaption><strong>IMAGINED UNIVERSE ART.</strong> AI-generated marketing artwork inspired by the creature system. It is not gameplay.</figcaption></figure></div></section>
        <section class="truth-strip" aria-label="Field guide structure"><div class="section-inner truth-grid"><div><span>12</span><small>verified creature profiles</small></div><div><span>6</span><small>realms in the current journey</small></div><div><span>2</span><small>field sightings per realm</small></div><div><span>1</span><small>choice at the living boundary</small></div></div></section>
        <section class="field-boundary"><div class="section-inner"><div class="field-boundary-card"><p class="kicker">WHAT IS FACT — AND WHAT IS STORY?</p><h2>A field guide with its labels left on.</h2><p><strong>From the current game:</strong> the structured creature traits, the six realm names, their guardians, and Project Beacon’s central questions.</p><p><strong>New official universe material:</strong> the names and short stories below. They deepen the world, but do not claim these twelve creatures or events are already playable quests.</p><p><strong>Visual review:</strong> the earlier sprite and realm captures were real but poor at communicating the experience. They are withheld here until better moments are captured.</p></div><nav class="field-route" aria-label="Jump to a realm">${routeLinks}</nav></div></section>
        ${data.realms.map(renderRealm).join('')}
        <section class="content-section field-guide-finale"><div class="section-inner split"><div><p class="kicker">THE FINAL RECORD IS YOURS</p><h2>Observe. Repair. Protect. Then decide what should be known.</h2><p>Project Beacon begins as a way home. Each realm changes the meaning of that mission. By the final boundary, discovery is no longer only about what humanity can learn. It is about what humanity can be trusted to carry.</p></div><div class="field-finale-card"><span>READY TO BEGIN?</span><p>Wanderer-77 is down. The first signal is waiting in the Mythical Forest.</p><a class="button button-primary" href="/play/">Play now — it’s free →</a><a class="field-text-link" href="/story/">Read the main story</a></div></div></section>
    </main>
    <footer class="site-footer"><div class="footer-inner"><a class="brand" href="/"><img src="/marketing/mythical-void-emblem-v3.png" alt=""><span>MYTHICAL VOID</span></a><div class="footer-links"><a href="/play/">Play</a><a href="/story/">Story</a><a href="/creature-genetics/">Creature engine</a><a href="/press/">Press room</a><a href="/updates/">Signal Log</a><a href="/parents/">For grown-ups</a></div><small>Built in Ireland by a father and his nine-year-old son—with imagination, careful AI and a lot of questions.</small></div></footer>
    <script src="/pwa-install.js?v=20260827-installable-game"></script>
</body>
</html>`;
}

function writeOutputs() {
    const fieldGuideSource = JSON.parse(fs.readFileSync(fieldGuideSourcePath, 'utf8'));
    const profileManifest = JSON.parse(fs.readFileSync(profileSourcePath, 'utf8'));
    const data = buildFieldGuideData(fieldGuideSource, profileManifest);
    const html = buildFieldGuideHtml(data);
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(path.join(outputDirectory, 'field-guide.json'), `${JSON.stringify(data, null, 2)}\n`);
    fs.writeFileSync(path.join(outputDirectory, 'index.html'), html);
    return data;
}

if (require.main === module) {
    const data = writeOutputs();
    console.log(`Creature field guide built: ${data.realms.length} realms, ${data.realms.flatMap(realm => realm.sightings).length} verified sightings.`);
}

module.exports = {
    buildFieldGuideData,
    buildFieldGuideHtml,
    displayWords,
    writeOutputs,
    fieldGuideSourcePath,
    profileSourcePath,
    outputDirectory
};
