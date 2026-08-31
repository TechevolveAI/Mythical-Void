(function () {
    'use strict';

    var ownedInstallHost = /^(?:www\.)?mythicalvoid\.com$/.test(window.location.hostname)
        || /^(?:localhost|127\.0\.0\.1)$/.test(window.location.hostname);
    if (!ownedInstallHost) return;

    var installCard = document.querySelector('[data-install-card]');
    var installButton = document.querySelector('[data-install-game]');
    var installStatus = document.querySelector('[data-install-status]');
    var pendingPrompt = null;
    var serviceWorkerRegistration = null;
    var serviceWorkerReloading = false;
    var serviceWorkerControlledAtLoad = Boolean(navigator.serviceWorker?.controller);

    function reloadForCurrentRelease() {
        if (!serviceWorkerControlledAtLoad || serviceWorkerReloading) return;
        serviceWorkerReloading = true;
        window.location.reload();
    }

    function checkForCurrentRelease() {
        serviceWorkerRegistration?.update?.().catch(function () {
            // Offline play remains available from the current release cache.
        });
    }

    function installedAlready() {
        return window.matchMedia?.('(display-mode: standalone)')?.matches === true
            || window.navigator.standalone === true;
    }

    function hideInvitation() {
        if (installCard) installCard.hidden = true;
    }

    if ('serviceWorker' in navigator && (window.isSecureContext || /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname))) {
        navigator.serviceWorker.addEventListener('message', function (event) {
            if (event.data?.type !== 'MYTHICAL_VOID_RELEASE_READY') return;
            event.source?.postMessage?.({
                type: 'MYTHICAL_VOID_RELEASE_ACK',
                version: String(event.data.version || '')
            });
            reloadForCurrentRelease();
        });
        navigator.serviceWorker.addEventListener('controllerchange', function () {
            reloadForCurrentRelease();
        });
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none'
            }).then(function (registration) {
                serviceWorkerRegistration = registration;
                checkForCurrentRelease();
            }).catch(function () {
                // Installation is an optional enhancement; normal browser play remains available.
            });
        }, { once: true });
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') checkForCurrentRelease();
        });
        window.setInterval(checkForCurrentRelease, 5 * 60 * 1000);
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
