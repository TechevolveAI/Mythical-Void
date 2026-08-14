const fs = require('fs');
const path = require('path');

const discoveryScript = fs.readFileSync(
    path.join(__dirname, '../../public/discovery.js'),
    'utf8'
);

function runDiscoveryMeasurement(pathname, consent) {
    document.documentElement.innerHTML = '<head></head><body></body>';
    window.history.replaceState({}, '', pathname);
    window.localStorage.clear();
    if (consent) window.localStorage.setItem('mythical-analytics-consent', consent);
    window.dataLayer = [];
    delete window.gtag;
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
    test('sends no public action when analytics is denied', () => {
        runDiscoveryMeasurement('/parents/', 'denied');
        const play = document.createElement('a');
        play.setAttribute('href', '/play/');
        document.body.appendChild(play);

        click(play);

        expect(measuredEvents()).toHaveLength(0);
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
