const CONSENT_KEY = 'mythical-analytics-consent';

function readConsent() {
    if (window.MythicalAnalytics?.getConsent) return window.MythicalAnalytics.getConsent();
    try { return window.localStorage.getItem(CONSENT_KEY); } catch (error) { return null; }
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
            <p>Optional analytics show what helps people reach Play. They stay off unless you allow them and never run inside the game.</p>
            <a href="/privacy/">Privacy and safety</a>
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

export { mountAnalyticsConsent, readConsent };
