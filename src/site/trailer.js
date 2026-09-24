// A first-party still is all that loads until the visitor chooses to watch.
const TRAILER_ID = 'k900qJVe_uY';
const TRAILER_URL = `https://www.youtube.com/watch?v=${TRAILER_ID}`;

export function trailerMarkup() {
    return `
        <figure class="homepage-trailer" id="trailer">
            <div class="trailer-screen" data-trailer-screen>
                <a class="trailer-start" href="${TRAILER_URL}" data-trailer-start
                   aria-label="Watch Through the Void, the Mythical Void cinematic trailer"
                   aria-describedby="trailer-disclosure" rel="noopener noreferrer" target="_blank">
                    <img src="/marketing/through-the-void-poster.jpg" width="1280" height="720"
                         alt="An astronaut discovers Sanctuary in Through the Void" fetchpriority="high">
                    <span class="trailer-play"><span aria-hidden="true">▶</span> Watch the film <small>1:14</small></span>
                </a>
            </div>
            <figcaption id="trailer-disclosure">
                <strong>AI-created cinematic — not gameplay.</strong>
                <span>Tap to watch. Starts muted.</span>
                <a href="${TRAILER_URL}" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a>
            </figcaption>
        </figure>`;
}

export function mountTrailer(root) {
    const start = root.querySelector('[data-trailer-start]');
    const screen = root.querySelector('[data-trailer-screen]');
    if (!start || !screen) return;
    start.addEventListener('click', (event) => {
        // Preserve the ordinary link for new-tab gestures and no-JS visitors.
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0) return;
        event.preventDefault();
        const player = document.createElement('video');
        player.setAttribute('aria-label', 'Mythical Void — Through the Void cinematic trailer');
        player.controls = true;
        player.playsInline = true;
        player.muted = true;
        player.defaultMuted = true;
        player.preload = 'none';
        player.poster = '/marketing/through-the-void-poster.jpg';
        player.src = '/cinematic/through-the-void-v4-720p.mp4';
        const captions = document.createElement('track');
        captions.kind = 'captions';
        captions.srclang = 'en';
        captions.label = 'English';
        captions.src = '/cinematic/through-the-void-v4.vtt';
        captions.default = true;
        player.append(captions);
        player.tabIndex = 0;
        screen.replaceChildren(player);
        player.focus();
        // A rejected autoplay request leaves working native Play controls.
        player.play()?.catch(() => {});
        const note = root.querySelector('#trailer-disclosure span');
        if (note) note.textContent = 'Starts muted. Turn sound on in the player.';
    });
}
