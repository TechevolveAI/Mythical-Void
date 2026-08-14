const fs = require('fs');
const path = require('path');

const discoveryScript = fs.readFileSync(
    path.join(__dirname, '../../public/discovery.js'),
    'utf8'
);
const indexHtml = fs.readFileSync(
    path.join(__dirname, '../../index.html'),
    'utf8'
);
const primaryAnalyticsScript = indexHtml.match(
    /<!-- Google tag:[\s\S]*?<script>\s*([\s\S]*?)<\/script>/
)?.[1];

function runPrimaryAnalytics(pathname, consent) {
    document.documentElement.innerHTML = '<head></head><body></body>';
    window.history.replaceState({}, '', pathname);
    window.localStorage.clear();
    if (consent) window.localStorage.setItem('mythical-analytics-consent', consent);
    delete window.dataLayer;
    delete window.gtag;
    delete window.MythicalAnalytics;
    delete window.MYTHICAL_GOOGLE_TAG_ID;
    window.eval(primaryAnalyticsScript);
}

function runDiscoveryMeasurement(pathname, consent) {
    document.documentElement.innerHTML = '<head></head><body></body>';
    window.history.replaceState({}, '', pathname);
    window.localStorage.clear();
    if (consent) window.localStorage.setItem('mythical-analytics-consent', consent);
    window.dataLayer = [];
    delete window.gtag;
    delete window.MythicalAnalytics;
    window.eval(discoveryScript);
}

function measuredEvents() {
    return window.dataLayer
        .map(entry => Array.from(entry))
        .filter(entry => entry[0] === 'event');
}

function click(element) {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('public website action measurement', () => {
    test('does not request the Google tag before affirmative consent', () => {
        expect(primaryAnalyticsScript).toBeTruthy();
        runPrimaryAnalytics('/', null);

        expect(document.querySelector('script[src*="googletagmanager.com"]')).toBeNull();
        expect(window.dataLayer).toBeUndefined();

        window.MythicalAnalytics.setConsent('denied');
        expect(document.querySelector('script[src*="googletagmanager.com"]')).toBeNull();
        expect(window.dataLayer).toBeUndefined();
    });

    test('loads one Google tag only after consent and restores a saved yes', () => {
        runPrimaryAnalytics('/press/', null);
        window.MythicalAnalytics.setConsent('granted');
        window.MythicalAnalytics.setConsent('granted');

        expect(document.querySelectorAll('script[src*="googletagmanager.com"]')).toHaveLength(1);
        expect(window.dataLayer.some(entry => (
            Array.from(entry)[0] === 'config' &&
            Array.from(entry)[1] === 'G-FTM4W73EQC' &&
            Array.from(entry)[2].page_referrer === ''
        ))).toBe(true);

        document.cookie = '_ga=test-value; path=/';
        window.MythicalAnalytics.setConsent('denied');
        expect(document.cookie).not.toContain('_ga=');

        runPrimaryAnalytics('/studio/', 'granted');
        expect(document.querySelectorAll('script[src*="googletagmanager.com"]')).toHaveLength(1);
    });

    test('sends no public action when analytics is denied', () => {
        runDiscoveryMeasurement('/parents/', 'denied');
        const play = document.createElement('a');
        play.setAttribute('href', '/play/');
        document.body.appendChild(play);

        click(play);

        expect(measuredEvents()).toHaveLength(0);
        expect(document.querySelector('script[data-mythical-google-tag]')).toBeNull();
    });

    test('sends only an allowlisted action and broad page group after consent', () => {
        runDiscoveryMeasurement('/parents/', 'granted');
        const play = document.createElement('a');
        play.setAttribute('href', '/play/');
        document.body.appendChild(play);

        click(play);

        const events = measuredEvents();
        expect(events).toHaveLength(1);
        expect(events[0][1]).toBe('public_play_selected');
        expect(events[0][2]).toEqual({
            page_group: 'parents',
            transport_type: 'beacon'
        });
    });

    test('records a Share selection without claiming that sharing completed', () => {
        runDiscoveryMeasurement('/studio/', 'granted');
        const share = document.createElement('button');
        share.dataset.shareGame = '';
        document.body.appendChild(share);

        click(share);

        const events = measuredEvents();
        expect(events).toHaveLength(1);
        expect(events[0][1]).toBe('public_share_selected');
        expect(events[0][2].page_group).toBe('studio');
    });

    test('recognises the story page without collecting the story being read', () => {
        runDiscoveryMeasurement('/story/', 'granted');
        const play = document.createElement('a');
        play.setAttribute('href', '/play/');
        document.body.appendChild(play);

        click(play);

        const events = measuredEvents();
        expect(events).toHaveLength(1);
        expect(events[0][1]).toBe('public_play_selected');
        expect(events[0][2]).toEqual({
            page_group: 'story',
            transport_type: 'beacon'
        });
    });

    test('begins measuring only after the visitor actively allows it', () => {
        runDiscoveryMeasurement('/nasa-space-science/', null);
        const play = document.createElement('a');
        play.setAttribute('href', '/play/');
        document.body.appendChild(play);

        click(play);
        expect(measuredEvents()).toHaveLength(0);

        click(document.querySelector('[data-allow]'));
        click(play);

        expect(window.localStorage.getItem('mythical-analytics-consent')).toBe('granted');
        expect(measuredEvents()).toHaveLength(1);
        expect(measuredEvents()[0][2].page_group).toBe('nasa_stem');
        expect(document.querySelector('script[data-mythical-google-tag]')).not.toBeNull();
    });

    test('records only a broad STEM resource selection after consent', () => {
        runDiscoveryMeasurement('/nasa-space-science/', 'granted');
        const resource = document.createElement('a');
        resource.setAttribute('href', '/resources/mythical-void-stem-creature-lab.pdf');
        resource.textContent = 'A specific button label that must not be sent';
        document.body.appendChild(resource);

        click(resource);

        const events = measuredEvents();
        expect(events).toHaveLength(1);
        expect(events[0][1]).toBe('public_stem_resource_selected');
        expect(events[0][2]).toEqual({
            page_group: 'nasa_stem',
            transport_type: 'beacon'
        });
    });

    test('records a press download selection without recording the asset name', () => {
        runDiscoveryMeasurement('/press/', 'granted');
        const asset = document.createElement('a');
        asset.setAttribute('href', '/press/private-looking-filename.mp4');
        asset.setAttribute('download', '');
        document.body.appendChild(asset);

        click(asset);

        const events = measuredEvents();
        expect(events).toHaveLength(1);
        expect(events[0][1]).toBe('public_press_asset_selected');
        expect(events[0][2]).toEqual({
            page_group: 'press',
            transport_type: 'beacon'
        });
        expect(JSON.stringify(events[0][2])).not.toContain('private-looking-filename');
    });

    test('records the first trailer start only and not its playback history', () => {
        runDiscoveryMeasurement('/trailer/', 'granted');
        const trailer = document.createElement('video');
        trailer.dataset.measureTrailer = '';
        document.body.appendChild(trailer);

        trailer.dispatchEvent(new Event('play'));
        trailer.dispatchEvent(new Event('play'));

        const events = measuredEvents();
        expect(events).toHaveLength(1);
        expect(events[0][1]).toBe('public_trailer_started');
        expect(events[0][2].page_group).toBe('trailer');
    });

    test('ignores ordinary navigation links', () => {
        runDiscoveryMeasurement('/creature-genetics/', 'granted');
        const link = document.createElement('a');
        link.setAttribute('href', '/studio/');
        document.body.appendChild(link);

        click(link);

        expect(measuredEvents()).toHaveLength(0);
    });
});
