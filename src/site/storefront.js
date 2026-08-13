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
    <a class="${className}" href="/play/">
        <span>${label}</span>
        <span class="button-arrow" aria-hidden="true">→</span>
    </a>
`;

const brandMark = () => `
    <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <defs>
            <linearGradient id="void-mark-sky" x1="8" y1="7" x2="56" y2="57" gradientUnits="userSpaceOnUse">
                <stop stop-color="#342177"/>
                <stop offset="0.52" stop-color="#171049"/>
                <stop offset="1" stop-color="#080719"/>
            </linearGradient>
            <linearGradient id="void-mark-ring" x1="14" y1="48" x2="52" y2="15" gradientUnits="userSpaceOnUse">
                <stop stop-color="#7CE8CF"/>
                <stop offset="0.5" stop-color="#A778FF"/>
                <stop offset="1" stop-color="#FFD66B"/>
            </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="19" fill="url(#void-mark-sky)" stroke="#7CE8CF" stroke-opacity=".35"/>
        <circle cx="32" cy="32" r="17" fill="#05040F" stroke="url(#void-mark-ring)" stroke-width="4"/>
        <path d="M32 14c1.8 10.4 3.6 12.2 14 14-10.4 1.8-12.2 3.6-14 14-1.8-10.4-3.6-12.2-14-14 10.4-1.8 12.2-3.6 14-14Z" fill="#7CE8CF"/>
        <circle cx="48" cy="16" r="3.5" fill="#FFD66B"/>
        <path d="M13 45c8 5.5 16.5 6.9 25.5 4" fill="none" stroke="#A778FF" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
`;

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
                    <p>The public website may use Google Analytics to count visits and improve the shop window. It is off by default. If you choose “Allow analytics”, Google receives limited visit information for the public website only. It is not used in the game, and advertising features are switched off. You can choose “No thanks” instead.</p>
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
        title: 'Mythical Void | Project Beacon',
        description: 'Recover Wanderer-77, restore the Fend, and decide what Project Beacon should tell Earth. Play free in your browser.',
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
                    <a href="#adventure">The adventure</a>
                    <a href="#how-it-works">How it works</a>
                    <a href="#studio">The studio</a>
                    <a href="#creatures">Creatures</a>
                    <a href="#story">The story</a>
                    <a href="#parents">For grown-ups</a>
                    ${playLink('Play now', 'button button-small')}
                </nav>
            </div>
        </header>

        <main id="main-content">
            <section class="hero" id="hero">
                <img class="hero-world" src="/marketing/mythical-void-creature-universe-hero-v2.webp" alt="Alien companions reimagined from the body shapes and mutations supported by the Mythical Void genetics engine" fetchpriority="high">
                <div class="hero-veil" aria-hidden="true"></div>
                <div class="hero-inner">
                    <div class="hero-copy-block">
                        <p class="kicker"><span></span> A universe of companions</p>
                        <h1>One universe. <em>No two companions alike.</em></h1>
                        <p class="hero-copy">Every hatch mixes body, colour, personality, cosmic power and rare mutations. What arrives from the Void will be truly yours.</p>
                        <div class="hero-actions">
                            ${playLink('Play now — it’s free')}
                            <a class="button button-quiet" href="#creatures">Meet the possibilities</a>
                        </div>
                        <ul class="hero-genetics" aria-label="How this scene was made">
                            <li><strong>1,000</strong><span>real engine hatches explored</span></li>
                            <li><strong>72</strong><span>varied profiles shaped this scene</span></li>
                            <li><strong>1</strong><span>companion made for your story</span></li>
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
                        <p>Mythical Void is part creature companion, part action adventure, and part story shaped by your choices.</p>
                    </div>
                    <div class="adventure-path">
                        <article class="path-card path-card-hatch">
                            <span class="path-number">01</span>
                            <div class="path-icon" aria-hidden="true">✦</div>
                            <h3>Recover what survived</h3>
                            <p>Wanderer-77 is down. Find the field kit, read the signal, and begin Project Beacon from the crash site.</p>
                        </article>
                        <div class="path-line" aria-hidden="true">···</div>
                        <article class="path-card path-card-explore">
                            <span class="path-number">02</span>
                            <div class="path-icon" aria-hidden="true">⌁</div>
                            <h3>Clear the corruption</h3>
                            <p>Run, leap, fight beside your companion, and break the Void pressure holding each guardian.</p>
                        </article>
                        <div class="path-line" aria-hidden="true">···</div>
                        <article class="path-card path-card-choose">
                            <span class="path-number">03</span>
                            <div class="path-icon" aria-hidden="true">◇</div>
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
                        <p>Under the story is a set of living systems designed to make each companion and each expedition feel personal.</p>
                    </div>
                    <div class="systems-grid">
                        <article class="system-card"><span class="system-index">01</span><h3>Genetics with real variety</h3><p>Creature genetics combine species, colours, body shapes, personalities, rarity, and cosmic affinities. Your companion is built from a profile—not picked from one poster.</p><a href="/play/">See it in the game →</a></article>
                        <article class="system-card"><span class="system-index">02</span><h3>A living browser world</h3><p>Phaser 3 is the game engine underneath the adventure. It lets the movement, exploration, battles, guardians, village, and story scenes happen right in your browser.</p><a href="/play/">Enter the Fend →</a></article>
                        <article class="system-card"><span class="system-index">03</span><h3>Story moments made for your friend</h3><p>Optional, experimental tools, available only with adult approval, can turn your companion’s identity into a living portrait or a short AI-made scene. These moments add wonder; the main story and its choices are still written and checked by people.</p><a href="#parents">Read the family notes →</a></article>
                        <article class="system-card"><span class="system-index">04</span><h3>Real space science</h3><p>The game can bring in NASA’s public space data, including astronomy pictures, Mars images, and space-weather signals. It gives curious players a friendly way to ask questions, spot patterns, and discover that the space around the story is real.</p><a href="#studio">See the STEM promise →</a></article>
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
                        <h2>Your companion grows inside a living world.</h2>
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
                    <a class="text-link" href="#worlds">See what stands in your way <span aria-hidden="true">→</span></a>
                </div>
            </section>

            <section class="worlds-section" id="worlds">
                <div class="section-inner worlds-layout">
                    <div class="worlds-copy">
                        <p class="kicker">SIX WORLDS TO RESTORE</p>
                        <h2>You are fighting the corruption, not the guardian.</h2>
                        <p>In each guardian encounter, the purple corruption is the thing you reduce. Learn the guardian’s attacks, move with your companion, and clear the pressure around it. When the corruption reaches zero, the guardian is restored and the world can move forward.</p>
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
                <div class="section-inner studio-layout">
                    <div>
                        <p class="kicker">THE MYTHICAL STUDIO</p>
                        <h2>Small team. Big worlds. Careful AI.</h2>
                    </div>
                    <div class="studio-copy">
                        <p>Mythical is an independent studio in Ireland building games where animation, story, systems, and intelligent companions belong in the same world.</p>
                        <p>We use AI as a creative tool for new kinds of companion moments—not as a shortcut around people, safety, or good writing. The player stays in control, and the important choices stay understandable.</p>
                        <div class="studio-principles" aria-label="Mythical studio principles">
                            <span>Human-led stories</span><span>AI with boundaries</span><span>Made for curious minds</span>
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
                        <span class="text-link text-link-muted">Parent contact opens soon <span aria-hidden="true">→</span></span>
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
                        <p class="community-feedback-note">Played already? A parent, guardian, or adult player will soon be able to help us improve the next version. Our feedback channel is being prepared now:</p>
                        <div class="feedback-links" aria-label="Feedback options">
                            <span>Tell us what worked</span>
                            <span>Tell us what was confusing</span>
                            <span>Share an idea</span>
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
                    ${playLink('Play Mythical Void')}
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
                    <a href="#parents">For grown-ups</a>
                    <a href="/privacy/">Privacy & safety</a>
                    <a href="/terms/">Terms</a>
                        <span class="footer-link-muted">Contact opens soon</span>
                </nav>
                <small>© ${new Date().getFullYear()} Mythical Void. Made in Ireland for curious minds everywhere.</small>
            </div>
        </footer>
    `;

    bindInteractions();
    mountAnalyticsConsent();
}

function bindInteractions() {
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
}

if (pagePath === '/privacy') {
    renderLegalPage('privacy');
} else if (pagePath === '/terms') {
    renderLegalPage('terms');
} else {
    renderStorefront();
}
