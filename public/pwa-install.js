(function () {
    'use strict';

    var ownedInstallHost = /^(?:www\.)?mythicalvoid\.com$/.test(window.location.hostname)
        || /^(?:localhost|127\.0\.0\.1)$/.test(window.location.hostname);
    if (!ownedInstallHost) return;

    var installCard = document.querySelector('[data-install-card]');
    var installButton = document.querySelector('[data-install-game]');
    var installStatus = document.querySelector('[data-install-status]');
    var pendingPrompt = null;

    function installedAlready() {
        return window.matchMedia?.('(display-mode: standalone)')?.matches === true
            || window.navigator.standalone === true;
    }

    function hideInvitation() {
        if (installCard) installCard.hidden = true;
    }

    if ('serviceWorker' in navigator && (window.isSecureContext || /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname))) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none'
            }).catch(function () {
                // Installation is an optional enhancement; normal browser play remains available.
            });
        }, { once: true });
    }

    if (!installCard || !installButton || installedAlready()) {
        hideInvitation();
        return;
    }

    window.addEventListener('beforeinstallprompt', function (event) {
        event.preventDefault();
        pendingPrompt = event;
        installCard.hidden = false;
    });

    installButton.addEventListener('click', async function () {
        if (!pendingPrompt) return;
        installButton.disabled = true;
        await pendingPrompt.prompt();
        var choice = await pendingPrompt.userChoice;
        pendingPrompt = null;
        installButton.disabled = false;

        if (choice?.outcome === 'accepted') {
            if (installStatus) installStatus.textContent = 'Mythical Void is being added. It will open straight into the game.';
        } else {
            if (installStatus) installStatus.textContent = 'Nothing changed. You can keep playing in this browser.';
        }
        hideInvitation();
    });

    window.addEventListener('appinstalled', function () {
        pendingPrompt = null;
        hideInvitation();
    });
}());
