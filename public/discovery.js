/* WEBSITE ANALYTICS CORE START */
(function () {
    var path = window.location.pathname.replace(/\/+$/, '') || '/';
    var params = new URLSearchParams(window.location.search);
    var isPortalBuild = document.documentElement.dataset.distributionTarget === 'itch';
    var isGameRoute = isPortalBuild || path === '/play' || path === '/game' || params.has('testBoss');
    document.documentElement.dataset.initialRoute = isGameRoute ? 'game' : 'site';
    if (isGameRoute) return;
    if (window.MythicalAnalytics) return;

    var tagId = 'G-FTM4W73ECQ';
    var storageKey = 'mythical-analytics-consent';
    var exclusionKey = 'mythical-analytics-owner-excluded';
    var analyticsExcluded = false;
    var choice = null;
    try {
        analyticsExcluded = window.localStorage.getItem(exclusionKey) === 'true';
        choice = window.localStorage.getItem(storageKey);
    } catch (error) { /* A choice still works in memory when storage is blocked. */ }
    if (choice !== 'granted' && choice !== 'denied') choice = null;
    if (analyticsExcluded) choice = 'denied';
    window['ga-disable-' + tagId] = choice !== 'granted';
    window.MYTHICAL_GOOGLE_TAG_ID = tagId;
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    var started = false;
    var allowedEvents = ['discovery_arrival', 'play_selected', 'share_completed', 'share_link_copied', 'trailer_start', 'trailer_progress', 'trailer_complete'];
    var allowedAreas = ['header', 'hero', 'content', 'share_section', 'final_cta', 'footer', 'intent_wonder', 'intent_create', 'intent_challenge', 'intent_story', 'trailer'];
    // Only fixed public paths: never include arbitrary paths, titles, query strings or fragments.
    var publicPaths = ['/', '/privacy', '/terms', '/playable-now', '/press', '/hatch-challenge', '/creature-genetics', '/creature-field-guide', '/nasa-space-science', '/space-discovery', '/parents', '/help', '/educators', '/studio', '/story', '/updates'];
    var safePath = publicPaths.indexOf(path) !== -1 ? (path === '/' ? '/' : path + '/') : '/other/';
    function hostMatches(host, domains) {
        return domains.some(function (domain) { return host === domain || host.endsWith('.' + domain); });
    }
    function classifyEntrySource() {
        try {
            var host = new URL(document.referrer).hostname.toLowerCase();
            if (host === window.location.hostname.toLowerCase() || hostMatches(host, ['mythicalvoid.com'])) return 'owned_site';
            if (hostMatches(host, ['youtube.com', 'youtu.be'])) return 'youtube';
            if (hostMatches(host, ['linkedin.com', 'lnkd.in'])) return 'linkedin';
            if (hostMatches(host, ['google.com', 'google.ie', 'bing.com', 'duckduckgo.com', 'search.yahoo.com', 'ecosia.org'])) return 'search';
            if (hostMatches(host, ['itch.io', 'poki.com', 'crazygames.com'])) return 'game_shelf';
            if (hostMatches(host, ['tiktok.com', 'instagram.com', 'facebook.com', 'x.com', 'twitter.com', 'reddit.com'])) return 'social_or_creator';
            return 'other_site';
        } catch (error) { return document.referrer ? 'other_site' : 'direct_or_private'; }
    }
    var entrySource = classifyEntrySource();
    // Accept only these complete, published-link conventions. Untrusted UTMs are ignored.
    var source = params.get('utm_source');
    var medium = source === 'youtube' ? 'organic_video' : 'organic_social';
    var content = source === 'youtube' ? 'trailer_description' : 'founder_post';
    var campaign = (source === 'youtube' || source === 'linkedin') &&
        params.get('utm_medium') === medium && params.get('utm_campaign') === 'through_the_void_launch' &&
        params.get('utm_content') === content;
    if (campaign) entrySource = source;
    function getConsent() {
        if (analyticsExcluded) return 'denied';
        return choice;
    }
    function clearCookies() {
        document.cookie.split(';').forEach(function (part) {
            var name = part.trim().split('=')[0];
            if (!/^_ga(?:_|$)/.test(name)) return;
            var expired = name + '=; Max-Age=0; path=/; SameSite=Lax';
            document.cookie = expired;
            document.cookie = expired + '; domain=' + window.location.hostname;
            document.cookie = expired + '; domain=.mythicalvoid.com';
        });
    }
    function start() {
        if (started || getConsent() !== 'granted') return;
        started = true;
        window['ga-disable-' + tagId] = false;
        gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
        gtag('consent', 'update', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
        gtag('set', 'ads_data_redaction', true);
        gtag('set', 'url_passthrough', false);
        gtag('js', new Date());
        var config = {
            send_page_view: false,
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
            page_location: window.location.origin + safePath,
            page_path: safePath,
            page_title: 'Mythical Void website',
            page_referrer: '',
            campaign_id: '', campaign_source: '', campaign_medium: '',
            campaign_name: '', campaign_content: '', campaign_term: ''
        };
        if (entrySource === 'youtube' || entrySource === 'linkedin') {
            config.campaign_source = entrySource;
            config.campaign_medium = entrySource === 'youtube' ? 'organic_video' : 'organic_social';
            if (campaign) {
                config.campaign_name = 'through_the_void_launch';
                config.campaign_content = content;
            }
        }
        gtag('config', tagId, config);
        gtag('event', 'page_view', { source_page: safePath, entry_source: entrySource });
        if (path === '/' || path === '/playable-now') window.MythicalAnalytics.track('discovery_arrival', { source_area: 'hero' });
        if (!analyticsExcluded) {
            var tag = document.createElement('script');
            tag.async = true;
            tag.dataset.websiteAnalytics = '';
            tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + tagId;
            document.head.appendChild(tag);
        }
    }
    window.MythicalAnalytics = {
        getConsent: getConsent,
        setConsent: function (value) {
            if (value !== 'granted' && value !== 'denied') return;
            if (analyticsExcluded) value = 'denied';
            choice = value;
            try { window.localStorage.setItem(storageKey, value); } catch (error) { /* In-memory fallback. */ }
            if (value === 'granted') start();
            else {
                // Disable first; do not send a denied-consent ping. A reload removes Google's listeners.
                window['ga-disable-' + tagId] = true;
                clearCookies();
                document.querySelectorAll('script[data-website-analytics]').forEach(function (tag) { tag.remove(); });
            }
            window.dispatchEvent(new CustomEvent('mythical:analytics-consent', { detail: { value: value } }));
            if (value === 'denied' && started) window.location.reload();
        },
        track: function (eventName, details) {
            if (getConsent() !== 'granted' || allowedEvents.indexOf(eventName) === -1) return false;
            details = details || {};
            var data = {
                source_page: safePath,
                source_area: allowedAreas.indexOf(details.source_area) !== -1 ? details.source_area : 'content',
                entry_source: entrySource,
                transport_type: 'beacon'
            };
            if (eventName === 'trailer_progress') {
                if (['25', '50', '75', '90'].indexOf(details.watch_bucket) === -1) return false;
                data.watch_bucket = details.watch_bucket;
            }
            gtag('event', eventName, data);
            return true;
        }
    };
    window.addEventListener('storage', function (event) {
        if (event.key === exclusionKey && event.newValue === 'true') {
            analyticsExcluded = true;
            window.MythicalAnalytics.setConsent('denied');
        } else if (event.key === storageKey || event.key === null) {
            if (event.newValue !== 'granted') window.MythicalAnalytics.setConsent('denied');
        }
    });
    if (choice === 'granted') start();
    else clearCookies();
}());
/* WEBSITE ANALYTICS CORE END */
(function () {
    var allowedAreas = ['header', 'hero', 'content', 'share_section', 'final_cta', 'footer', 'intent_wonder', 'intent_create', 'intent_challenge', 'intent_story'];
    var intentMessages = {
        wonder: {
            title: 'Follow the mystery into six impossible realms.',
            copy: 'Begin at the wreck of Wanderer-77, meet a life form Earth has never seen and discover what each living world is trying to protect.',
            missionTitle: 'Find the first impossible thing.',
            missionSteps: [
                'Recover Wanderer-77\'s field kit.',
                'Follow the signs of life beyond the crash.',
                'Reach the Mythical Forest and notice one thing Earth\'s maps cannot explain.'
            ],
            finish: 'You can point to the moment the journey stopped feeling like an ordinary rescue mission.',
            cta: 'Enter the unknown',
            shareText: 'Want a free game full of strange alien worlds? This is your way into Mythical Void—no download or account needed.',
            sourceArea: 'intent_wonder'
        },
        create: {
            title: 'See what the creature engine makes with you.',
            copy: 'Your hatch combines form, colour, markings, personality, cosmic affinity and the possibility of a rare change—then carries that identity into the story.',
            missionTitle: 'Hatch a creature and begin its story.',
            missionSteps: [
                'Recover the field kit at the crash site.',
                'Care for the life form until it hatches.',
                'Give the creature a name and take it through the first gate.'
            ],
            finish: 'Your creature is moving through the story beside the astronaut.',
            cta: 'See what hatches',
            shareText: 'Want to hatch a strange alien creature shaped by a genetics engine? This is your way into Mythical Void—free in your browser.',
            sourceArea: 'intent_create'
        },
        challenge: {
            title: 'Recover the ship. Cross the realms. Free the guardians.',
            copy: 'Run, leap, investigate and fight beside your creature. The guardians are trapped by the corruption; the mission is to release them, not destroy them.',
            missionTitle: 'Release the first guardian.',
            missionSteps: [
                'Recover Wanderer-77 and hatch the creature.',
                'Run and leap across the Mythical Forest rootway.',
                'Clear the purple corruption holding the Elder Treant.'
            ],
            finish: 'The first guardian is restored rather than defeated.',
            cta: 'Take the first mission',
            shareText: 'Want a free browser mission with six alien realms to cross and restore? This is your way into Mythical Void.',
            sourceArea: 'intent_challenge'
        },
        story: {
            title: 'Project Beacon begins as an order and ends as your choice.',
            copy: 'Earth sent you to find hope. What you discover changes the mission, and the final message home is yours to decide.',
            missionTitle: 'Find out why the mission changes.',
            missionSteps: [
                'Read the first message from the wreckage.',
                'Earn the creature\'s trust and enter the Mythical Forest.',
                'Keep going until Project Beacon no longer feels like a simple order from Earth.'
            ],
            finish: 'You can explain why discovery and responsibility have become the same problem.',
            cta: 'Begin Project Beacon',
            shareText: 'Want a science-fiction game where the final message to Earth is your choice? This is your way into Mythical Void—free in your browser.',
            sourceArea: 'intent_story'
        }
    };

    var shareCard = document.querySelector('[data-share-card]');
    var shareUrl = shareCard && shareCard.dataset.shareUrl
        ? shareCard.dataset.shareUrl
        : 'https://mythicalvoid.com/playable-now/#find-your-way';
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

    function setShareStatus(message, target) {
        var status = target || shareStatus;
        if (status) status.textContent = message;
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
        return window.MythicalAnalytics.track(eventName, { source_area: sourceArea });
    }

    function readableShareAddress() {
        try {
            var parsed = new URL(shareUrl);
            return parsed.host + parsed.pathname;
        } catch (error) {
            return shareUrl;
        }
    }

    async function copyCleanLink(statusTarget) {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setShareStatus('Clean link copied — no tracking code.', statusTarget);
            track('share_link_copied', sourceAreaFor(document.activeElement));
        } catch (error) {
            setShareStatus('Copy this address: ' + readableShareAddress(), statusTarget);
        }
    }

    async function shareCleanLink(statusTarget, sourceElement) {
        if (!navigator.share) {
            await copyCleanLink(statusTarget);
            return;
        }
        try {
            await navigator.share(shareData);
            setShareStatus(shareCard.dataset.shareSuccess || 'Thanks for sharing the game.', statusTarget);
            track('share_completed', sourceAreaFor(sourceElement));
        } catch (error) {
            if (error && error.name !== 'AbortError') {
                setShareStatus('You can share ' + readableShareAddress() + ' from your browser.', statusTarget);
            }
        }
    }

    var shareButton = document.querySelector('[data-share-game]');
    if (shareButton) {
        if (!navigator.share) {
            var shareLabel = shareButton.querySelector('[data-share-label]');
            if (shareLabel) shareLabel.textContent = shareButton.dataset.copyLabel || 'Copy game link';
        }
        shareButton.addEventListener('click', async function () {
            await shareCleanLink(shareStatus, shareButton);
        });
    }

    var copyButton = document.querySelector('[data-copy-game]');
    if (copyButton) copyButton.addEventListener('click', function () { copyCleanLink(shareStatus); });

    var embedCopyButton = document.querySelector('[data-copy-embed]');
    if (embedCopyButton) {
        var embedCode = document.getElementById(embedCopyButton.dataset.copyEmbed || '');
        var embedStatus = document.querySelector('[data-embed-status]');
        embedCopyButton.addEventListener('click', async function () {
            var value = embedCode && ('value' in embedCode ? embedCode.value : embedCode.textContent);
            if (!value) return;
            try {
                await navigator.clipboard.writeText(value);
                setShareStatus('Website badge copied. It contains one clean link and no tracking code.', embedStatus);
            } catch (error) {
                if (embedCode.select) embedCode.select();
                setShareStatus('Select the badge code above and copy it.', embedStatus);
            }
        });
    }

    var hatchChallenge = document.querySelector('[data-hatch-challenge]');
    if (hatchChallenge) {
        var hatchChallengeUrl = 'https://mythicalvoid.com/hatch-challenge/';
        var hatchChallengeData = {
            title: 'The Mythical Void Hatch Challenge',
            text: 'Want to hatch the same mystery and compare what we get? Mythical Void is free in your browser—no download or account needed.',
            url: hatchChallengeUrl
        };
        var hatchChallengeShare = hatchChallenge.querySelector('[data-hatch-challenge-share]');
        var hatchChallengeCopy = hatchChallenge.querySelector('[data-hatch-challenge-copy]');
        var hatchChallengeStatus = hatchChallenge.querySelector('[data-hatch-challenge-status]');

        function hatchChallengeAddress() {
            try {
                var parsed = new URL(hatchChallengeUrl);
                return parsed.host + parsed.pathname + parsed.hash;
            } catch (error) {
                return hatchChallengeUrl;
            }
        }

        async function copyHatchChallenge() {
            try {
                await navigator.clipboard.writeText(hatchChallengeUrl);
                setShareStatus('Challenge link copied — no tracking code.', hatchChallengeStatus);
                track('share_link_copied', 'share_section');
            } catch (error) {
                setShareStatus('Copy this address: ' + hatchChallengeAddress(), hatchChallengeStatus);
            }
        }

        async function shareHatchChallenge() {
            if (!navigator.share) {
                await copyHatchChallenge();
                return;
            }
            try {
                await navigator.share(hatchChallengeData);
                setShareStatus('Challenge shared. Now see what hatches.', hatchChallengeStatus);
                track('share_completed', 'share_section');
            } catch (error) {
                if (error && error.name !== 'AbortError') {
                    setShareStatus('You can share ' + hatchChallengeAddress() + ' from your browser.', hatchChallengeStatus);
                }
            }
        }

        if (hatchChallengeShare) {
            if (!navigator.share) {
                var hatchChallengeLabel = hatchChallengeShare.querySelector('[data-hatch-challenge-label]');
                if (hatchChallengeLabel) hatchChallengeLabel.textContent = 'Copy challenge link';
            }
            hatchChallengeShare.addEventListener('click', shareHatchChallenge);
        }
        if (hatchChallengeCopy) hatchChallengeCopy.addEventListener('click', copyHatchChallenge);
    }

    var intentRoot = document.querySelector('[data-play-intent]');
    if (intentRoot) {
        var intentButtons = Array.from(intentRoot.querySelectorAll('[data-intent-choice]'));
        var intentGrid = intentRoot.querySelector('.play-intent-grid');
        var intentAnswer = intentRoot.querySelector('[data-intent-answer]');
        var intentTitle = intentRoot.querySelector('[data-intent-title]');
        var intentCopy = intentRoot.querySelector('[data-intent-copy]');
        var intentCta = intentRoot.querySelector('[data-intent-cta]');
        var intentMissionTitle = intentRoot.querySelector('[data-intent-mission-title]');
        var intentMissionSteps = intentRoot.querySelector('[data-intent-mission-steps]');
        var intentFinish = intentRoot.querySelector('[data-intent-finish]');
        var intentPlay = intentRoot.querySelector('[data-intent-play]');
        var intentShare = intentRoot.querySelector('[data-intent-share]');
        var intentShareStatus = intentRoot.querySelector('[data-intent-share-status]');

        function isReturningPlayer() {
            return globalThis.MythicalReturningPlayer?.hasLocalAdventure?.() === true;
        }

        function intentIdFromHash() {
            var match = window.location.hash.match(/^#find-your-way\/(wonder|create|challenge|story)$/);
            return match ? match[1] : null;
        }

        function selectIntent(button, updateAddress, scrollAnswer) {
            var intentId = button && button.dataset.intentChoice;
            var message = intentMessages[intentId];
            if (!message || !intentAnswer || !intentTitle || !intentCopy || !intentCta || !intentPlay || !intentMissionTitle || !intentMissionSteps || !intentFinish) return;
            intentButtons.forEach(function (candidate) {
                var selected = candidate === button;
                candidate.classList.toggle('active', selected);
                candidate.setAttribute('aria-pressed', String(selected));
            });
            intentTitle.textContent = message.title;
            intentCopy.textContent = message.copy;
            intentMissionTitle.textContent = message.missionTitle;
            intentMissionSteps.replaceChildren();
            message.missionSteps.forEach(function (step, index) {
                var item = document.createElement('li');
                var number = document.createElement('span');
                number.textContent = String(index + 1).padStart(2, '0');
                var text = document.createElement('strong');
                text.textContent = step;
                item.append(number, text);
                intentMissionSteps.appendChild(item);
            });
            intentFinish.textContent = message.finish;
            intentCta.textContent = isReturningPlayer() ? 'Continue your adventure' : message.cta;
            intentPlay.dataset.sourceArea = message.sourceArea;
            if (intentShare) intentShare.dataset.sourceArea = message.sourceArea;
            shareUrl = 'https://mythicalvoid.com/playable-now/#find-your-way/' + intentId;
            shareData = {
                title: 'Your way into Mythical Void',
                text: message.shareText,
                url: shareUrl
            };
            if (updateAddress && window.history && typeof window.history.replaceState === 'function') {
                var cleanAddress = new URL(window.location.href);
                cleanAddress.hash = 'find-your-way/' + intentId;
                window.history.replaceState(null, '', cleanAddress.pathname + cleanAddress.search + cleanAddress.hash);
            }
            if (intentShareStatus) intentShareStatus.textContent = '';
            if (intentGrid && window.innerWidth <= 560) button.insertAdjacentElement('afterend', intentAnswer);
            else if (intentGrid && intentGrid.contains(intentAnswer)) intentGrid.insertAdjacentElement('afterend', intentAnswer);
            intentAnswer.hidden = false;
            if (scrollAnswer && window.innerWidth <= 560 && typeof intentAnswer.scrollIntoView === 'function') {
                intentAnswer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        intentButtons.forEach(function (button) {
            button.addEventListener('click', function () {
                selectIntent(button, true, true);
            });
        });

        if (intentShare) {
            intentShare.addEventListener('click', function () {
                shareCleanLink(intentShareStatus, intentShare);
            });
        }

        window.addEventListener('resize', function () {
            if (intentGrid && intentAnswer && window.innerWidth > 560 && intentGrid.contains(intentAnswer)) {
                intentGrid.insertAdjacentElement('afterend', intentAnswer);
            }
        });

        var sharedIntentId = intentIdFromHash();
        if (sharedIntentId) {
            selectIntent(intentRoot.querySelector('[data-intent-choice="' + sharedIntentId + '"]'), false, false);
        }

        if (window.location.hash.indexOf('#find-your-way') === 0) {
            var settleIntentAnchor = function () {
                window.requestAnimationFrame(function () {
                    var isFirstMainSection = intentRoot.parentElement
                        && intentRoot.parentElement.matches('main')
                        && intentRoot.parentElement.firstElementChild === intentRoot;
                    if (isFirstMainSection) window.scrollTo({ top: 0, left: 0 });
                    else intentRoot.scrollIntoView({ block: 'start' });
                });
            };
            if (document.readyState === 'complete') settleIntentAnchor();
            else window.addEventListener('load', settleIntentAnchor, { once: true });
        }
    }

    document.addEventListener('click', function (event) {
        var link = event.target.closest && event.target.closest('a[href="/play/"]');
        if (link) track('play_selected', sourceAreaFor(link));
    });

    function showAnalyticsChoice() {
    if (document.querySelector('.analytics-choice')) return;
    var notice = document.createElement('aside');
    notice.className = 'analytics-choice';
    notice.setAttribute('aria-label', 'Optional website analytics');
    notice.innerHTML = '<strong>Help us improve the website?</strong><p>Allow optional, advertising-free counting of page visits, the general route people arrived from, and whether website buttons lead to play or sharing. The game itself is not measured.</p><div class="analytics-actions"><button type="button" data-allow>Allow analytics</button><button type="button" data-deny>No thanks</button></div>';
    document.body.appendChild(notice);

    notice.querySelector('[data-allow]').addEventListener('click', function () {
        window.MythicalAnalytics.setConsent('granted');
        notice.remove();
    });
    notice.querySelector('[data-deny]').addEventListener('click', function () {
        window.MythicalAnalytics.setConsent('denied');
        notice.remove();
    });
    }
    var settings = document.createElement('button');
    settings.type = 'button';
    settings.textContent = 'Analytics choices';
    settings.addEventListener('click', showAnalyticsChoice);
    (document.querySelector('footer') || document.body).appendChild(settings);
    if (!window.MythicalAnalytics.getConsent()) showAnalyticsChoice();
}());
