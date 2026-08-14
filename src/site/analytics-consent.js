const CONSENT_KEY = 'mythical-analytics-consent';
const ALLOWED_PUBLIC_ACTIONS = new Set([
    'public_play_selected',
    'public_share_selected'
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
        }
    });
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
            <p>Optional counting helps us see which public pages, Play buttons and Share button are useful. It is off unless you say yes, and it is not used in the game.</p>
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

export {
    mountAnalyticsConsent,
    mountPublicActionMeasurement,
    publicPageGroup,
    readConsent,
    recordPublicAction
};
