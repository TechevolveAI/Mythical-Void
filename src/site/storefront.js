import './storefront.css';
import { mountAnalyticsConsent } from './analytics-consent.js';

const showcaseScenes = [
    { name: 'Shared Habitat', image: '/game/village/shared-habitat.webp', detail: 'The Fend', mission: 'Build a home' },
    { name: 'Village Heart', image: '/game/village/village-heart-command.webp', detail: 'The Fend', mission: 'Restore together' },
    { name: 'Discovery Workshop', image: '/game/village/discovery-workshop.webp', detail: 'Field systems', mission: 'Learn by doing' },
    { name: 'Crystal Guardian', image: '/game/guardians/crystal-guardian.webp', detail: 'Lost guardian', mission: 'Restore, don’t destroy' },
    { name: 'Elder Treant', image: '/game/guardians/elder-treant.webp', detail: 'Lost guardian', mission: 'Listen first' },
    { name: 'Void Empress', image: '/game/guardians/void-empress.webp', detail: 'The Final Void', mission: 'Choose what matters' }
];

const faqs = [
    ['How do I start playing?', 'Choose any Play Now button. The game opens here in your browser. You do not need to download anything or create an account.'],
        ['Will my progress be saved?', 'Yes. Your progress stays in this browser. An optional private online copy can protect it, but this early version does not yet move progress to another device.'],
    ['What can I play on?', 'You can play in a current desktop or mobile browser. A keyboard is recommended for the platforming parts of the adventure.'],
    ['Is it really free?', 'Yes. The current early-access game is free. It does not ask for payment details.'],
    ['How does NASA fit into the game?', 'Some parts of the adventure can show NASA’s public space pictures and space-weather information. They are optional learning moments that help players notice how the real universe connects to the story.'],
    ['Is it suitable for younger players?', 'The adventure is made for families. It includes fantasy battles, but no gore or adult themes. Parents and guardians can read the safety notes below.'],
    ['Do I need an account?', 'No. You can hatch your first creature without sharing a name or email address.']
];

const app = document.querySelector('#app');
const pagePath = window.location.pathname.replace(/\/+$/, '') || '/';
const siteOrigin = 'https://mythicalvoid.com';

function updatePageMetadata({ title, description, path = '/' }) {
    const absoluteUrl = `${siteOrigin}${path}`;
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', absoluteUrl);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', description);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', absoluteUrl);
}

const playLink = (label, className = 'button button-primary') => `
    <a class="${className}" href="/play/" data-play-link>
        <span data-play-label>${label}</span>
        <span class="button-arrow" aria-hidden="true">→</span>
    </a>
`;

const brandMark = () => `
    <img class="brand-mark" src="/marketing/mythical-void-emblem-v3.png" alt="" width="38" height="58">
`;

function renderPressPage() {
    updatePageMetadata({
        title: 'Press & Creator Room | Mythical Void',
        description: 'Official Mythical Void facts, founder story, playable game link, approved artwork and clear media disclosures.',
        path: '/press/'
    });

    app.innerHTML = `
        <header class="press-header">
            <div class="header-inner">
                <a class="brand" href="/" aria-label="Return to Mythical Void home">
                    ${brandMark()}
                    <span>MYTHICAL VOID</span>
                </a>
                <div class="press-header-actions">
                    <a href="/">Main website</a>
                    <a href="/playable-now/">Game at a glance</a>
                    <a href="/updates/feed.xml">Signal feed</a>
                    ${playLink('Play now', 'button button-small')}
                </div>
            </div>
        </header>

        <main class="press-page">
            <section class="press-hero">
                <img src="/marketing/mythical-void-creature-universe-hero-v2.webp" alt="A wide marketing illustration showing many possible alien creatures in the Mythical Void universe">
                <div class="press-hero-shade" aria-hidden="true"></div>
                <div class="section-inner press-hero-copy">
                    <p class="kicker">OFFICIAL PRESS & CREATOR ROOM</p>
                    <h1>A small Irish studio.<br><em>A universe of creatures.</em></h1>
                    <p>Everything needed to understand, describe and share Mythical Void—without guessing what is gameplay, what is marketing art, or what the game promises.</p>
                    <div class="press-hero-actions">
                        ${playLink('Play the current game')}
                        <a class="button button-quiet" href="/press/mythical-void-fact-sheet.txt" download>Download the fact sheet</a>
                        <a class="button button-quiet" href="/resources/mythical-void-stem-creature-lab.pdf" download>Download the STEM activity</a>
                    </div>
                    <p class="press-art-disclosure">Hero image: AI-generated marketing illustration inspired by creature profiles from the genetics engine. It is not gameplay footage.</p>
                </div>
            </section>

            <section class="press-facts-section">
                <div class="section-inner">
                    <div class="press-section-heading">
                        <p class="kicker">THE SHORT VERSION</p>
                        <h2>What is Mythical Void?</h2>
                    </div>
                    <div class="press-fact-grid">
                        <article><span>GAME</span><strong>Mythical Void</strong><p>A science-fantasy creature adventure built to play in a browser.</p></article>
                        <article><span>PLAY</span><strong>Free early access</strong><p>No download or account is required to start the current release.</p></article>
                        <article><span>JOURNEY</span><strong>Six living realms</strong><p>Explore, fight the corruption, restore guardians and shape Project Beacon.</p></article>
                        <article><span>CREATURES</span><strong>Procedural genetics</strong><p>Appearance, affinity, personality and potential emerge from a varied genetics system.</p></article>
                        <article><span>STUDIO</span><strong>Independent · Ireland</strong><p>A father-and-son experiment growing into an AI-first, human-governed game studio.</p></article>
                        <article><span>DISCOVERY</span><strong>Optional NASA data</strong><p>Selected public space data can appear in optional learning moments. NASA does not endorse the game.</p></article>
                    </div>
                </div>
            </section>

            <section class="press-origin-section">
                <div class="section-inner press-origin-grid">
                    <div class="press-origin-mark">
                        <img src="/marketing/mythical-void-emblem-v3.png" alt="The purple and gold Mythical Void creature emblem">
                        <span>IMAGINATION FIRST</span>
                    </div>
                    <div class="press-origin-copy">
                        <p class="kicker">THE BEGINNING</p>
                        <h2>A father, his nine-year-old son and one enormous idea.</h2>
                        <p>Mythical Void began at home with Kevin and his nine-year-old son exploring what generative AI tools and a lot of imagination could make possible.</p>
                        <p>Their conversations became strange creatures, living worlds and playable moments. AI helps the small team explore and build; people remain responsible for the story, safety and important choices.</p>
                        <blockquote>“What if we could build the game we imagined together?”</blockquote>
                    </div>
                </div>
            </section>

            <section class="press-gameplay-section" id="media-quality-review">
                <div class="section-inner press-review-layout">
                    <div class="press-section-heading press-heading-split">
                        <div><p class="kicker">HUMAN VISUAL REVIEW</p><h2>The public media library is being rebuilt.</h2></div>
                        <p>Earlier screenshots and videos were genuine captures, but that was not enough. The selected moments were unclear, the creature was sometimes unreadable, and several layouts did not look good at normal viewing size. They are no longer offered here as press or creator material.</p>
                    </div>
                    <div class="press-review-standard" aria-label="Visual publishing standard">
                        <article><span>01</span><strong>One clear moment</strong><p>A person should understand what is happening without reading a paragraph first.</p></article>
                        <article><span>02</span><strong>The creature must be visible</strong><p>No missing render, placeholder block, tiny silhouette or frame where the creature disappears.</p></article>
                        <article><span>03</span><strong>Show real play</strong><p>Movement, choice, discovery or consequence—not a menu presented as if it were exciting gameplay.</p></article>
                        <article><span>04</span><strong>Choose the frame by eye</strong><p>Clean composition, readable text, good contrast and a focal point that still works on a phone.</p></article>
                        <article><span>05</span><strong>Watch the whole thing</strong><p>A named adult reviews every frame of every public video before it can be downloaded or shared.</p></article>
                    </div>
                    <div class="press-review-decision">
                        <div><p class="kicker">CURRENT DECISION</p><h3>No gameplay download pack is approved.</h3><p>New material will appear only after the running game can produce a genuinely strong moment and that exact capture passes human review on desktop and phone.</p></div>
                        <a class="button button-primary" href="/play/">See the current game for yourself →</a>
                    </div>
                    <p class="press-gameplay-proof"><a href="/press/visual-publication-register.json">View the visual review register →</a><a href="/press/gameplay/manifest.json">View the capture record →</a></p>
                </div>
            </section>

            <section class="press-assets-section">
                <div class="section-inner press-brand-download">
                    <div class="press-section-heading">
                        <p class="kicker">BRAND FILE</p>
                        <h2>One useful download while the image library is reviewed.</h2>
                        <p>The transparent Mythical Void emblem remains available for factual coverage. Gameplay screenshots, videos and promotional scene artwork are deliberately withheld for now.</p>
                    </div>
                    <figure class="press-asset-card press-logo-asset">
                        <div><img src="/marketing/mythical-void-emblem-v3.png" alt="Transparent Mythical Void creature emblem"></div>
                        <figcaption><span>OFFICIAL BRAND ART</span><strong>Mythical Void emblem</strong><p>Transparent purple-and-gold emblem created with generative AI and professionally refined for the studio.</p><a href="/marketing/mythical-void-emblem-v3.png" download>Download transparent PNG ↓</a></figcaption>
                    </figure>
                </div>
            </section>

            <section class="press-language-section">
                <div class="section-inner press-language-grid">
                    <div>
                        <p class="kicker">DESCRIBE IT ACCURATELY</p>
                        <h2>Useful language</h2>
                        <p class="press-boilerplate">Mythical Void is a free early-access browser adventure from an independent Irish studio. Players hatch a genetically varied alien creature, explore six living realms, fight the corruption holding their guardians and decide what Project Beacon should become.</p>
                    </div>
                    <div class="press-language-cards">
                        <article><strong>Please say</strong><ul><li>Creature adventure</li><li>Procedural creature genetics</li><li>Playable in a browser</li><li>AI-assisted creative work</li><li>Generated marketing illustration</li></ul></article>
                        <article><strong>Please avoid</strong><ul><li>Sentient or conscious creatures</li><li>Guaranteed global uniqueness</li><li>Generated artwork described as gameplay</li><li>NASA partnership or endorsement</li><li>A fully autonomous studio</li></ul></article>
                    </div>
                </div>
            </section>

            <section class="press-contact-section">
                <div class="section-inner">
                    <p class="kicker">PLAY BEFORE YOU WRITE</p>
                    <h2>The signal is already live.</h2>
                    <p>Mythical Void is available to try now. An official press contact channel is being prepared; until it opens, this page remains the canonical source for approved facts and the current visual-review status.</p>
                    <div class="press-hero-actions">
                        ${playLink('Play Mythical Void')}
                        <a class="button button-quiet" href="/resources/mythical-void-stem-creature-lab.pdf" download>Get the free STEM activity</a>
                        <a class="button button-quiet" href="/press/mythical-void-press-assets.json">View the media manifest</a>
                    </div>
                </div>
            </section>
        </main>

        <footer>
            <div class="footer-inner">
                <div class="footer-brand"><a class="brand" href="/">${brandMark()}<span>MYTHICAL VOID</span></a><p>Your creature. Your journey. Your choice.</p></div>
                <nav aria-label="Press room navigation"><a href="/">Main website</a><a href="/play/">Play game</a><a href="/privacy/">Privacy & safety</a><a href="/terms/">Terms</a></nav>
                <small>© ${new Date().getFullYear()} Mythical Void. Made in Ireland for curious minds everywhere.</small>
            </div>
        </footer>
    `;

    mountAnalyticsConsent();
}

function renderLegalPage(type) {
    const isPrivacy = type === 'privacy';
    updatePageMetadata({
        title: `${isPrivacy ? 'Privacy & Safety' : 'Terms of Use'} | Mythical Void`,
        description: isPrivacy
            ? 'How Mythical Void handles game saves, safety, and player privacy.'
            : 'Terms for playing the Mythical Void early-access browser adventure.',
        path: isPrivacy ? '/privacy/' : '/terms/'
    });

    app.innerHTML = `
        <main class="legal-page">
            <a class="brand legal-brand" href="/" aria-label="Return to Mythical Void home">
                ${brandMark()}
                <span>MYTHICAL VOID</span>
            </a>
            <article>
                <p class="kicker">${isPrivacy ? 'PRIVACY & SAFETY' : 'TERMS OF USE'}</p>
                <h1>${isPrivacy ? 'Built for play, not profiles.' : 'A fair way to explore the Void.'}</h1>
                ${isPrivacy ? `
                    <p>You do not need an account, email address, or payment information to begin playing Mythical Void.</p>
                    <h2>Game saves</h2>
                    <p>Your creature and progress stay in this browser by default. If you choose to turn on Cloud Save, an anonymous account number, your saved game, and the times it was saved are stored securely. A parent PIN and local safety history are never included.</p>
                    <h2>Online services</h2>
                    <p>Cloud Save uses Supabase. The game may also ask trusted outside services for public space-weather or game-help information. Like most online services, they may receive basic connection information such as an internet address.</p>
                    <h2>Optional website analytics</h2>
                    <p>The public website may use Google Analytics to count visits, the general route people arrived from—such as search, a game shelf, social media, another Mythical Void page or a direct link—and whether website buttons lead to the game or sharing. It is off by default. If you choose “Allow analytics”, Google receives the public page, that broad arrival group, the general button area and the normal connection and device information used by web analytics. Mythical Void does not send Google the full page you came from, a message recipient, contact detail, creature detail, game activity, or the extra information after a question mark in a web address. It is not used in the game, and advertising features are switched off. You can choose “No thanks” instead.</p>
                    <h2>Children</h2>
                    <p>Children can play without Cloud Save. A child should only use Cloud Save when a parent or guardian has given any permission required where they live.</p>
                    <h2>Contact</h2>
                    <p>Our parent and guardian contact channel is being prepared. When it opens, messages will be used only to reply and to keep young players safe.</p>
                ` : `
                    <p>Mythical Void is an early-access browser game for personal play.</p>
                    <h2>Your save</h2>
                    <p>Your progress stays in this browser by default. Cloud Save may be available, but we cannot promise that it will always work without interruption.</p>
                    <h2>Play fairly</h2>
                    <p>Please do not disrupt the game, pretend to be the Mythical Void team, or sell the game's artwork and content as your own.</p>
                    <h2>Early access</h2>
                    <p>The game is still growing, so features may change. We provide it as it is available.</p>
                `}
                <p class="legal-updated">Last updated: August 2026</p>
                <a class="text-link" href="/">← Return to the website</a>
            </article>
        </main>
    `;
    mountAnalyticsConsent();
}

function renderStorefront() {
    updatePageMetadata({
        title: 'Mythical Void | Free Creature Adventure Browser Game',
        description: 'Play Mythical Void free in your browser. Hatch a varied alien creature, explore six living realms, restore their guardians and shape Project Beacon.',
        path: '/'
    });

    app.innerHTML = `
        <a class="skip-link" href="#main-content">Skip to the adventure</a>

        <header class="site-header" data-header>
            <div class="header-inner">
                <a class="brand" href="#hero" aria-label="Mythical Void home">
                    ${brandMark()}
                    <span>MYTHICAL VOID</span>
                </a>
                <button class="menu-button" type="button" aria-label="Open menu" aria-expanded="false" data-menu-button>
                    <span></span><span></span><span></span>
                </button>
                <nav class="site-nav" aria-label="Main navigation" data-menu>
                    <a href="/playable-now/#find-your-way">Find your game</a>
                    <a href="#adventure">The adventure</a>
                    <a href="#how-it-works">How it works</a>
                    <a href="#studio">The studio</a>
                    <a href="#creatures">Creatures</a>
                    <a href="/story/">The story</a>
                    <a href="#parents">For grown-ups</a>
                    ${playLink('Play now', 'button button-small')}
                </nav>
            </div>
        </header>

        <main id="main-content">
            <section class="hero" id="hero">
                <img class="hero-world" src="/marketing/mythical-void-creature-universe-hero-v2.webp" alt="Alien creatures reimagined from the body shapes and mutations supported by the Mythical Void genetics engine" fetchpriority="high">
                <div class="hero-veil" aria-hidden="true"></div>
                <div class="hero-inner">
                    <div class="hero-copy-block">
                        <p class="kicker"><span></span> A universe of creatures</p>
                        <h1>One universe. <em>Every hatch opens a new possibility.</em></h1>
                        <p class="hero-copy">Every hatch mixes body, colour, personality, cosmic power and rare mutations. What arrives from the Void will be truly yours.</p>
                        <div class="hero-actions">
                            ${playLink('Play now — it’s free')}
                            <button class="button button-quiet button-share" type="button" data-share-game>
                                <span data-share-label>Share the game</span>
                                <span class="button-arrow" aria-hidden="true">↗</span>
                            </button>
                            <a class="button button-quiet" href="/playable-now/#find-your-way">Find your way in</a>
                        </div>
                        <p class="returning-player-note" data-returning-player-note hidden><strong>Welcome back.</strong> Your saved adventure is still in this browser. Continue where you left off.</p>
                        <p class="hero-share-status share-status" data-share-status aria-live="polite"></p>
                        <ul class="hero-genetics" aria-label="How this scene was made">
                            <li><strong>1,000</strong><span>real engine hatches explored</span></li>
                            <li><strong>72</strong><span>varied profiles shaped this scene</span></li>
                            <li><strong>1</strong><span>creature made for your story</span></li>
                        </ul>
                    </div>
                    <div class="hero-art-note">
                        <span class="hero-art-note-star" aria-hidden="true">✦</span>
                        <span><strong>From 72 engine-born profiles</strong>Real silhouettes and mutations, reimagined for the Void</span>
                    </div>
                </div>
                <a class="scroll-cue" href="#adventure"><span>Begin the story</span><b aria-hidden="true">↓</b></a>
            </section>

            <section class="adventure-section" id="adventure">
                <div class="section-inner">
                    <div class="section-heading centred">
                        <p class="kicker">YOUR ADVENTURE</p>
                        <h2>One little creature.<br>One enormous journey.</h2>
                        <p>Mythical Void is part creature-raising game, part action adventure, and part story shaped by your choices.</p>
                    </div>
                    <div class="adventure-path">
                        <article class="path-card path-card-hatch">
                            <span class="path-number">01</span>
                            <div class="path-icon path-icon-recovery" aria-hidden="true">
                                <span class="recovery-moon"></span>
                                <span class="recovery-signal"></span>
                                <span class="recovery-ship"><i></i></span>
                            </div>
                            <h3>Recover what survived</h3>
                            <p>Wanderer-77 is down. Find the field kit, read the signal, and begin Project Beacon from the crash site.</p>
                        </article>
                        <div class="path-line" aria-hidden="true">···</div>
                        <article class="path-card path-card-explore">
                            <span class="path-number">02</span>
                            <div class="path-icon path-icon-clearing" aria-hidden="true">
                                <span class="clearing-void"></span>
                                <span class="clearing-creature"><i></i></span>
                                <span class="clearing-burst"></span>
                            </div>
                            <h3>Clear the corruption</h3>
                            <p>Run, leap, fight beside your creature, and break the Void pressure holding each guardian.</p>
                        </article>
                        <div class="path-line" aria-hidden="true">···</div>
                        <article class="path-card path-card-choose">
                            <span class="path-number">03</span>
                            <div class="path-icon path-icon-choice" aria-hidden="true">
                                <span class="choice-beacon"><i></i></span>
                                <span class="choice-path choice-path-left"></span>
                                <span class="choice-path choice-path-right"></span>
                                <span class="choice-world choice-world-left"></span>
                                <span class="choice-world choice-world-right"></span>
                            </div>
                            <h3>Restore, then choose</h3>
                            <p>When a guardian is safe, its world changes. What you repair first helps decide what Project Beacon becomes.</p>
                        </article>
                    </div>
                </div>
            </section>

            <section class="systems-section" id="how-it-works">
                <div class="section-inner">
                    <div class="section-heading centred">
                        <p class="kicker">WHY MYTHICAL VOID IS DIFFERENT</p>
                        <h2>A game world that remembers how you play.</h2>
                        <p>Under the story is a set of living systems designed to make each creature and each expedition feel personal.</p>
                    </div>
                    <div class="systems-grid">
                        <article class="system-card"><span class="system-index">01</span><h3>Genetics with real variety</h3><p>Creature genetics combine species, colours, body shapes, personalities, rarity, and cosmic affinities. Your creature is built from a profile—not picked from one poster.</p><a href="/creature-genetics/">Explore creature genetics →</a><a href="/creature-field-guide/">Enter the creature universe →</a></article>
                        <article class="system-card"><span class="system-index">02</span><h3>A living browser world</h3><p>Phaser 3 is the game engine underneath the adventure. It lets the movement, exploration, battles, guardians, village, and story scenes happen right in your browser.</p><a href="/play/">Enter the Fend →</a></article>
                        <article class="system-card"><span class="system-index">03</span><h3>Story moments made for your friend</h3><p>Optional, experimental tools, available only with adult approval, can turn your creature’s identity into a living portrait or a short AI-made scene. These moments add wonder; the main story and its choices are still written and checked by people.</p><a href="/parents/">Read the family notes →</a></article>
                        <article class="system-card"><span class="system-index">04</span><h3>Real space science</h3><p>The game can bring in NASA’s public space data, including astronomy pictures and space-weather signals. A changing public Space Signal now gives curious players one real observation and one impossible creature question to explore.</p><a href="/space-signal/">Open today's Space Signal →</a><a href="/nasa-space-science/">See the STEM promise →</a></article>
                    </div>
                </div>
            </section>

            <section class="creature-section" id="creatures">
                <div class="section-inner creature-layout">
                    <div class="creature-stage">
                        <div class="creature-halo" aria-hidden="true"></div>
                        <img src="/game/village/shared-habitat.webp" alt="A shared habitat in the restored village" data-featured-image>
                        <div class="creature-nameplate" aria-live="polite">
                            <span>BUILD A HOME IN THE FEND</span>
                            <strong data-featured-name>Shared Habitat</strong>
                        </div>
                    </div>
                    <div class="creature-copy">
                        <p class="kicker">SEE THE REAL GAME</p>
                        <h2>Your creature grows inside a living world.</h2>
                        <p>The game is about more than a character portrait. You repair the Fend, recover Wanderer-77, work with its people, and decide what Project Beacon should become.</p>
                        <div class="creature-details" aria-live="polite">
                            <div><span>PLACE</span><strong data-featured-personality>The Fend</strong></div>
                            <div><span>MISSION</span><strong data-featured-colour>Restore, then choose</strong></div>
                        </div>
                        <div class="creature-selector" role="list" aria-label="Choose a creature to see">
                            ${showcaseScenes.map((scene, index) => `
                                <button class="${index === 0 ? 'active' : ''}" type="button" data-creature="${index}" aria-label="Show ${scene.name}" aria-pressed="${index === 0}">
                                    <img src="${scene.image}" alt="" loading="${index > 2 ? 'lazy' : 'eager'}">
                                    <span>${scene.name}</span>
                                </button>
                            `).join('')}
                        </div>
                        ${playLink('Discover your creature')}
                    </div>
                </div>
            </section>

            <section class="story-section" id="story">
                <div class="story-picture">
                    <img src="/game/village/village-heart-command.webp" alt="The village heart command area in the game" loading="lazy">
                    <span class="picture-note">THE FEND // RECOVERY IN PROGRESS</span>
                </div>
                <div class="story-copy-block">
                    <p class="kicker">THE STORY</p>
                    <h2>Earth sent you looking for hope.</h2>
                    <p>You are the astronaut-pilot of The Wanderer-77, launched from a desperate Earth to find life, recover samples, and send home a reason for hope. Then your ship crashes in the Void.</p>
                    <p>A creature hatches in the wreckage. It is intelligent, vulnerable, and the first alien life to trust a human.</p>
                    <p>As you restore its world, your old mission starts to feel very different. In the end, you decide what Project Beacon should tell Earth—and decide what home means.</p>
                    <a class="text-link" href="/story/">Follow the full Project Beacon story <span aria-hidden="true">→</span></a>
                </div>
            </section>

            <section class="worlds-section" id="worlds">
                <div class="section-inner worlds-layout">
                    <div class="worlds-copy">
                        <p class="kicker">SIX WORLDS TO RESTORE</p>
                        <h2>You are fighting the corruption, not the guardian.</h2>
                        <p>In each guardian encounter, the purple corruption is the thing you reduce. Learn the guardian’s attacks, move with your creature, and clear the pressure around it. When the corruption reaches zero, the guardian is restored and the world can move forward.</p>
                        <ul class="world-facts">
                            <li><span>6</span> strange worlds</li>
                            <li><span>6</span> lost guardians</li>
                            <li><span>1</span> friend beside you</li>
                        </ul>
                        ${playLink('Answer the signal')}
                    </div>
                    <div class="guardian-card">
                        <span class="guardian-warning">THE VOID HAS FOUND IT</span>
                        <img src="/game/guardians/void-empress.webp" alt="The Void Empress guardian from the game" loading="lazy">
                        <div>
                            <strong>Corruption signal: unstable</strong>
                            <span>Clear the pressure. Let the guardian return.</span>
                        </div>
                    </div>
                </div>
            </section>

            <section class="choice-section">
                <div class="section-inner choice-inner">
                    <p class="kicker">A STORY WITH HEART</p>
                    <blockquote>“What if the thing you were sent to find became the friend you could not leave behind?”</blockquote>
                    <div class="choice-tags" aria-label="What the game is about">
                        <span>Friendship</span><span>Courage</span><span>Discovery</span><span>Choice</span>
                    </div>
                </div>
            </section>

            <section class="studio-section" id="studio">
                <div class="section-inner">
                    <div class="studio-heading">
                        <p class="kicker">OUR BEGINNING</p>
                        <h2>A dad. His nine-year-old son.<br><em>One enormous idea.</em></h2>
                        <p class="studio-intro">Mythical Void began at home as a father-and-son project—Kevin and his nine-year-old son exploring what generative AI tools and a lot of imagination could make possible.</p>
                    </div>
                    <div class="studio-story-grid">
                        <div class="studio-origin-card" aria-label="How two imaginations became Mythical Void">
                            <div class="origin-stars" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
                            <div class="origin-thought origin-thought-dad"><span>A father's curiosity</span></div>
                            <div class="origin-thought origin-thought-son"><span>A nine-year-old's imagination</span></div>
                            <div class="origin-thread origin-thread-left" aria-hidden="true"></div>
                            <div class="origin-thread origin-thread-right" aria-hidden="true"></div>
                            <div class="origin-spark">
                                <img src="/marketing/mythical-void-emblem-v3.png" alt="" width="56" height="92">
                                <span>MYTHICAL VOID</span>
                            </div>
                            <blockquote>“What if we could build the game we imagined together?”</blockquote>
                        </div>
                        <div class="studio-copy">
                            <p class="studio-lead">The ideas did not begin with a business plan. They began with conversations: strange creatures, impossible worlds, living beings and the kind of choices a child would genuinely care about.</p>
                            <p>Generative AI helped turn those shared ideas into pictures, movement, characters and playable moments. Imagination still leads. AI is one of the tools that helps us explore further and build faster.</p>
                            <p>That experiment is growing into an independent Irish game studio—still guided by the same promise: make something wondrous for curious young minds, keep people in charge, and build safety into the world from the beginning.</p>
                            <div class="studio-principles" aria-label="What guides the Mythical studio">
                                <span><b>01</b> Imagination leads</span>
                                <span><b>02</b> AI helps us explore</span>
                                <span><b>03</b> Children deserve care</span>
                            </div>
                            <a class="text-link" href="/studio/">Read how the project began <span aria-hidden="true">→</span></a>
                        </div>
                    </div>
                </div>
            </section>

            <section class="parents-section" id="parents">
                <div class="section-inner parents-layout">
                    <div class="parents-copy">
                        <p class="kicker">FOR PARENTS & GUARDIANS</p>
                        <h2>A big adventure with thoughtful choices.</h2>
                        <p>Mythical Void mixes exploration and age-appropriate fantasy battles with problem solving, care, responsibility, and restoration rather than destruction.</p>
                        <p class="parent-answer"><strong>The short answer:</strong> children can start playing without an account, an email address, or payment details.</p>
                        <a class="text-link" href="/parents/">Read the full family guide <span aria-hidden="true">→</span></a>
                    </div>
                    <ul class="safety-list">
                        <li><span aria-hidden="true">✓</span><div><strong>No account needed</strong><p>Start without sharing a name or email.</p></div></li>
                        <li><span aria-hidden="true">✓</span><div><strong>No payments</strong><p>The current browser game is free.</p></div></li>
                        <li><span aria-hidden="true">✓</span><div><strong>Saved here by default</strong><p>Progress stays in this browser unless Cloud Save is chosen.</p></div></li>
                        <li><span aria-hidden="true">✓</span><div><strong>Family-friendly world</strong><p>Fantasy action without gore or adult themes.</p></div></li>
                    </ul>
                </div>
            </section>

            <section class="community-section">
                <div class="section-inner community-layout">
                    <div>
                        <p class="kicker">COMMUNITY CREATURE LAB</p>
                        <h2>Your imagination can shape the Void.</h2>
                    </div>
                    <div>
                        <p>Draw a guardian, name its powers, and tell us which world it protects. For a young designer, a parent or guardian must send the idea. Please do not include the child's surname, face, voice, school, location, or contact details.</p>
                            <span class="button button-outline button-disabled">Design submissions open soon</span>
                        <p class="community-feedback-note">Played already? An adult player, parent, guardian or educator can now give us a one-minute anonymous feedback pulse. It uses fixed choices only—no name, email address or written story.</p>
                        <div class="feedback-links" aria-label="Adult feedback">
                            <a href="/feedback/">Tell us what worked and what needs attention →</a>
                        </div>
                    </div>
                </div>
            </section>

            <section class="faq-section" id="faq">
                <div class="section-inner faq-layout">
                    <div class="section-heading">
                        <p class="kicker">GOOD TO KNOW</p>
                        <h2>Questions before you play?</h2>
                            <p>Here are the quick answers. A parent and guardian help channel will be added when our contact setup is ready.</p>
                    </div>
                    <div class="faq-list">
                        ${faqs.map(([question, answer], index) => `
                            <details ${index === 0 ? 'open' : ''}>
                                <summary>${question}<span aria-hidden="true">${index === 0 ? '−' : '+'}</span></summary>
                                <p>${answer}</p>
                            </details>
                        `).join('')}
                    </div>
                </div>
            </section>

            <section class="final-cta">
                <img src="/game/project-beacon-crash-site.webp" alt="" loading="lazy">
                <div class="final-cta-copy">
                    <p class="kicker">THE SIGNAL IS GETTING STRONGER</p>
                    <h2>Your creature is waiting.</h2>
                    <p>Free to play. No download. No account needed.</p>
                    <div class="final-cta-actions">
                        ${playLink('Play Mythical Void')}
                        <button class="button button-share" type="button" data-share-game>
                            <span data-share-label>Share the game</span>
                            <span class="button-arrow" aria-hidden="true">↗</span>
                        </button>
                    </div>
                    <p class="share-status" data-share-status aria-live="polite"></p>
                </div>
            </section>
        </main>

        <footer>
            <div class="footer-inner">
                <div class="footer-brand">
                    <a class="brand" href="#hero">
                        ${brandMark()}
                        <span>MYTHICAL VOID</span>
                    </a>
                    <p>Your creature. Your journey. Your choice.</p>
                </div>
                <nav aria-label="Footer navigation">
                    <a href="/play/">Play game</a>
                    <a href="/playable-now/#find-your-way">Find your way in</a>
                    <a href="/hatch-challenge/">Hatch Challenge</a>
                    <a href="/press/">Press & creators</a>
                    <a href="/updates/">What's new</a>
                    <a href="/creature-genetics/">Creature genetics</a>
                    <a href="/nasa-space-science/">NASA & STEM</a>
                    <a href="/educators/">For groups & educators</a>
                    <a href="/studio/">Our story</a>
                    <a href="/parents/">For grown-ups</a>
                    <a href="/help/">Help</a>
                    <a href="/privacy/">Privacy & safety</a>
                    <a href="/terms/">Terms</a>
                        <span class="footer-link-muted">Contact opens soon</span>
                </nav>
                <small>© ${new Date().getFullYear()} Mythical Void. Made in Ireland for curious minds everywhere.</small>
            </div>
        </footer>
    `;

    window.MythicalReturningPlayer?.apply(app);
    bindInteractions();
    mountAnalyticsConsent();
}

function bindInteractions() {
    const sourceAreaFor = (element) => {
        if (element?.closest('header')) return 'header';
        if (element?.closest('.hero, .press-hero')) return 'hero';
        if (element?.closest('.playable-share-section, [data-share-section]')) return 'share_section';
        if (element?.closest('.final-cta')) return 'final_cta';
        if (element?.closest('footer')) return 'footer';
        return 'content';
    };
    const trackPublicEvent = (eventName, element) => {
        window.MythicalAnalytics?.track?.(eventName, { source_area: sourceAreaFor(element) });
    };

    const menuButton = app.querySelector('[data-menu-button]');
    const menu = app.querySelector('[data-menu]');

    const setMenuOpen = (open, { restoreFocus = false } = {}) => {
        if (!menuButton || !menu) return;
        menuButton.setAttribute('aria-expanded', String(open));
        menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        menu.classList.toggle('open', open);
        document.body.classList.toggle('nav-open', open);
        if (restoreFocus) menuButton.focus();
    };

    menuButton?.addEventListener('click', () => {
        setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true');
    });

    menu?.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => setMenuOpen(false));
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
            setMenuOpen(false, { restoreFocus: true });
        }
    });

    document.addEventListener('click', (event) => {
        if (menuButton?.getAttribute('aria-expanded') === 'true'
            && !menu?.contains(event.target)
            && !menuButton.contains(event.target)) {
            setMenuOpen(false);
        }
    });

    const creatureButtons = [...app.querySelectorAll('[data-creature]')];
    const image = app.querySelector('[data-featured-image]');
    const name = app.querySelector('[data-featured-name]');
    const personality = app.querySelector('[data-featured-personality]');
    const colour = app.querySelector('[data-featured-colour]');

    creatureButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const scene = showcaseScenes[Number(button.dataset.creature)];
            if (!scene || !image || !name || !personality || !colour) return;

            image.classList.add('changing');
            window.setTimeout(() => {
                image.src = scene.image;
                image.alt = scene.name;
                name.textContent = scene.name;
                personality.textContent = scene.detail;
                colour.textContent = scene.mission;
                image.classList.remove('changing');
            }, 120);

            creatureButtons.forEach((candidate) => {
                const selected = candidate === button;
                candidate.classList.toggle('active', selected);
                candidate.setAttribute('aria-pressed', String(selected));
            });
        });
    });

    app.querySelectorAll('details').forEach((detail) => {
        detail.addEventListener('toggle', () => {
            const marker = detail.querySelector('summary span');
            if (marker) marker.textContent = detail.open ? '−' : '+';
        });
    });

    app.querySelectorAll('a[href="/play/"]').forEach((link) => {
        link.addEventListener('click', () => trackPublicEvent('play_selected', link));
    });

    const shareButtons = [...app.querySelectorAll('[data-share-game]')];
    const shareStatuses = [...app.querySelectorAll('[data-share-status]')];
    const shareData = {
        title: 'Mythical Void',
        text: 'Hatch a strange alien creature, cross six living realms and shape Project Beacon in Mythical Void free in your browser.',
        url: 'https://mythicalvoid.com/playable-now/#find-your-way'
    };
    const setShareStatus = (message) => {
        shareStatuses.forEach((status) => { status.textContent = message; });
    };

    if (!navigator.share) {
        shareButtons.forEach((button) => {
            const label = button.querySelector('[data-share-label]');
            if (label) label.textContent = 'Copy game link';
        });
    }

    shareButtons.forEach((button) => {
        button.addEventListener('click', async () => {
            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                    setShareStatus('Thanks for sharing the signal.');
                    trackPublicEvent('share_completed', button);
                    return;
                }

                await navigator.clipboard.writeText(shareData.url);
                setShareStatus('Clean game link copied — no tracking code.');
                trackPublicEvent('share_link_copied', button);
            } catch (error) {
                if (error?.name !== 'AbortError') {
                    setShareStatus('You can share mythicalvoid.com/playable-now from your browser.');
                }
            }
        });
    });
}

if (pagePath === '/press') {
    renderPressPage();
} else if (pagePath === '/privacy') {
    renderLegalPage('privacy');
} else if (pagePath === '/terms') {
    renderLegalPage('terms');
} else {
    renderStorefront();
}
