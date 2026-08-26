(function () {
    var storageKey = 'mythical-analytics-consent';
    var tagId = 'G-FTM4W73ECQ';
    var currentPath = window.location.pathname;
    var allowedEvents = ['play_selected', 'share_completed', 'share_link_copied'];
    var allowedAreas = ['header', 'hero', 'content', 'share_section', 'final_cta', 'footer', 'intent_wonder', 'intent_create', 'intent_challenge', 'intent_story'];
    var intentMessages = {
        wonder: {
            title: 'Follow the signal into six impossible realms.',
            copy: 'Begin at the wreck of Wanderer-77, meet a life form Earth has never seen and discover what each living world is trying to protect.',
            cta: 'Enter the unknown',
            sourceArea: 'intent_wonder'
        },
        create: {
            title: 'See what the creature engine makes with you.',
            copy: 'Your hatch combines form, colour, markings, personality, cosmic affinity and the possibility of a rare change—then carries that identity into the story.',
            cta: 'See what hatches',
            sourceArea: 'intent_create'
        },
        challenge: {
            title: 'Recover the ship. Cross the realms. Free the guardians.',
            copy: 'Run, leap, investigate and fight beside your creature. The guardians are trapped by the corruption; the mission is to release them, not destroy them.',
            cta: 'Take the first mission',
            sourceArea: 'intent_challenge'
        },
        story: {
            title: 'Project Beacon begins as an order and ends as your choice.',
            copy: 'Earth sent you to find hope. What you discover changes the mission, and the final message home is yours to decide.',
            cta: 'Begin Project Beacon',
            sourceArea: 'intent_story'
        }
    };

    var shareCard = document.querySelector('[data-share-card]');
    var shareUrl = shareCard && shareCard.dataset.shareUrl
        ? shareCard.dataset.shareUrl
        : 'https://mythicalvoid.com/playable-now/';
    var shareData = {
        title: shareCard && shareCard.dataset.shareTitle
            ? shareCard.dataset.shareTitle
            : 'Mythical Void',
        text: shareCard && shareCard.dataset.shareText
            ? shareCard.dataset.shareText
            : 'Try Mythical Void — a free alien-creature adventure you can play in your browser. No download or account needed.',
        url: shareUrl
    };
    var shareStatus = document.querySelector('[data-share-status]');

    function setShareStatus(message) {
        if (shareStatus) shareStatus.textContent = message;
    }

    function sourceAreaFor(element) {
        var declaredArea = element && element.closest && element.closest('[data-source-area]');
        if (declaredArea && allowedAreas.indexOf(declaredArea.dataset.sourceArea) !== -1) {
            return declaredArea.dataset.sourceArea;
        }
        if (element && element.closest('header')) return 'header';
        if (element && element.closest('.hero, .page-hero')) return 'hero';
        if (element && element.closest('.playable-share-section, [data-share-section]')) return 'share_section';
        if (element && element.closest('.final-cta')) return 'final_cta';
        if (element && element.closest('footer')) return 'footer';
        return 'content';
    }

    function track(eventName, sourceArea) {
        if (readChoice() !== 'granted' || allowedEvents.indexOf(eventName) === -1) return false;
        var safeArea = allowedAreas.indexOf(sourceArea) === -1 ? 'content' : sourceArea;
        window.gtag('event', eventName, {
            source_page: currentPath,
            source_area: safeArea,
            transport_type: 'beacon'
        });
        return true;
    }

    function readableShareAddress() {
        try {
            var parsed = new URL(shareUrl);
            return parsed.host + parsed.pathname;
        } catch (error) {
            return shareUrl;
        }
    }

    async function copyCleanLink() {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setShareStatus('Clean link copied — no tracking code.');
            track('share_link_copied', sourceAreaFor(document.activeElement));
        } catch (error) {
            setShareStatus('Copy this address: ' + readableShareAddress());
        }
    }

    var shareButton = document.querySelector('[data-share-game]');
    if (shareButton) {
        if (!navigator.share) {
            var shareLabel = shareButton.querySelector('[data-share-label]');
            if (shareLabel) shareLabel.textContent = 'Copy game link';
        }
        shareButton.addEventListener('click', async function () {
            if (!navigator.share) {
                await copyCleanLink();
                return;
            }
            try {
                await navigator.share(shareData);
                setShareStatus('Thanks for passing the signal on.');
                track('share_completed', sourceAreaFor(shareButton));
            } catch (error) {
                if (error && error.name !== 'AbortError') {
                    setShareStatus('You can share ' + readableShareAddress() + ' from your browser.');
                }
            }
        });
    }

    var copyButton = document.querySelector('[data-copy-game]');
    if (copyButton) copyButton.addEventListener('click', copyCleanLink);

    var intentRoot = document.querySelector('[data-play-intent]');
    if (intentRoot) {
        var intentButtons = Array.from(intentRoot.querySelectorAll('[data-intent-choice]'));
        var intentAnswer = intentRoot.querySelector('[data-intent-answer]');
        var intentTitle = intentRoot.querySelector('[data-intent-title]');
        var intentCopy = intentRoot.querySelector('[data-intent-copy]');
        var intentCta = intentRoot.querySelector('[data-intent-cta]');
        var intentPlay = intentRoot.querySelector('[data-intent-play]');

        intentButtons.forEach(function (button) {
            button.addEventListener('click', function () {
                var message = intentMessages[button.dataset.intentChoice];
                if (!message || !intentAnswer || !intentTitle || !intentCopy || !intentCta || !intentPlay) return;
                intentButtons.forEach(function (candidate) {
                    var selected = candidate === button;
                    candidate.classList.toggle('active', selected);
                    candidate.setAttribute('aria-pressed', String(selected));
                });
                intentTitle.textContent = message.title;
                intentCopy.textContent = message.copy;
                intentCta.textContent = message.cta;
                intentPlay.dataset.sourceArea = message.sourceArea;
                intentAnswer.hidden = false;
            });
        });
    }

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

    window.MythicalAnalytics = {
        getConsent: readChoice,
        setConsent: function (value) {
            if (value !== 'granted' && value !== 'denied') return;
            rememberChoice(value);
            applyChoice(value);
        },
        track: function (eventName, details) {
            return track(eventName, details && details.source_area);
        }
    };

    document.addEventListener('click', function (event) {
        var link = event.target.closest && event.target.closest('a[href="/play/"]');
        if (link) track('play_selected', sourceAreaFor(link));
    });

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

    var savedChoice = readChoice();
    if (savedChoice === 'granted' || savedChoice === 'denied') {
        applyChoice(savedChoice);
        return;
    }

    var notice = document.createElement('aside');
    notice.className = 'analytics-choice';
    notice.setAttribute('aria-label', 'Optional website analytics');
    notice.innerHTML = '<strong>Help us improve the website?</strong><p>Allow private, advertising-free counting of page visits and whether website buttons lead to play or sharing. The game itself is not measured.</p><div class="analytics-actions"><button type="button" data-allow>Allow analytics</button><button type="button" data-deny>No thanks</button></div>';
    document.body.appendChild(notice);

    notice.querySelector('[data-allow]').addEventListener('click', function () {
        window.MythicalAnalytics.setConsent('granted');
        notice.remove();
    });
    notice.querySelector('[data-deny]').addEventListener('click', function () {
        window.MythicalAnalytics.setConsent('denied');
        notice.remove();
    });
}());
