/** @jest-environment jsdom */

const WebGLContextGuard = require('../utils/WebGLContextGuard.js');

describe('WebGLContextGuard', () => {
    afterEach(() => {
        jest.useRealTimers();
        document.body.innerHTML = '';
    });

    test('shows recovery state on context loss and clears it on restore', () => {
        jest.useFakeTimers();
        const canvas = document.createElement('canvas');
        document.body.appendChild(canvas);
        const guard = new WebGLContextGuard({ restoreTimeoutMs: 10000 });
        guard.attach(canvas);

        canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
        expect(document.getElementById('game-render-recovery')).not.toBeNull();

        canvas.dispatchEvent(new Event('webglcontextrestored'));
        expect(document.getElementById('game-render-recovery')).toBeNull();
        guard.detach();
    });
});
