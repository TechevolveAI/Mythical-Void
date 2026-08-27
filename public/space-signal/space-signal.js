(function () {
    'use strict';

    var root = document.querySelector('[data-signal-observatory]');
    if (!root) return;

    var title = document.querySelector('[data-signal-title]');
    var date = document.querySelector('[data-signal-date]');
    var source = document.querySelector('[data-signal-source]');
    var sourceLink = document.querySelector('[data-signal-source-link]');
    var signalState = document.querySelector('[data-signal-state]');
    var signalCode = document.querySelector('[data-signal-code]');
    var loadNote = document.querySelector('[data-signal-load-note]');
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

    function applySignal(data) {
        if (!data || data.schemaVersion !== 1 || !data.source) return;
        var seed = Number(data.visualSeed) || 0;
        var angle = seed % 360;
        var shift = 28 + (seed % 45);

        root.style.setProperty('--signal-angle', angle + 'deg');
        root.style.setProperty('--signal-shift', shift + '%');
        title.textContent = data.title;
        date.textContent = displayDate(data.signalDate);
        date.setAttribute('datetime', data.signalDate);
        source.textContent = data.source.label;
        sourceLink.href = data.source.url;
        signalCode.textContent = data.signalCode;
        imaginedQuestion.textContent = data.imaginedQuestion;

        if (data.status === 'live') {
            signalState.textContent = 'TODAY\'S LIVE SOURCE';
            loadNote.textContent = 'Today\'s NASA source is ready. The picture and full credit remain on the original page.';
            loadNote.dataset.state = 'live';
        } else {
            signalState.textContent = 'SAVED OBSERVATION';
            loadNote.textContent = 'Today\'s live source is resting, so this checked Apollo observation is standing by.';
            loadNote.dataset.state = 'fallback';
        }
    }

    fetch('/api/space-signal', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin'
    })
        .then(function (response) {
            if (!response.ok) throw new Error('Space Signal unavailable');
            return response.json();
        })
        .then(applySignal)
        .catch(function () {
            loadNote.textContent = 'The live source is resting, so this checked Apollo observation is standing by.';
            loadNote.dataset.state = 'fallback';
        });
}());
