(function () {
    var storageKey = 'mythical-analytics-consent';
    var tagId = 'G-FTM4W73EQC';
    var currentPath = window.location.pathname;
    var allowedActions = ['public_play_selected', 'public_share_selected'];
    var pageGroups = {
        '/': 'home',
        '/press': 'press',
        '/privacy': 'privacy',
        '/terms': 'terms',
        '/parents': 'parents',
        '/creature-genetics': 'creature_genetics',
        '/nasa-space-science': 'nasa_stem',
        '/studio': 'studio'
    };

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = window.gtag || gtag;

    function readChoice() {
        try { return window.localStorage.getItem(storageKey); } catch (error) { return null; }
    }

    function rememberChoice(value) {
        try { window.localStorage.setItem(storageKey, value); } catch (error) { /* Storage can be unavailable. */ }
    }

    function applyChoice(value) {
        window.gtag('consent', 'update', {
            analytics_storage: value,
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
        });
        if (value === 'granted') {
            window.gtag('config', tagId, {
                send_page_view: true,
                allow_google_signals: false,
                allow_ad_personalization_signals: false,
                page_location: window.location.origin + currentPath,
                page_path: currentPath
            });
        }
    }

    function pageGroup() {
        var cleanPath = currentPath.replace(/\/+$/, '') || '/';
        return pageGroups[cleanPath] || 'other';
    }

    function recordAction(action) {
        if (allowedActions.indexOf(action) === -1 || readChoice() !== 'granted') return false;
        window.gtag('event', action, {
            page_group: pageGroup(),
            transport_type: 'beacon'
        });
        return true;
    }

    window.gtag('consent', 'default', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        wait_for_update: 500
    });
    window.gtag('js', new Date());
    window.gtag('config', tagId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: window.location.origin + currentPath,
        page_path: currentPath
    });

    var tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + tagId;
    document.head.appendChild(tag);

    if (window.MythicalDiscoveryActionHandler) {
        document.removeEventListener('click', window.MythicalDiscoveryActionHandler);
    }
    window.MythicalDiscoveryActionHandler = function (event) {
        var target = event.target instanceof Element ? event.target : null;
        if (target && target.closest('a[href="/play/"]')) {
            recordAction('public_play_selected');
            return;
        }
        if (target && target.closest('[data-share-game]')) {
            recordAction('public_share_selected');
        }
    };
    document.addEventListener('click', window.MythicalDiscoveryActionHandler);

    var savedChoice = readChoice();
    if (savedChoice === 'granted' || savedChoice === 'denied') {
        applyChoice(savedChoice);
        return;
    }

    var notice = document.createElement('aside');
    notice.className = 'analytics-choice';
    notice.setAttribute('aria-label', 'Optional website analytics');
    notice.innerHTML = '<strong>Help us improve the website?</strong><p>Allow advertising-free counting of public page visits and Play or Share choices. The game itself is not measured.</p><div class="analytics-actions"><button type="button" data-allow>Allow analytics</button><button type="button" data-deny>No thanks</button></div>';
    document.body.appendChild(notice);

    notice.querySelector('[data-allow]').addEventListener('click', function () {
        rememberChoice('granted');
        applyChoice('granted');
        notice.remove();
    });
    notice.querySelector('[data-deny]').addEventListener('click', function () {
        rememberChoice('denied');
        applyChoice('denied');
        notice.remove();
    });
}());
