(function () {
    'use strict';

    var form = document.querySelector('[data-adult-feedback]');
    var status = document.querySelector('[data-feedback-status]');
    var submit = document.querySelector('[data-feedback-submit]');
    var thanks = document.querySelector('[data-feedback-thanks]');
    if (!form || !status || !submit || !thanks) return;

    var allowedFields = [
        'audienceRole',
        'discoverySource',
        'tryReason',
        'journey',
        'overall',
        'bestPart',
        'nextImprovement',
        'recommendation'
    ];

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        status.textContent = '';

        if (!form.reportValidity()) {
            status.textContent = 'Please choose one answer for every question and confirm that you are 18 or older.';
            return;
        }

        var formData = new FormData(form);
        var payload = { schemaVersion: 2, adultConfirmed: formData.get('adultConfirmed') === 'true' };
        allowedFields.forEach(function (field) {
            payload[field] = String(formData.get(field) || '');
        });

        submit.disabled = true;
        submit.textContent = 'Sending…';

        try {
            var response = await fetch('/api/adult-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'same-origin'
            });
            var result = await response.json().catch(function () { return null; });
            if (!response.ok || result?.accepted !== true) throw new Error('feedback_unavailable');

            form.hidden = true;
            thanks.hidden = false;
            thanks.focus();
        } catch (error) {
            submit.disabled = false;
            submit.textContent = 'Try sending again →';
            status.textContent = 'The feedback channel is temporarily unavailable. Your answers were not saved. Please try again later.';
        }
    });
}());
