const app = document.querySelector('#app');
const path = window.location.pathname.replace(/\/+$/, '') || '/';
const params = new URLSearchParams(window.location.search);
const isDistributionBuild = import.meta.env.VITE_DISTRIBUTION_BUILD === 'true';
const isGameRoute = isDistributionBuild || path === '/play' || path === '/game' || params.has('testBoss');

if (isGameRoute) {
    document.documentElement.classList.add('game-mode');
    document.body.classList.add('game-mode');
    document.title = 'Play Mythical Void';
    app.innerHTML = '<div id="game" aria-label="Mythical Void game"></div>';

    import('./game.js').catch((error) => {
        console.error('Failed to start Mythical Void:', error);
        app.innerHTML = `
            <main class="game-load-error">
                <h1>The void did not open</h1>
                <p>The game could not start. Refresh the page or return to the website.</p>
                <div>
                    <button type="button" data-retry>Try again</button>
                    <a href="/">Return home</a>
                </div>
            </main>
        `;
        app.querySelector('[data-retry]')?.addEventListener('click', () => window.location.reload());
    });
} else {
    document.documentElement.classList.add('site-mode');
    document.body.classList.add('site-mode');
    import('./site/storefront.js');
}
