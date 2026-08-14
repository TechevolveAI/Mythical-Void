(function () {
    var storageKey = 'mythical-analytics-consent';
    var tagId = 'G-FTM4W73EQC';
    var currentPath = window.location.pathname;
    var allowedActions = [
        'public_play_selected',
        'public_share_selected',
        'public_trailer_started',
        'public_stem_resource_selected',
        'public_press_asset_selected'
    ];
    var pageGroups = {
        '/': 'home',
        '/press': 'press',
        '/trailer': 'trailer',
        '/privacy': 'privacy',
        '/terms': 'terms',
        '/parents': 'parents',
        '/creature-genetics': 'creature_genetics',
        '/nasa-space-science': 'nasa_stem',
        '/studio': 'studio',
        '/story': 'story'
    };

    function readChoice() {
        try { return window.localStorage.getItem(storageKey); } catch (error) { return null; }
    }

    function rememberChoice(value) {
        try { window.localStorage.setItem(storageKey, value); } catch (error) { /* Storage can be unavailable. */ }
    }

    function clearGoogleAnalyticsCookies() {
        document.cookie.split(';').forEach(function (part) {
            var name = part.split('=')[0].trim();
            if (!/^_ga(?:_|$)|^_gid$/.test(name)) return;
            document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax';
            document.cookie = name + '=; Max-Age=0; path=/; domain=' + window.location.hostname + '; SameSite=Lax';
        });
    }

    function applyChoice(value) {
        if (value !== 'granted') {
            if (typeof window.gtag === 'function') window.gtag('consent', 'update', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
            });
            clearGoogleAnalyticsCookies();
            return;
        }
        window.dataLayer = window.dataLayer || [];
        function gtag() { window.dataLayer.push(arguments); }
        window.gtag = window.gtag || gtag;
        window.gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
        });
        window.gtag('consent', 'update', {
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
        });
        window.gtag('js', new Date());
        window.gtag('config', tagId, {
            send_page_view: true,
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
            page_location: window.location.origin + currentPath,
            page_path: currentPath,
            page_referrer: ''
        });
        if (!document.querySelector('script[data-mythical-google-tag]')) {
            var tag = document.createElement('script');
            tag.async = true;
            tag.dataset.mythicalGoogleTag = '';
            tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + tagId;
            document.head.appendChild(tag);
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
            return;
        }
        if (target && target.closest('a[href="/resources/mythical-void-stem-creature-lab.pdf"]')) {
            recordAction('public_stem_resource_selected');
            return;
        }
        if (target && target.closest('a[download][href^="/press/"]')) {
            recordAction('public_press_asset_selected');
        }
    };
    document.addEventListener('click', window.MythicalDiscoveryActionHandler);
    if (window.MythicalDiscoveryTrailerHandler) {
        document.removeEventListener('play', window.MythicalDiscoveryTrailerHandler, true);
    }
    var measuredTrailers = new WeakSet();
    window.MythicalDiscoveryTrailerHandler = function (event) {
        var video = event.target instanceof HTMLVideoElement ? event.target : null;
        if (!video || !video.matches('[data-measure-trailer]') || measuredTrailers.has(video)) return;
        if (recordAction('public_trailer_started')) measuredTrailers.add(video);
    };
    document.addEventListener('play', window.MythicalDiscoveryTrailerHandler, true);

    var savedChoice = readChoice();
    if (savedChoice === 'granted' || savedChoice === 'denied') {
        applyChoice(savedChoice);
        return;
    }

    var notice = document.createElement('aside');
    notice.className = 'analytics-choice';
    notice.setAttribute('aria-label', 'Optional website analytics');
    notice.innerHTML = '<strong>Help us improve the website?</strong><p>Allow counting of public page visits and whether Play, Share, the trailer or free resources are useful. Google Analytics is not loaded unless you say yes. The game itself is not measured.</p><div class="analytics-actions"><button type="button" data-allow>Allow analytics</button><button type="button" data-deny>No thanks</button></div>';
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
