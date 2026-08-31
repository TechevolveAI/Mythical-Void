(function () {
    'use strict';

    var root = document.querySelector('[data-discovery-observatory]');
    if (!root) return;

    var title = document.querySelector('[data-discovery-title]');
    var date = document.querySelector('[data-discovery-date]');
    var source = document.querySelector('[data-discovery-source]');
    var sourceLink = document.querySelector('[data-discovery-source-link]');
    var discoveryState = document.querySelector('[data-discovery-state]');
    var discoveryCode = document.querySelector('[data-discovery-code]');
    var loadNote = document.querySelector('[data-discovery-load-note]');
    var imaginedQuestion = document.querySelector('[data-imagined-question]');

    function displayDate(value) {
        var parsed = new Date(String(value || '') + 'T00:00:00Z');
        if (Number.isNaN(parsed.getTime())) return String(value || '');
        return new Intl.DateTimeFormat('en-IE', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC'
        }).format(parsed).toUpperCase();
    }

    function applyDiscovery(data) {
        if (!data || data.schemaVersion !== 1 || !data.source) return;
        var seed = Number(data.visualSeed) || 0;
        var angle = seed % 360;
        var shift = 28 + (seed % 45);

        root.style.setProperty('--discovery-angle', angle + 'deg');
        root.style.setProperty('--discovery-shift', shift + '%');
        title.textContent = data.title;
        date.textContent = displayDate(data.observationDate);
        date.setAttribute('datetime', data.observationDate);
        source.textContent = data.source.label;
        sourceLink.href = data.source.url;
        discoveryCode.textContent = data.observationCode;
        imaginedQuestion.textContent = data.imaginedQuestion;

        if (data.status === 'live') {
            discoveryState.textContent = 'TODAY\'S LIVE SOURCE';
            loadNote.textContent = 'Today\'s NASA source is ready. The picture and full credit remain on the original page.';
            loadNote.dataset.state = 'live';
        } else {
            discoveryState.textContent = 'SAVED OBSERVATION';
            loadNote.textContent = 'Today\'s live source is resting, so this checked Apollo observation is standing by.';
            loadNote.dataset.state = 'fallback';
        }
    }

    fetch('/api/space-discovery', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin'
    })
        .then(function (response) {
            if (!response.ok) throw new Error('Space Discovery unavailable');
            return response.json();
        })
        .then(applyDiscovery)
        .catch(function () {
            loadNote.textContent = 'The live source is resting, so this checked Apollo observation is standing by.';
            loadNote.dataset.state = 'fallback';
        });
}());
