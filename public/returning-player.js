(function (global) {
    'use strict';

    var saveKey = 'mythical-creature-save';

    function hasLocalAdventure(storage) {
        try {
            var local = storage || global.localStorage;
            for (var index = 0; index < local.length; index += 1) {
                if (local.key(index) === saveKey) return true;
            }
        } catch (error) {
            // Some browsers block storage. The normal new-player page remains usable.
        }
        return false;
    }

    function apply(root) {
        var scope = root || global.document;
        if (!scope || !hasLocalAdventure()) return false;

        var page = scope === global.document ? scope.documentElement : scope;
        if (page && page.dataset) page.dataset.returningPlayer = 'true';

        scope.querySelectorAll('[data-returning-player-note]').forEach(function (note) {
            note.hidden = false;
        });

        scope.querySelectorAll('[data-play-link]').forEach(function (link) {
            var label = link.querySelector('[data-play-label]');
            if (!label) return;
            label.textContent = link.closest('header') ? 'Continue' : 'Continue your adventure';
            link.setAttribute('aria-label', 'Continue your saved Mythical Void adventure');
        });

        return true;
    }

    global.MythicalReturningPlayer = {
        saveKey: saveKey,
        hasLocalAdventure: hasLocalAdventure,
        apply: apply
    };

    function mount() { apply(global.document); }
    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', mount, { once: true });
    } else {
        mount();
    }
}(window));
