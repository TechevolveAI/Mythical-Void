import './storefront.css';

const creatures = [
    { name: 'Nova', trait: 'Star affinity · Curious', image: '/marketing/nova.webp' },
    { name: 'Wisp', trait: 'Void affinity · Playful', image: '/marketing/wisp.webp' },
    { name: 'Pebble', trait: 'Crystal affinity · Gentle', image: '/marketing/pebble.webp' },
    { name: 'Zephyr', trait: 'Nebula affinity · Wise', image: '/marketing/zephyr.webp' },
    { name: 'Luna', trait: 'Moon affinity · Energetic', image: '/marketing/luna.webp' },
    { name: 'Bloom', trait: 'Legendary cosmic', image: '/marketing/bloom.webp' }
];

const features = [
    ['DNA', 'Unique genetics', 'Colors, markings, personalities, and abilities combine to make every companion one of a kind.'],
    ['RESTORE', 'Six living realms', 'Explore distinct biomes, free each guardian from the Void, and recover the systems your ship needs.'],
    ['BOND', 'A creature that remembers', 'Care, exploration, and the choices you make shape your companion over time.'],
    ['BEACON', 'A mission that changes', 'Earth sent you to find life and hope. What you discover makes Project Beacon personal.'],
    ['GROW', 'Evolution and legacy', 'Unlock new stages and build a lineage that carries rare traits into future generations.'],
    ['CHOICE', 'Find your way home', 'Repair The Wanderer-7, then decide what home means after everything you have found.']
];

const faqs = [
    ['How do I start playing?', 'Choose any Play Now button. The game opens at /play/ in this same website, with no account or download required.'],
    ['Will my progress be saved?', 'Yes. Your progress is stored locally in this browser. Optional Cloud Save can protect a private copy linked to this browser, but this release does not yet transfer progress to another device.'],
    ['What devices can I use?', 'Mythical Void is designed for current desktop and mobile browsers. A keyboard is recommended for the platforming levels.'],
    ['Is the game really free?', 'Yes. The current early-access browser game is free to play and does not require payment information.'],
    ['Is it suitable for younger players?', 'The adventure is designed to be family friendly, with fantasy combat and no gore. Parents can review the safety notes below.'],
    ['Do I need an account?', 'No. There is no account gate, email signup, or profile required to hatch your first creature.']
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
    <a class="${className}" href="/play/">
        <span aria-hidden="true">▶</span>
        <span>${label}</span>
    </a>
`;

function renderLegalPage(type) {
    const isPrivacy = type === 'privacy';
    updatePageMetadata({
        title: `${isPrivacy ? 'Privacy & Safety' : 'Terms of Use'} | Mythical Void`,
        description: isPrivacy
            ? 'How Mythical Void handles local progress, optional cloud saves, safety, and player privacy.'
            : 'Terms for playing the Mythical Void early-access browser adventure.',
        path: isPrivacy ? '/privacy/' : '/terms/'
    });
    app.innerHTML = `
        <main class="legal-page">
            <a class="brand legal-brand" href="/" aria-label="Return to Mythical Void home">
                <img src="/marketing/mythical-void-logo.webp" alt="">
                <span>MYTHICAL VOID</span>
            </a>
            <article>
                <p class="eyebrow">${isPrivacy ? 'PRIVACY & SAFETY' : 'TERMS OF USE'}</p>
                <h1>${isPrivacy ? 'Built for play, not profiles.' : 'A fair way to explore the void.'}</h1>
                ${isPrivacy ? `
                    <p>Mythical Void does not require an account, email address, or payment information to begin playing.</p>
                    <h2>Game saves</h2>
                    <p>Your creature and progress are saved locally by default. If you explicitly enable optional Cloud Save, a versioned copy of your progress, an anonymous account identifier, and save timestamps are stored with Supabase. Guardian PIN data and local safety audit history are excluded.</p>
                    <h2>Technical services</h2>
                    <p>Supabase provides optional cloud authentication and storage. The game may also request public space-weather or game-support data from external services. Those providers may receive standard technical request information such as an IP address.</p>
                    <h2>Children</h2>
                    <p>Local play remains available without Cloud Save. Cloud Save must not be enabled for a child unless a parent or guardian has provided any consent required where the child lives.</p>
                    <h2>Contact</h2>
                    <p>If you email us, we use the information you send only to respond to your message. Parents and guardians can contact <a href="mailto:parents@mythicalvoid.com">parents@mythicalvoid.com</a>.</p>
                ` : `
                    <p>Mythical Void is an early-access browser game provided for personal, non-commercial play.</p>
                    <h2>Your save</h2>
                    <p>Progress is stored locally in your browser by default. Optional Cloud Save may be offered with separate privacy controls, but uninterrupted synchronization cannot be guaranteed.</p>
                    <h2>Respectful use</h2>
                    <p>Do not attempt to disrupt the service, impersonate the project, or reuse its artwork and game content as your own commercial product.</p>
                    <h2>Early access</h2>
                    <p>Features may change as the game develops. The game is provided as available, without a promise of uninterrupted operation.</p>
                `}
                <p class="legal-updated">Last updated: July 2026</p>
                <a class="text-link" href="/">← Return to the website</a>
            </article>
        </main>
    `;
}

function renderStorefront() {
    updatePageMetadata({
        title: 'Mythical Void - Your Creature. Your Journey.',
        description: 'Bond with a one-of-a-kind alien companion, restore six living realms, and decide what home means in this free browser adventure.',
        path: '/'
    });
    app.innerHTML = `
        <a class="skip-link" href="#main-content">Skip to content</a>
        <header class="site-header" data-header>
            <div class="header-inner">
                <a class="brand" href="#hero" aria-label="Mythical Void home">
                    <img src="/marketing/mythical-void-logo.webp" alt="">
                    <span>MYTHICAL VOID</span>
                </a>
                <button class="menu-button" type="button" aria-label="Open navigation" aria-expanded="false" data-menu-button>
                    <span></span><span></span><span></span>
                </button>
                <nav class="site-nav" aria-label="Main navigation" data-menu>
                    <a href="#creatures">Creatures</a>
                    <a href="#features">Features</a>
                    <a href="#story">Story</a>
                    <a href="#parents">For parents</a>
                    <a href="#faq">FAQ</a>
                    ${playLink('Play now', 'button button-small')}
                </nav>
            </div>
        </header>

        <main id="main-content">
            <section class="hero" id="hero">
                <div class="hero-stars" aria-hidden="true"></div>
                <img class="hero-creature" src="/marketing/nova.webp" alt="Nova, a mint-green cosmic creature with large starry eyes">
                <div class="hero-content">
                    <p class="eyebrow">PROJECT BEACON // FREE BROWSER ADVENTURE</p>
                    <h1><span>Mythical</span> Void</h1>
                    <p class="hero-copy">Your creature. Your journey. Bond with the first alien life to trust a human, restore six living realms, and decide what home truly means.</p>
                    <div class="hero-actions">
                        ${playLink('Start your adventure')}
                        <a class="button button-secondary" href="#creatures">Meet the creatures</a>
                    </div>
                    <ul class="trust-list" aria-label="Game details">
                        <li>No download</li>
                        <li>No signup</li>
                        <li>Free to play</li>
                    </ul>
                </div>
                <a class="scroll-cue" href="#different" aria-label="Explore the website">↓</a>
            </section>

            <section class="difference section-band" id="different">
                <div class="section-inner">
                    <div class="section-heading compact-heading">
                        <p class="eyebrow">WHY MYTHICAL VOID</p>
                        <h2>A companion that is yours alone</h2>
                    </div>
                    <div class="difference-grid">
                        <div><strong>1 of 1</strong><span>Procedural creature genetics</span></div>
                        <div><strong>6</strong><span>Living realms to restore</span></div>
                        <div><strong>1 choice</strong><span>That changes what home means</span></div>
                    </div>
                </div>
            </section>

            <section class="showroom" id="creatures">
                <div class="section-inner showroom-layout">
                    <div class="showroom-copy">
                        <p class="eyebrow">CREATURE SHOWROOM</p>
                        <h2>Every creature is unique</h2>
                        <p>Procedural genetics shape appearance, affinity, personality, and potential. These companions are glimpses of what could hatch.</p>
                        <div class="creature-selector" role="list" aria-label="Creature examples">
                            ${creatures.map((creature, index) => `
                                <button class="${index === 0 ? 'active' : ''}" type="button" data-creature="${index}" aria-label="Show ${creature.name}" aria-pressed="${index === 0}">
                                    <img src="${creature.image}" alt="" loading="${index > 2 ? 'lazy' : 'eager'}">
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="featured-creature" aria-live="polite">
                        <div class="creature-image-stage">
                            <img src="${creatures[0].image}" alt="${creatures[0].name}" data-featured-image>
                        </div>
                        <div>
                            <p class="eyebrow">POSSIBLE COMPANION</p>
                            <h3 data-featured-name>${creatures[0].name}</h3>
                            <p data-featured-trait>${creatures[0].trait}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section class="feature-section section-band" id="features">
                <div class="section-inner">
                    <div class="section-heading">
                        <p class="eyebrow">MORE THAN NURTURING</p>
                        <h2>A universe of possibilities</h2>
                        <p>Raise a companion, then take that bond into a complete action-adventure.</p>
                    </div>
                    <div class="feature-grid">
                        ${features.map(([label, title, copy]) => `
                            <article class="feature-card">
                                <span class="feature-label">${label}</span>
                                <h3>${title}</h3>
                                <p>${copy}</p>
                            </article>
                        `).join('')}
                    </div>
                </div>
            </section>

            <section class="story-section" id="story">
                <img src="/marketing/cosmic-forest.webp" alt="A vast cosmic tree glowing in a strange forest" loading="lazy">
                <div class="story-copy">
                    <p class="eyebrow">PROJECT BEACON // 2026</p>
                    <h2>Sent to help Earth. Stranded somewhere alive.</h2>
                    <p>You are the astronaut-pilot of The Wanderer-7, launched from a desperate Earth to find life, recover samples, and send home a reason for hope. Then the mission crashes into the Void.</p>
                    <p>A creature hatches in the wreckage. It is intelligent, vulnerable, and the first alien life to trust a human. As you help restore its world, Project Beacon's orders begin to mean something very different.</p>
                    <a class="text-link" href="#journey">Follow the journey →</a>
                </div>
            </section>

            <section class="guardian-section">
                <img src="/marketing/scorpion-guardian.webp" alt="A towering cosmic scorpion guardian" loading="lazy">
                <div class="guardian-copy">
                    <p class="eyebrow">GUARDIAN ENCOUNTERS</p>
                    <h2>Restore the guardians</h2>
                    <p>Each guardian has been wounded or distorted by the Void. Learn its patterns, survive the encounter, and fight beside your companion to bring it back to itself.</p>
                    ${playLink('Answer the signal')}
                </div>
            </section>

            <section class="journey-section section-band" id="journey">
                <div class="section-inner">
                    <div class="section-heading">
                        <p class="eyebrow">YOUR JOURNEY</p>
                        <h2>From first spark to final choice</h2>
                    </div>
                    <ol class="journey-steps">
                        <li><span>01</span><h3>Survive the crash</h3><p>Find a strange egg glowing among the wreckage of The Wanderer-7.</p></li>
                        <li><span>02</span><h3>Bond and grow</h3><p>Hatch, name, care for, and learn the nature of your companion.</p></li>
                        <li><span>03</span><h3>Restore and report</h3><p>Cross six realms, restore their living systems, and decide what Project Beacon should tell Earth.</p></li>
                    </ol>
                </div>
            </section>

            <section class="parents-section" id="parents">
                <div class="section-inner parents-layout">
                    <div>
                        <p class="eyebrow">FOR PARENTS & GUARDIANS</p>
                        <h2>Play built around curiosity and care</h2>
                        <p>Mythical Void combines exploration and age-appropriate fantasy combat with problem solving, responsibility, emotional connection, and restoration rather than destruction.</p>
                        <a class="text-link" href="mailto:parents@mythicalvoid.com">Contact the project →</a>
                    </div>
                    <ul class="safety-list">
                        <li><strong>No account required</strong><span>Players can begin without sharing a name or email address.</span></li>
                        <li><strong>No payments</strong><span>The current browser game is free and asks for no payment details.</span></li>
                        <li><strong>Local by default</strong><span>Progress stays in this browser unless an eligible player explicitly enables the optional browser-linked Cloud Save.</span></li>
                        <li><strong>Family-friendly world</strong><span>Fantasy action without gore or adult themes.</span></li>
                    </ul>
                </div>
            </section>

            <section class="contest-section section-band">
                <div class="section-inner contest-layout">
                    <div>
                        <p class="eyebrow">COMMUNITY DESIGN LAB</p>
                        <h2>Design a boss. Shape the game.</h2>
                    </div>
                    <div>
                        <p>Draw a guardian, name its powers, and tell us which realm it protects. Young designers should ask a parent or guardian before emailing artwork.</p>
                        <a class="button button-secondary" href="mailto:hello@mythicalvoid.com?subject=Mythical%20Void%20boss%20design">Send a design</a>
                    </div>
                </div>
            </section>

            <section class="faq-section" id="faq">
                <div class="section-inner faq-layout">
                    <div class="section-heading">
                        <p class="eyebrow">FAQ</p>
                        <h2>Before you enter the void</h2>
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
                <img src="/marketing/nova.webp" alt="" loading="lazy">
                <div>
                    <p class="eyebrow">THE EGG IS WAITING</p>
                    <h2>Your creature. Your story.</h2>
                    <p>No download. No signup. Just you and the void.</p>
                    ${playLink('Play now - free')}
                </div>
            </section>
        </main>

        <footer>
            <div class="footer-inner">
                <a class="brand" href="#hero">
                    <img src="/marketing/mythical-void-logo.webp" alt="">
                    <span>MYTHICAL VOID</span>
                </a>
                <p>Raise your creature. Restore the guardians. Choose what home means.</p>
                <nav aria-label="Footer">
                    <a href="/play/">Play game</a>
                    <a href="/privacy/">Privacy & safety</a>
                    <a href="/terms/">Terms</a>
                    <a href="mailto:hello@mythicalvoid.com">Contact</a>
                </nav>
                <small>© ${new Date().getFullYear()} Mythical Void</small>
            </div>
        </footer>
    `;

    bindInteractions();
}

function bindInteractions() {
    const menuButton = app.querySelector('[data-menu-button]');
    const menu = app.querySelector('[data-menu]');

    const setMenuOpen = (open, { restoreFocus = false } = {}) => {
        if (!menuButton || !menu) return;
        menuButton.setAttribute('aria-expanded', String(open));
        menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
        menu.classList.toggle('open', open);
        document.body.classList.toggle('nav-open', open);
        if (!open && restoreFocus) {
            menuButton.focus();
        }
    };

    menuButton?.addEventListener('click', () => {
        const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
        setMenuOpen(!isOpen);
    });

    menu?.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            setMenuOpen(false);
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
            setMenuOpen(false, { restoreFocus: true });
        }
    });

    document.addEventListener('pointerdown', (event) => {
        if (
            menuButton?.getAttribute('aria-expanded') === 'true' &&
            !menu?.contains(event.target) &&
            !menuButton.contains(event.target)
        ) {
            setMenuOpen(false);
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) {
            setMenuOpen(false);
        }
    });

    const image = app.querySelector('[data-featured-image]');
    const name = app.querySelector('[data-featured-name]');
    const trait = app.querySelector('[data-featured-trait]');
    const creatureButtons = app.querySelectorAll('[data-creature]');

    creatureButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const creature = creatures[Number(button.dataset.creature)];
            if (!creature) return;

            image.src = creature.image;
            image.alt = creature.name;
            name.textContent = creature.name;
            trait.textContent = creature.trait;
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
}

if (pagePath === '/privacy') {
    renderLegalPage('privacy');
} else if (pagePath === '/terms') {
    renderLegalPage('terms');
} else {
    renderStorefront();
}
