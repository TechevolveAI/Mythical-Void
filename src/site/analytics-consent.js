const CONSENT_KEY = 'mythical-analytics-consent';
const ALLOWED_PUBLIC_ACTIONS = new Set([
    'public_play_selected',
    'public_share_selected',
    'public_trailer_started',
    'public_stem_resource_selected',
    'public_press_asset_selected'
]);
const PAGE_GROUPS = new Map([
    ['/', 'home'],
    ['/press', 'press'],
    ['/privacy', 'privacy'],
    ['/terms', 'terms'],
    ['/parents', 'parents'],
    ['/creature-genetics', 'creature_genetics'],
    ['/nasa-space-science', 'nasa_stem'],
    ['/studio', 'studio']
]);

function readConsent() {
    if (window.MythicalAnalytics?.getConsent) return window.MythicalAnalytics.getConsent();
    try { return window.localStorage.getItem(CONSENT_KEY); } catch (error) { return null; }
}

function publicPageGroup(pathname = window.location.pathname) {
    const cleanPath = pathname.replace(/\/+$/, '') || '/';
    return PAGE_GROUPS.get(cleanPath) || 'other';
}

function recordPublicAction(action) {
    if (!ALLOWED_PUBLIC_ACTIONS.has(action) || readConsent() !== 'granted') return false;
    if (typeof window.gtag !== 'function') return false;

    window.gtag('event', action, {
        page_group: publicPageGroup(),
        transport_type: 'beacon'
    });
    return true;
}

function mountPublicActionMeasurement() {
    if (document.documentElement.dataset.publicActionMeasurement === 'mounted') return;
    document.documentElement.dataset.publicActionMeasurement = 'mounted';

    document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('a[href="/play/"]')) {
            recordPublicAction('public_play_selected');
            return;
        }
        if (target?.closest('[data-share-game]')) {
            recordPublicAction('public_share_selected');
            return;
        }
        if (target?.closest('a[href="/resources/mythical-void-stem-creature-lab.pdf"]')) {
            recordPublicAction('public_stem_resource_selected');
            return;
        }
        if (target?.closest('a[download][href^="/press/"]')) {
            recordPublicAction('public_press_asset_selected');
        }
    });

    const measuredTrailers = new WeakSet();
    document.addEventListener('play', (event) => {
        const video = event.target instanceof HTMLVideoElement ? event.target : null;
        if (!video?.matches('[data-measure-trailer]') || measuredTrailers.has(video)) return;
        if (recordPublicAction('public_trailer_started')) measuredTrailers.add(video);
    }, true);
}

function mountAnalyticsConsent() {
    if (document.querySelector('[data-analytics-consent]') || readConsent()) return;

    const banner = document.createElement('aside');
    banner.className = 'analytics-consent';
    banner.dataset.analyticsConsent = '';
    banner.setAttribute('aria-label', 'Analytics choice');
    banner.innerHTML = `
        <div class="analytics-consent-copy">
            <strong>Help us improve the website?</strong>
            <p>Optional counting helps us see which public pages, Play and Share buttons, trailer and free resources are useful. Google Analytics is not loaded unless you say yes, and it is not used in the game.</p>
            <a href="/privacy/">Read the privacy and safety page</a>
        </div>
        <div class="analytics-consent-actions">
            <button type="button" class="analytics-consent-no" data-analytics-deny>No thanks</button>
            <button type="button" class="analytics-consent-yes" data-analytics-allow>Allow analytics</button>
        </div>
    `;
    document.body.appendChild(banner);

    const close = (value) => {
        window.MythicalAnalytics?.setConsent(value);
        banner.remove();
    };
    banner.querySelector('[data-analytics-deny]')?.addEventListener('click', () => close('denied'));
    banner.querySelector('[data-analytics-allow]')?.addEventListener('click', () => close('granted'));
}

function mountAnalyticsPreferenceControls() {
    document.querySelectorAll('[data-analytics-set]').forEach(button => {
        button.addEventListener('click', () => {
            const value = button.dataset.analyticsSet;
            if (value !== 'granted' && value !== 'denied') return;
            window.MythicalAnalytics?.setConsent(value);
            document.querySelector('[data-analytics-consent]')?.remove();
            document.querySelectorAll('[data-analytics-status]').forEach(status => {
                status.textContent = value === 'granted'
                    ? 'Optional website analytics are allowed in this browser.'
                    : 'Optional website analytics are off in this browser.';
            });
        });
    });
    document.querySelectorAll('[data-analytics-status]').forEach(status => {
        status.textContent = readConsent() === 'granted'
            ? 'Optional website analytics are allowed in this browser.'
            : 'Optional website analytics are off in this browser.';
    });
}

export {
    mountAnalyticsConsent,
    mountAnalyticsPreferenceControls,
    mountPublicActionMeasurement,
    publicPageGroup,
    readConsent,
    recordPublicAction
};
