/** @jest-environment jsdom */

require('../systems/MemoryManager.js');

describe('MemoryManager pressure gate', () => {
    const MB = 1024 * 1024;

    afterEach(() => {
        jest.useRealTimers();
        delete performance.memory;
    });

    test('does not clean up ordinary Phaser heap usage above the old 100 MB limit', () => {
        const manager = new window.MemoryManager();

        expect(manager.isMemoryPressureHigh(130 * MB, 4096 * MB)).toBe(false);
    });

    test('detects pressure near the browser heap limit', () => {
        const manager = new window.MemoryManager();

        expect(manager.isMemoryPressureHigh(420 * MB, 512 * MB)).toBe(true);
    });

    test('detects unusually high absolute usage even with a large heap limit', () => {
        const manager = new window.MemoryManager();

        expect(manager.isMemoryPressureHigh(512 * MB, 4096 * MB)).toBe(true);
    });

    test('rate-limits emergency cleanup while pressure remains high', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-09-10T10:00:00Z'));
        Object.defineProperty(performance, 'memory', {
            configurable: true,
            value: {
                usedJSHeapSize: 600 * MB,
                totalJSHeapSize: 650 * MB,
                jsHeapSizeLimit: 4096 * MB
            }
        });
        const manager = new window.MemoryManager();
        manager.performCleanup = jest.fn();
        const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});

        manager.startMemoryMonitoring();
        expect(manager.performCleanup).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(50000);
        expect(manager.performCleanup).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(10000);
        expect(manager.performCleanup).toHaveBeenCalledTimes(2);
        manager.stopMemoryMonitoring();
        warning.mockRestore();
    });
});
